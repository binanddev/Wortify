"""All API app tests and their discovery runner."""

import io
import json
import uuid
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.test import Client
from django.test import SimpleTestCase
from cards.models import Deck
from cards.models import Card
from cards.models import StudyProgress
from cards.models import StudyAttempt
from cards.models import Folder
from cards.services.speech import OpenAISpeechProvider
from cards.services.speech import SpeechError
from learning.grading import grade
from pathlib import Path
from django.conf import settings
from django.template.loader import get_template
from practice.models import PracticeNode
from practice.models import PracticeProgress
from practice.models import PracticeAttempt
from cards.models import LearningEvent
from .practice_hub import validate_payload
from datetime import datetime
from datetime import timedelta
from datetime import timezone as dt_timezone
from django.db import connection
from django.test.utils import CaptureQueriesContext
from cards.models import StudySession
from users.models import Profile
from .profile_data import streaks
from django.test.runner import DiscoverRunner
from django.utils import timezone
from users.models import Classroom
from users.models import ClassroomAssignment
from cards.models import StudySettings


class PlatformTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user('learner', password='Testing-7391-secure')
        cls.other = get_user_model().objects.create_user('other', password='Testing-7391-secure')
        cls.deck = Deck.objects.create(owner=cls.user, title='English', language='en', level='A1')
        cls.card = Card.objects.create(deck=cls.deck, german_text='a house', vietnamese_meaning='một ngôi nhà', example_german='This is a house.')

    def setUp(self):
        self.client.force_login(self.user)

    def post(self, path, data):
        return self.client.post(path, data=json.dumps(data), content_type='application/json')

    def test_authentication_and_ownership(self):
        anonymous = Client()
        self.assertEqual(anonymous.get('/api/en/decks/').status_code, 401)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/en/decks/{self.deck.pk}/').status_code, 404)
        self.assertEqual(self.post('/api/en/next/', {'deck': self.deck.pk}).status_code, 404)
        self.assertEqual(self.post(f'/api/en/decks/{self.deck.pk}/cards/', {'german_text': 'bad'}).status_code, 404)

    def test_csrf_required_and_session_login(self):
        client = Client(enforce_csrf_checks=True)
        client.get('/api/session/')
        self.assertEqual(client.post('/api/session/', data='{}', content_type='application/json').status_code, 403)
        csrf = client.cookies['csrftoken'].value
        result = client.post('/api/session/', data=json.dumps({'username': 'learner', 'password': 'Testing-7391-secure'}), content_type='application/json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(result.json()['user']['username'], 'learner')

    def test_backend_does_not_serve_frontend_routes(self):
        for path in ['/', '/login', '/manage', '/en/flashcard', '/de/flashcard/deck/1', '/de/practice/1', '/en/create', '/api/en/missing/', '/unregistered']:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 404)
            self.assertEqual(response['Content-Type'], 'application/json')
            self.assertIn('error', response.json())

    def test_flashcard_language_and_idempotent_grading(self):
        response = self.post('/api/en/next/', {'deck': self.deck.pk, 'mode': 'write'}).json()
        self.assertEqual(response['language'], 'en')
        self.assertNotIn('target', response)
        token = response['token']
        first = self.post(f'/api/en/submit/{token}/', {'answer': 'a house'})
        self.assertTrue(first.json()['is_correct'])
        self.post(f'/api/en/submit/{token}/', {'answer': 'wrong'})
        self.assertEqual(StudyProgress.objects.get(card=self.card).correct_count, 1)

    def test_deck_validation_private_folder_and_card_crud(self):
        foreign = Folder.objects.create(owner=self.other, name='Other folder')
        data = {'title': 'Test', 'language': 'en', 'level': 'A1', 'folder': foreign.pk}
        self.assertEqual(self.post('/api/en/decks/', data).status_code, 400)
        data['folder'] = ''
        deck_id = self.post('/api/en/decks/', data).json()['id']
        response = self.post(f'/api/en/decks/{deck_id}/cards/', {'german_text': 'hello', 'vietnamese_meaning': 'xin chào'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.delete(f'/api/en/decks/{deck_id}/cards/{response.json()["id"]}/').status_code, 200)
        data['language'] = 'xx'
        self.assertEqual(self.post('/api/en/decks/', data).status_code, 400)

    def test_import_preview_atomic_and_idempotent(self):
        path = f'/api/en/decks/{self.deck.pk}/import/'
        before = self.deck.cards.count()
        self.assertEqual(self.post(path, {'text': 'house,nhà\nbroken'}).status_code, 400)
        self.assertEqual(self.deck.cards.count(), before)
        data = self.post(path, {'text': 'house,nhà\nbook,sách'}).json()
        self.assertEqual(self.deck.cards.count(), before)
        for _ in range(2):
            self.assertEqual(self.post(path, {'token': data['token']}).status_code, 200)
        self.assertEqual(self.deck.cards.count(), before+2)

class LanguageTests(SimpleTestCase):
    @patch('cards.services.speech.call_api')
    def test_english_and_german_speech_language(self, mocked):
        for language, reported in [('en', 'english'), ('de', 'german')]:
            mocked.return_value = json.dumps({'text': 'Hello' if language == 'en' else 'Hallo', 'language': reported}).encode()
            self.assertIn('transcript', OpenAISpeechProvider().transcribe(b'audio', 'test.wav', 'audio/wav', language=language))
        mocked.return_value = b'{"text":"bonjour","language":"french"}'
        with self.assertRaises(SpeechError):
            OpenAISpeechProvider().transcribe(b'audio', 'test.wav', 'audio/wav', language='en')


class ApiOnlyTests(TestCase):
    def test_default_admin_remains_available(self):
        user = get_user_model().objects.create_superuser('root', password='Testing-7391-secure')
        self.client.force_login(user)
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'admin/index.html')
        self.assertIn('django', str(get_template('admin/base_site.html').origin.name))

    def test_no_application_templates_static_or_react_distribution_in_backend(self):
        root = Path(settings.BASE_DIR)
        self.assertFalse((root / 'templates').exists())
        for app in ['api', 'cards', 'practice', 'users', 'content', 'learning']:
            self.assertFalse((root / app / 'templates').exists())
            self.assertFalse((root / app / 'static').exists())
        self.assertEqual(settings.STATICFILES_DIRS, [])
        self.assertEqual(settings.TEMPLATES[0]['DIRS'], [])
        self.assertFalse(hasattr(settings, 'REACT_DIST'))

    def test_api_errors_stay_json_including_csrf_and_method_errors(self):
        client = Client(enforce_csrf_checks=True)
        response = client.post('/api/session/', data='{}', content_type='application/json')
        self.assertEqual(response.status_code, 403)
        self.assertIn('error', response.json())
        response = self.client.put('/api/session/', data='{}', content_type='application/json')
        self.assertEqual(response.status_code, 405)
        self.assertIn('error', response.json())
        self.assertIn('GET', response['Allow'])


class ExploreTests(TestCase):
    def setUp(self):
        self.reader = get_user_model().objects.create_user('reader')
        self.author = get_user_model().objects.create_user('author', first_name='Linh')
        self.client.force_login(self.reader)

    def node(self, title, **overrides):
        values = dict(owner=self.author, language='en', kind='exercise', visibility='public', title=title,
                      payload={'presentation':{'interaction':'short_answer'}, 'instruction':'Ôn ngữ pháp', 'questions':[{'prompt':'Complete this sentence'}]})
        values.update(overrides)
        if values['kind'] == 'exercise':
            values['parent'] = PracticeNode.objects.create(owner=values['owner'], language=values['language'], kind='folder', title='Exercises')
        return PracticeNode.objects.create(**values)

    def search(self, **query):
        return self.client.get('/api/en/practice-hub/explore/', query)

    def test_search_finds_public_topics_without_accents_and_bilingual_aliases(self):
        node = self.node('Thì hiện tại đơn')
        english = self.node('Present Simple practice')
        result = self.search(q='thi hien tai don').json()
        self.assertEqual({n['id'] for n in result['results']}, {node.pk, english.pk})
        self.assertEqual(result['results'][0]['author'], 'Linh')
        self.assertNotIn('payload', result['results'][0])

    def test_search_never_exposes_private_nodes_other_languages_or_retired_modes(self):
        self.node('Private lesson', visibility='private')
        self.node('My private lesson', owner=self.reader, visibility='private')
        self.node('German lesson', language='de')
        self.node('Old lesson', payload={'presentation':{'interaction':'audio_dictation'}})
        node = self.node('Public lesson')
        self.assertEqual([n['id'] for n in self.search().json()['results']], [node.pk])

    def test_filters_pagination_and_prompt_search(self):
        for i in range(20): self.node(f'Lesson {i}')
        self.assertEqual(self.search().json()['total'],20)
        self.assertEqual(len(self.search(page=2).json()['results']),2)
        self.assertEqual(self.search(q='complete sentence').json()['total'],20)
        self.assertEqual(self.search(mode='matching').json()['total'],0)
        self.assertEqual(self.search(kind='folder').json()['total'],0)
        self.assertEqual(self.search(mode='unknown').status_code,400)
        self.assertEqual(self.search(page='invalid').status_code,400)
        self.client.logout()
        self.assertEqual(self.search().status_code,401)


class PracticeHubTests(TestCase):
    def test_seven_new_types_and_all_styles_import(self):
        fixture = Path(settings.BASE_DIR.parent) / 'frontend-react/public/templates/practice-hub-v2.json'
        data = json.loads(fixture.read_text(encoding='utf-8'))
        self.assertEqual(len({n['payload']['presentation']['interaction'] for n in data['nodes']}), 7)
        data['parent'] = self.create(kind='folder', title='Examples').json()['node']['id']
        response = self.client.post('/api/en/practice-hub/import/', json.dumps(data), content_type='application/json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(len(response.json()['created']), 11)

    def setUp(self):
        self.user = get_user_model().objects.create_user('hub', password='test')
        self.client.force_login(self.user)
        self.base = '/api/en/practice-hub/nodes/'

    def create(self, **data):
        if data.get('kind') == 'exercise' and 'parent' not in data:
            data['parent'] = PracticeNode.objects.create(owner=self.user, language='en', kind='folder', title='Exercises').pk
        return self.client.post(self.base, json.dumps(data), content_type='application/json')

    def test_three_folder_levels_and_move_cycle(self):
        parent = None
        ids = []
        for title in ('A', 'B', 'C'):
            response = self.create(kind='folder', title=title, parent=parent)
            self.assertEqual(response.status_code, 201, response.content)
            parent = response.json()['node']['id']
            ids.append(parent)
        self.assertEqual(self.create(kind='folder', title='D', parent=parent).status_code, 400)
        self.assertEqual(self.create(kind='theory', title='At level 3', parent=parent, payload={'content':'Hello'}).status_code, 201)
        response = self.client.patch(f'{self.base}{ids[0]}/', json.dumps({'parent':ids[2]}), content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_import_rolls_back_all_nodes(self):
        response = self.client.post('/api/en/practice-hub/import/', json.dumps({'nodes':[
            {'kind':'folder','title':'Valid'}, {'kind':'exercise','title':'Invalid','payload':{}}
        ]}), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(PracticeNode.objects.count(), 0)

    def test_required_answers_links_and_access(self):
        theory = self.create(kind='theory', title='Theory', payload={'format':'html','content':'<p>Hello</p>'}).json()['node']
        response = self.create(kind='exercise', title='Writing', links=[theory['id']], payload={
            'presentation':{'interaction':'short_answer'}, 'questions':[{'prompt':'Translate hello','accepted_answers':['xin chào']}]
        })
        self.assertEqual(response.status_code, 201, response.content)
        node = response.json()['node']
        self.assertEqual(node['payload']['questions'][0]['accepted_answers'], ['xin chào'])
        self.assertEqual(node['links'], [theory['id']])
        self.assertNotIn('payload', self.client.get(self.base).json()['nodes'][0])
        self.assertIn('payload', self.client.get(self.base+'?full=1').json()['nodes'][0])
        other = get_user_model().objects.create_user('other-hub')
        self.client.force_login(other)
        self.assertEqual(self.client.get(f'{self.base}{node["id"]}/').status_code, 404)

    def test_malformed_presentation_is_validation_error(self):
        self.assertEqual(self.create(kind='exercise', title='Invalid', payload={'presentation':[]}).status_code, 400)

    def test_ui_ux_demo_fixture_imports_all_exercise_types(self):
        fixture = Path(settings.BASE_DIR.parent) / 'frontend-react' / 'public' / 'templates' / 'practice-hub-demo.json'
        data = json.loads(fixture.read_text(encoding='utf-8'))
        data['parent'] = self.create(kind='folder', title='Demo').json()['node']['id']
        response = self.client.post(
            '/api/en/practice-hub/import/',
            json.dumps(data),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(len(response.json()['created']), 9)
        exercises = PracticeNode.objects.filter(owner=self.user, kind='exercise')
        self.assertEqual(exercises.count(), 9)
        self.assertTrue(all(len(node.payload['questions']) >= 3 for node in exercises))

    def test_exercises_require_folder_and_languages_are_isolated(self):
        folder = self.create(kind='folder', title='English').json()['node']['id']
        payload = {'presentation': {'interaction': 'short_answer'}, 'questions': [{'prompt': 'Hello', 'accepted_answers': ['Hello']}]}
        self.assertEqual(self.create(kind='exercise', title='Loose', parent=None, payload=payload).status_code, 400)
        node = self.create(kind='exercise', title='English lesson', parent=folder, payload=payload, visibility='public').json()['node']['id']
        german = PracticeNode.objects.create(owner=self.user, language='de', kind='folder', title='Deutsch')
        self.assertEqual(self.client.get(f'/api/de/practice-hub/nodes/{node}/').status_code, 404)
        self.assertEqual([n['id'] for n in self.client.get('/api/de/practice-hub/nodes/').json()['nodes']], [german.pk])
        self.assertEqual(self.client.get('/api/de/practice-hub/explore/').json()['results'], [])
        for parent in (None, german.pk):
            response = self.client.patch(f'{self.base}{node}/', json.dumps({'parent': parent}), content_type='application/json')
            self.assertIn(response.status_code, [400, 404])
            response = self.client.post('/api/en/practice-hub/organize/', json.dumps({'ids':[node], 'parent':parent}), content_type='application/json')
            self.assertEqual(response.status_code, 400)
        self.assertEqual(PracticeNode.objects.get(pk=node).parent_id, folder)
        response = self.client.post('/api/en/practice-hub/import/', json.dumps({'nodes':[{'kind':'exercise','title':'Loose','payload':payload}]}), content_type='application/json')
        self.assertEqual(response.status_code, 400)


class PracticeProgressTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('practice-user')
        self.client.force_login(self.user)
        self.folder=PracticeNode.objects.create(owner=self.user,language='en',kind='folder',title='Exercises')
        self.node=PracticeNode.objects.create(parent=self.folder,owner=self.user,language='en',kind='exercise',title='Practice',payload=validate_payload('exercise',{'presentation':{'interaction':'short_answer'},'questions':[{'prompt':'one','accepted_answers':['one']},{'prompt':'two','accepted_answers':['two']}]}))

    def post(self,url,data):
        return self.client.post(url,json.dumps(data),content_type='application/json')

    def event(self,completed,revision=None):
        return {'token':str(uuid.uuid4()),'kind':'practice_progress','payload':{'node':self.node.pk,'revision':revision or self.node.updated_at.isoformat(),'completed':completed}}

    def test_progress_is_monotonic_idempotent_and_has_no_scores_or_answers(self):
        event=self.event(['2'])
        for events in ([event],[event],[self.event(['1'])]):
            response=self.post('/api/en/learning/sync/',{'events':events})
            self.assertEqual(response.json()['errors'],[])
        self.assertEqual(PracticeProgress.objects.get().completed,['1','2'])
        self.assertEqual(PracticeAttempt.objects.count(),0)
        self.assertEqual(LearningEvent.objects.count(),2)
        for receipt in LearningEvent.objects.all():
            self.assertNotIn('score',receipt.result)
            self.assertNotIn('answers',receipt.payload)
        data=self.client.get(f'/api/en/practice-hub/nodes/{self.node.pk}/').json()
        self.assertEqual(data['node']['progress']['completed'],['1','2'])

    def test_progress_validates_questions_revision_and_access(self):
        response=self.post('/api/en/learning/sync/',{'events':[self.event(['missing'])]})
        self.assertEqual(len(response.json()['errors']),1)
        response=self.post('/api/en/learning/sync/',{'events':[self.event(['1'],'old-revision')]})
        self.assertTrue(response.json()['accepted'][0]['result']['outdated'])
        self.assertFalse(PracticeProgress.objects.exists())
        self.client.force_login(get_user_model().objects.create_user('other'))
        response=self.post('/api/en/learning/sync/',{'events':[self.event(['1'])]})
        self.assertEqual(len(response.json()['errors']),1)
        self.assertEqual(response.json()['errors'][0]['code'],'content_unavailable')

    def test_rename_move_keep_revision_content_changes_reset_progress(self):
        self.post('/api/en/learning/sync/',{'events':[self.event(['1'])]})
        revision=self.node.updated_at.isoformat()
        folder=PracticeNode.objects.create(owner=self.user,language='en',kind='folder',title='Folder')
        url=f'/api/en/practice-hub/nodes/{self.node.pk}/'
        response=self.client.patch(url,json.dumps({'title':'Renamed','parent':folder.pk}),content_type='application/json')
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['node']['updated_at'],revision)
        self.assertEqual(response.json()['node']['progress']['completed'],['1'])
        unchanged=dict(self.node.payload)
        unchanged['title']='Renamed in text'
        response=self.client.patch(url,json.dumps({'payload':unchanged}),content_type='application/json')
        self.assertEqual(response.json()['node']['updated_at'],revision)
        payload=self.node.payload
        payload['questions'][0]['prompt']='Updated prompt'
        response=self.client.patch(url,json.dumps({'payload':payload}),content_type='application/json')
        self.assertEqual(response.json()['node']['progress']['completed'],[])

    def test_batch_moves_ownership_cycles_depth_and_atomic_rollback(self):
        url='/api/en/practice-hub/organize/'
        folders=[]
        for i in range(3):
            folders.append(PracticeNode.objects.create(owner=self.user,language='en',kind='folder',title=str(i),parent=folders[-1] if folders else None))
        response=self.post(url,{'action':'move','ids':[folders[0].pk],'parent':folders[2].pk})
        self.assertEqual(response.status_code,400)
        response=self.post(url,{'action':'group','ids':[self.node.pk],'parent':folders[2].pk,'title':'Too deep'})
        self.assertEqual(response.status_code,400)
        self.assertFalse(PracticeNode.objects.filter(title='Too deep').exists())
        other=get_user_model().objects.create_user('owner-two')
        foreign=PracticeNode.objects.create(parent=PracticeNode.objects.create(owner=other,language='en',kind='folder',title='Other folder'),owner=other,language='en',kind='exercise',title='Other')
        response=self.post(url,{'ids':[self.node.pk,foreign.pk],'parent':folders[0].pk})
        self.assertEqual(response.status_code,400)
        self.node.refresh_from_db()
        self.assertEqual(self.node.parent_id, self.folder.pk)

    def test_reorder_visible_subset_preserves_hidden_siblings(self):
        hidden=PracticeNode.objects.create(owner=self.user,language='en',parent=self.folder,kind='theory',title='Hidden',position=1)
        last=PracticeNode.objects.create(owner=self.user,language='en',parent=self.folder,kind='theory',title='Last',position=2)
        result=self.post('/api/en/practice-hub/organize/',{'action':'reorder','ids':[last.pk,self.node.pk]})
        self.assertEqual(result.status_code,200,result.content)
        self.assertEqual(list(PracticeNode.objects.filter(parent=self.folder).order_by('position').values_list('pk',flat=True)),[last.pk,hidden.pk,self.node.pk])
    def test_group_and_undo_restore_original_location(self):
        url='/api/en/practice-hub/organize/'
        response=self.post(url,{'action':'group','ids':[self.node.pk],'title':'My group'})
        self.assertEqual(response.status_code,200,response.content)
        response=self.post(url,{'action':'restore','ids':[self.node.pk],'placements':[{'id':self.node.pk,'parent':self.folder.pk,'position':0}]})
        self.assertEqual(response.status_code,200,response.content)
        self.node.refresh_from_db()
        self.assertEqual(self.node.parent_id, self.folder.pk)


class ProfileDashboardTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('profile-learner')
        self.other=get_user_model().objects.create_user('different-learner')
        self.client.force_login(self.user)
        self.deck=Deck.objects.create(owner=self.user,language='de',title='Deutsch')
        self.card=Card.objects.create(deck=self.deck,german_text='Wasser',vietnamese_meaning='nước')
        self.now=datetime(2026,9,22,5,tzinfo=dt_timezone.utc)

    def event(self,kind,day=22,language='de',user=None,payload=None,result=None):
        event=LearningEvent.objects.create(user=user or self.user,language=language,token=uuid.uuid4(),kind=kind,payload=payload or {},result=result or {})
        LearningEvent.objects.filter(pk=event.pk).update(created_at=self.now.replace(day=day))
        return event

    def dashboard(self):
        with patch('api.profile_data.timezone.now',return_value=self.now):
            response=self.client.get('/api/de/profile/')
        self.assertEqual(response.status_code,200,response.content)
        return response.json()

    def test_counts_real_activity_once_and_keeps_accounts_languages_separate(self):
        self.event('review',payload={'correct':True})
        self.event('test',result={'correct':2,'total':3,'deck':self.deck.pk,'title':'Deutsch'})
        self.event('practice',result={'score':1,'total':2})
        self.event('star')
        self.event('review',language='en',payload={'correct':True})
        self.event('review',user=self.other,payload={'correct':True})
        node=PracticeNode.objects.create(parent=PracticeNode.objects.create(owner=self.user,language='de',kind='folder',title='Exercises'),owner=self.user,language='de',title='Grüße',kind='exercise')
        attempt=PracticeAttempt.objects.create(user=self.user,node=node,token=uuid.uuid4(),answers={},result={'score':1,'total':2})
        PracticeAttempt.objects.filter(pk=attempt.pk).update(created_at=self.now)
        StudyAttempt.objects.create(user=self.user,card=self.card,mode='write',completed_at=self.now,is_correct=True)
        StudySession.objects.create(user=self.user,language='de',kind='learn',deck=self.deck,completed_at=self.now,result={'correct':1,'total':1})
        data=self.dashboard()
        self.assertEqual(data['today_questions'],7)
        self.assertEqual(data['periods']['7'],{'questions':7,'correct':5,'accuracy':71,'active_days':1,'completed':3})
        self.assertEqual(len(data['timeline']),3)
        self.assertEqual(data['streak'],1)

    def test_streak_uses_local_day_and_does_not_count_settings(self):
        for day in (19,20,21):self.event('review',day=day,payload={'correct':True})
        self.event('preferences')
        # UTC Sunday evening belongs to Monday in Vietnam.
        event=self.event('review',payload={'correct':True})
        LearningEvent.objects.filter(pk=event.pk).update(created_at=datetime(2026,9,20,18,tzinfo=dt_timezone.utc))
        data=self.dashboard()
        self.assertEqual(data['today_questions'],0)
        self.assertEqual(data['streak'],3)
        monday=next(d for d in data['calendar'] if d['date']=='2026-09-21')
        self.assertEqual(monday['total'],2)
        self.assertTrue(any(d['future'] for d in data['calendar']))
        self.assertEqual(streaks({self.now.date()-timedelta(days=3)},self.now.date()),(0,1))

    def test_goal_patch_preserves_profile_and_is_per_language(self):
        Profile.objects.create(user=self.user,display_name='Tên cũ',bio='Giới thiệu',preferences={'sound':True})
        response=self.client.patch('/api/de/profile/',json.dumps({'daily_goal':12}),content_type='application/json')
        self.assertEqual(response.status_code,200,response.content)
        p=Profile.objects.get(user=self.user)
        self.assertEqual(p.display_name,'Tên cũ');self.assertEqual(p.bio,'Giới thiệu')
        self.assertEqual(p.preferences['sound'],True)
        self.assertEqual(self.client.get('/api/de/profile/').json()['daily_goal'],12)
        self.assertEqual(self.client.get('/api/en/profile/').json()['daily_goal'],20)
        for value in (0,501,True,'12'):
            self.assertEqual(self.client.patch('/api/de/profile/',json.dumps({'daily_goal':value}),content_type='application/json').status_code,400)

    def test_empty_account_and_bounded_queries_with_many_decks(self):
        empty=self.dashboard()
        self.assertEqual(empty['periods']['30']['accuracy'],None)
        self.assertEqual(empty['streak'],0)
        self.assertEqual(empty['timeline'],[])
        for i in range(12):
            deck=Deck.objects.create(owner=self.user,language='de',title=f'Deck {i}')
            card=Card.objects.create(deck=deck,german_text='Hallo',vietnamese_meaning='xin chào')
            StudyProgress.objects.create(user=self.user,card=card,state='mastered',due_at=self.now-timedelta(days=1))
        with CaptureQueriesContext(connection) as queries:
            data=self.dashboard()
        self.assertLessEqual(len(queries),24)
        self.assertEqual(len(data['decks']),3)
        self.assertEqual(data['cards']['mastered'],12)
        self.assertEqual(data['cards']['due'],12)
        self.assertEqual(data['cards']['new'],1)


class PlatformRunner(DiscoverRunner):
    """The Django applications live below backend/, outside the root discovery path."""
    def build_suite(self, test_labels=None, **kwargs):
        return super().build_suite(test_labels or ['api', 'cards'], **kwargs)


class SyncAndRolesTests(TestCase):
    def setUp(self):
        User=get_user_model()
        self.user=User.objects.create_user('student',password='Testing!73921')
        self.staff=User.objects.create_user('staff',is_staff=True)
        self.admin=User.objects.create_superuser('root','', 'Testing!73921')
        self.client.force_login(self.user)
        self.deck=Deck.objects.create(owner=self.user,title='Words',language='en')
        self.card=Card.objects.create(deck=self.deck,german_text='hello',vietnamese_meaning='xin chào')

    def event(self,kind,**payload):
        return {'token':str(uuid.uuid4()),'at':timezone.now().isoformat(),'kind':kind,'payload':payload}

    def sync(self,events,client=None):
        response=(client or self.client).post('/api/en/learning/sync/',json.dumps({'events':events}),content_type='application/json')
        self.assertEqual(response.status_code,200,response.content)
        return response.json()

    def test_batch_retries_idempotent_and_another_device_sees_progress(self):
        events=[self.event('star',deck=self.deck.pk,card=self.card.pk,value=True),self.event('options',deck=self.deck.pk,options={'answerWith':'definition'})]
        events += [self.event('review',deck=self.deck.pk,card=self.card.pk,correct=True,type='written',goal='comprehensive') for _ in range(3)]
        self.assertEqual(len(self.sync(events)['accepted']),5)
        self.assertEqual(len(self.sync(events)['accepted']),5)
        self.assertEqual(StudyProgress.objects.get().correct_count,3)
        second=Client();second.force_login(self.user)
        data=second.get(f'/api/en/decks/{self.deck.pk}/').json()['learning']
        self.assertEqual(data['stars'],[self.card.pk])
        self.assertEqual(data['progress'][str(self.card.pk)]['stage'],'mastered')
        self.assertEqual(data['options']['answerWith'],'definition')

    def test_invalid_event_does_not_block_other_events_or_persist_log(self):
        result=self.sync([self.event('review',deck=self.deck.pk,card=99999,correct=True,type='written'),self.event('star',deck=self.deck.pk,card=self.card.pk,value=True)])
        self.assertEqual(len(result['errors']),1)
        self.assertEqual(len(result['accepted']),1)
        self.assertEqual(LearningEvent.objects.count(),1)

    def test_legacy_practice_receipts_save_progress_without_new_scores(self):
        node=PracticeNode.objects.create(parent=PracticeNode.objects.create(owner=self.user,language='en',kind='folder',title='Exercises'),owner=self.user,language='en',kind='exercise',title='Greeting',payload=validate_payload('exercise',{'presentation':{'interaction':'short_answer'},'questions':[{'prompt':'Xin chào','accepted_answers':['hello']}]}))
        event=self.event('practice',node=node.pk,revision=node.updated_at.isoformat(),answers={'1':'hello'})
        result=self.sync([event]);self.assertEqual(result['accepted'][0]['result']['completed'],['1'])
        self.sync([event]);self.assertEqual(PracticeAttempt.objects.count(),0)
        self.assertEqual(PracticeProgress.objects.get().completed,['1'])
        self.assertNotIn('answers',LearningEvent.objects.get().payload)
        self.assertNotIn('score',LearningEvent.objects.get().result)

    def test_no_answer_and_long_writing_are_rejected(self):
        for payload in [{'presentation':{'interaction':'short_answer'},'questions':[{'prompt':'Hello','accepted_answers':[]}]},{'presentation':{'interaction':'writing'},'questions':[]}]:
            response=self.client.post('/api/en/practice-hub/nodes/',json.dumps({'kind':'exercise','title':'Invalid','payload':payload}),content_type='application/json')
            self.assertEqual(response.status_code,400)

    def test_all_nine_template_modes_grade_on_server(self):
        from pathlib import Path
        from django.conf import settings
        from .learning_sync import grade_payload
        template=json.loads((settings.BASE_DIR.parent/'frontend-react/public/templates/practice-hub.json').read_text(encoding='utf-8'))
        count=0
        for entry in template['nodes'][0]['children']:
            if entry['kind']!='exercise':continue
            payload=validate_payload('exercise',entry['payload']);answers={}
            for q in payload['questions']:
                if q['blanks']:
                    answers.update({f'{q["id"]}_{i}':b['answers'][0] for i,b in enumerate(q['blanks'])})
                else:answers[q['id']]=q['accepted_answers'] if q['kind'] in ('multi','order') else q['accepted_answers'][0]
            result=grade_payload(payload,answers);self.assertEqual(result['score'],result['total']);count+=1
        self.assertEqual(count,9)

    def test_staff_has_no_admin_privileges_but_can_author(self):
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get('/api/manage/users/').status_code,403)
        self.assertEqual(self.client.get('/api/manage/appearance/').status_code,403)
        self.assertEqual(self.client.post('/api/en/practice-hub/nodes/',json.dumps({'kind':'folder','title':'My folder'}),content_type='application/json').status_code,201)
        self.assertEqual(self.client.get('/api/manage/books/').status_code,404)

    def test_superuser_user_management_and_self_protection(self):
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get('/api/manage/users/').status_code,200)
        url=f'/api/manage/users/{self.user.pk}/'
        self.assertEqual(self.client.patch(url,json.dumps({'role':'staff','is_active':False}),content_type='application/json').status_code,200)
        self.user.refresh_from_db();self.assertTrue(self.user.is_staff);self.assertFalse(self.user.is_active)
        self.assertEqual(self.client.delete(f'/api/manage/users/{self.admin.pk}/').status_code,400)
        self.assertEqual(self.client.delete(url).status_code,200)

    def test_class_assignment_grants_subtree_access_only(self):
        root=PracticeNode.objects.create(owner=self.admin,language='en',title='Private root',kind='folder')
        child=PracticeNode.objects.create(owner=self.admin,language='en',title='Theory',kind='theory',parent=root)
        other=PracticeNode.objects.create(owner=self.admin,language='en',title='Unassigned',kind='folder')
        room=Classroom.objects.create(owner=self.admin,language='en',title='Class');room.members.add(self.user)
        ClassroomAssignment.objects.create(classroom=room,node=root,assigned_by=self.admin)
        ids={n['id'] for n in self.client.get('/api/en/practice-hub/nodes/').json()['nodes']}
        self.assertIn(child.pk,ids);self.assertNotIn(other.pk,ids)

    def test_preferences_survive_another_session_and_merge_fields(self):
        from users.models import Profile
        older=self.event('preferences',transparency=30,textSize=18)
        from datetime import timedelta
        older['at']=(timezone.now()-timedelta(seconds=10)).isoformat()
        newer=self.event('preferences',transparency=65,sound=False)
        self.assertEqual(len(self.sync([newer,older])['accepted']),2)
        profile=Profile.objects.get(user=self.user)
        self.assertEqual(profile.preferences,{'transparency':65,'sound':False,'textSize':18})
        second=Client();second.force_login(self.user)
        self.assertEqual(second.get('/api/session/').json()['user']['preferences'],profile.preferences)
        self.assertEqual(len(self.sync([self.event('preferences',textSize=999)])['errors']),1)

    def test_study_settings_are_used_in_new_deck_sessions(self):
        result=self.sync([self.event('study_settings',autoplay=True,ignore_case=False,ignore_punctuation=True,transliteration=False,new_cards_per_day=12,session_minutes=8)])
        self.assertEqual(result['errors'],[])
        defaults=self.client.get(f'/api/en/decks/{self.deck.pk}/').json()['study_defaults']
        self.assertEqual(defaults['new_cards_per_day'],12)
        self.assertEqual(defaults['autoplay'],True)


class WorkspaceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user=get_user_model().objects.create_user('owner',password='test-pass')
        cls.other=get_user_model().objects.create_user('other',password='test-pass')
        cls.de=Deck.objects.create(owner=cls.user,title='Deutsch',language='de')
        cls.en=Deck.objects.create(owner=cls.user,title='English',language='en')
        for deck in [cls.de,cls.en]:
            for i,(term,meaning) in enumerate([('house','nhà'),('book','sách'),('water','nước'),('friend','bạn')]):
                Card.objects.create(deck=deck,german_text=term,vietnamese_meaning=meaning,position=i)
        cls.folder=Folder.objects.create(owner=cls.user,language='de',name='Private')
    def setUp(self):self.client.force_login(self.user)
    def post(self,path,data):return self.client.post(path,json.dumps(data),content_type='application/json')
    def start(self,kind='learn',**extra):
        response=self.post('/api/en/sessions/',{'deck':self.en.pk,'kind':kind,**extra})
        self.assertEqual(response.status_code,201,response.content)
        return response.json()
    def test_languages_isolate_content_even_for_same_owner(self):
        self.assertEqual([d['id'] for d in self.client.get('/api/en/decks/').json()['decks']],[self.en.pk])
        self.assertEqual(self.client.get('/api/en/decks/').json()['folders'],[])
        self.assertEqual(self.client.get(f'/api/en/decks/{self.de.pk}/').status_code,404)
        self.assertEqual(self.post('/api/en/next/',{'deck':self.de.pk}).status_code,404)
        self.assertEqual(self.post('/api/en/sessions/',{'deck':self.de.pk}).status_code,404)
        q=self.post('/api/de/next/',{'deck':self.de.pk,'mode':'flash'}).json()
        self.assertEqual(self.post(f'/api/en/submit/{q["token"]}/',{'answer':'remember'}).status_code,404)
        self.assertEqual(self.client.get('/api/decks/').status_code,404)
    def test_settings_and_folder_names_are_independent(self):
        self.client.patch('/api/en/settings/',json.dumps({'new_cards_per_day':3}),content_type='application/json')
        self.assertEqual(self.client.get('/api/de/settings/').json()['new_cards_per_day'],20)
        self.assertEqual(self.client.get('/api/en/settings/').json()['new_cards_per_day'],3)
        self.assertEqual(self.post('/api/en/folders/',{'name':'Private'}).status_code,200)
    def test_finite_flashcards_and_retry_do_not_double_grade(self):
        data=self.start('flash',count=2);url=f'/api/en/sessions/{data["token"]}/answer/'
        payload={'question':data['question']['token'],'answer':'remember'}
        first=self.post(url,payload).json()
        self.assertEqual(first['session']['completed'],1)
        self.assertEqual(self.post(url,payload).json()['session']['completed'],1)
        second=self.post(url,{'question':first['session']['question']['token'],'answer':'again'}).json()
        self.assertEqual(second['session']['result']['correct'],1)
        self.assertEqual(second['session']['result']['total'],2)
        review=self.start('learn',review_session=data['token'])
        self.assertEqual(review['total'],1)
    def test_test_hides_results_until_atomic_final_submission(self):
        data=self.start('test');token=data['token']
        self.assertEqual(data['completed'],0)
        self.assertIsNone(data['result'])
        values={}
        for q in data['questions']:
            self.assertIn('card',q);self.assertIn('target',q);self.assertNotIn('result',q)
            attempt=StudyAttempt.objects.get(token=q['token'])
            values[q['token']]=attempt.question['meaning'] if q['mode']=='quiz' else attempt.question['target']
            self.assertEqual(self.client.get(f'/api/en/question/{q["token"]}/').status_code,400)
        self.assertFalse(StudyProgress.objects.exists())
        self.assertEqual(self.post(f'/api/en/sessions/{token}/finish/',{'answers':{}}).status_code,400)
        self.assertFalse(StudyProgress.objects.exists())
        result=self.post(f'/api/en/sessions/{token}/finish/',{'answers':values}).json()
        self.assertEqual(result['result']['correct'],4)
        self.post(f'/api/en/sessions/{token}/finish/',{'answers':values})
        self.assertTrue(all(p.correct_count==1 for p in StudyProgress.objects.all()))
        self.assertEqual(self.client.get(f'/api/de/sessions/{token}/').status_code,404)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/en/sessions/{token}/').status_code,404)

    def test_session_rejects_out_of_order_and_invalid_answer_without_progress(self):
        data=self.start('flash',count=2)
        session=StudySession.objects.get(token=data['token'])
        url=f'/api/en/sessions/{session.token}/answer/'
        self.assertEqual(self.post(url,{'question':session.tokens[1],'answer':'remember'}).status_code,400)
        self.assertEqual(self.post(url,{'question':session.tokens[0],'answer':'bad'}).status_code,400)
        self.assertFalse(StudyProgress.objects.exists())
        self.assertEqual(self.client.get(f'/api/en/sessions/{session.token}/').json()['question']['token'],session.tokens[0])


class PracticeMediaTests(TestCase):
    def setUp(self):
        import tempfile
        from django.test import override_settings
        self.media_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.media_dir.cleanup)
        override = override_settings(MEDIA_ROOT=self.media_dir.name)
        override.enable(); self.addCleanup(override.disable)
        self.user = get_user_model().objects.create_user('media-owner')
        self.other = get_user_model().objects.create_user('media-reader')
        self.client.force_login(self.user)
        self.folder = PracticeNode.objects.create(owner=self.user,language='en',kind='folder',title='Media')

    def image(self):
        import struct, zlib
        from django.core.files.uploadedfile import SimpleUploadedFile
        def chunk(name,data):return struct.pack('!I',len(data))+name+data+struct.pack('!I',zlib.crc32(name+data)&0xffffffff)
        data=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('!2I5B',1,1,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00\xff\x00\x00\xff'))+chunk(b'IEND',b'')
        return SimpleUploadedFile('picture.png',data,content_type='image/png')

    def upload(self,file=None):
        response=self.client.post('/api/en/practice-hub/media/',{'file':file or self.image()})
        self.assertEqual(response.status_code,201,response.content)
        return response.json()['media']

    def create_node(self,attachments,language='en'):
        return self.client.post(f'/api/{language}/practice-hub/nodes/',json.dumps({'kind':'exercise','title':'With media','parent':self.folder.pk,'payload':{'presentation':{'interaction':'short_answer'},'questions':[{'prompt':'Hello','accepted_answers':['hello']}],'attachments':attachments}}),content_type='application/json')

    def test_upload_preview_attachment_access_and_ranges(self):
        media=self.upload()
        response=self.client.get(media['url'])
        self.assertEqual(response.status_code,200)
        self.assertTrue(b''.join(response.streaming_content).startswith(b'\x89PNG'))
        response=self.client.get(media['url'],HTTP_RANGE='bytes=0-7')
        self.assertEqual(response.status_code,206)
        self.assertEqual(b''.join(response.streaming_content),b'\x89PNG\r\n\x1a\n')
        self.assertEqual(self.client.get(media['url'],HTTP_RANGE='bytes=999999-').status_code,416)
        self.assertEqual(self.client.get(media['url'].replace('/en/','/de/')).status_code,404)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(media['url']).status_code,404)
        self.client.force_login(self.user)
        created=self.create_node([media]);self.assertEqual(created.status_code,201,created.content)
        node=PracticeNode.objects.get(pk=created.json()['node']['id'])
        self.assertEqual(node.attachments.count(),1)
        node.visibility='public';node.save(update_fields=['visibility'])
        self.client.force_login(self.other)
        response=self.client.get(media['url']);self.assertEqual(response.status_code,200);response.close()
        node.visibility='private';node.save(update_fields=['visibility'])
        self.assertEqual(self.client.get(media['url']).status_code,404)
        self.client.force_login(self.user)
        payload=node.payload;payload['attachments']=[]
        response=self.client.patch(f'/api/en/practice-hub/nodes/{node.pk}/',json.dumps({'payload':payload}),content_type='application/json')
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(node.attachments.count(),0)

    def test_validation_limits_and_ownership(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from practice.models import PracticeMedia
        from api.practice_media import MAX_BYTES
        for name,content in [('fake.png',b'not a picture'),('bad.mp3',b'ID3junk'),('script.svg',b'<svg/>')]:
            self.assertEqual(self.client.post('/api/en/practice-hub/media/',{'file':SimpleUploadedFile(name,content)}).status_code,400)
        media=self.upload()
        item=PracticeMedia.objects.get(pk=media['id'])
        item.size=MAX_BYTES+1;item.save(update_fields=['size'])
        self.assertEqual(self.create_node([media]).status_code,400)
        item.size=10;item.language='de';item.save(update_fields=['size','language'])
        self.assertEqual(self.create_node([media]).status_code,400)
        item.language='en';item.owner=self.other;item.save(update_fields=['language','owner'])
        self.assertEqual(self.create_node([media]).status_code,400)
        self.assertEqual(self.create_node([{'id':'broken'}]).status_code,400)
        self.assertEqual(self.create_node([]).status_code,201)

    def test_mp3_upload_and_csrf(self):
        import av
        from django.core.files.uploadedfile import SimpleUploadedFile
        buffer=io.BytesIO()
        with av.open(buffer,'w',format='mp3') as output:
            stream=output.add_stream('libmp3lame',rate=44100)
            for i in range(4):
                frame=av.AudioFrame(format='s16',layout='mono',samples=1152)
                frame.sample_rate=44100
                for plane in frame.planes:plane.update(bytes(plane.buffer_size))
                for packet in stream.encode(frame):output.mux(packet)
            for packet in stream.encode(None):output.mux(packet)
        media=self.upload(SimpleUploadedFile('sound.mp3',buffer.getvalue(),content_type='audio/mpeg'))
        self.assertEqual(media['type'],'audio/mpeg')
        protected=Client(enforce_csrf_checks=True);protected.force_login(self.user)
        self.assertEqual(protected.post('/api/en/practice-hub/media/',{'file':self.image()}).status_code,403)

    def test_large_media_handler_streams_to_disk_and_keeps_other_uploads_unchanged(self):
        from django.core.files.uploadedfile import TemporaryUploadedFile
        from django.core.files.uploadhandler import StopUpload, StopFutureHandlers
        from practice.uploads import PracticeMediaUploadHandler
        from types import SimpleNamespace
        handler=PracticeMediaUploadHandler(SimpleNamespace(path='/api/en/practice-hub/media/'))
        with self.assertRaises(StopFutureHandlers):handler.new_file('file','large.mp3','audio/mpeg',None)
        self.assertIsInstance(handler.file,TemporaryUploadedFile)
        with self.assertRaises(StopUpload):handler.receive_data_chunk(b'x',200*1024*1024)
        other=PracticeMediaUploadHandler(SimpleNamespace(path='/api/en/speaking/'))
        other.new_file('audio','recording.wav','audio/wav',10)
        self.assertEqual(other.receive_data_chunk(b'audio',0),b'audio')

class ExploreDiscoveryTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('discovery-reader')
        self.client.force_login(self.user)
        self.base = '/api/en/practice-hub/'
        self.roots = [PracticeNode.objects.create(owner=self.user, language='en', kind='folder', visibility='public', title=f'Collection {i}', payload={'tags':['travel'] if i == 0 else ['grammar']}) for i in range(25)]

    def browse(self, **params):
        return self.client.get(self.base + 'explore/', {'browse':'1', 'seed':'fixed', **params})

    def test_pages_are_bounded_stable_and_do_not_fetch_payloads(self):
        first = self.browse().json()
        second = self.browse(page=2).json()
        last = self.browse(page=3).json()
        self.assertEqual([len(p['results']) for p in [first, second, last]], [12, 12, 1])
        self.assertEqual(len({n['id'] for p in [first, second, last] for n in p['results']}), 25)
        self.assertFalse(last['has_more'])
        self.assertEqual(self.browse().json()['results'], first['results'])
        self.assertTrue(all('payload' not in n for n in first['results']))
        self.assertEqual(self.browse(page=4).json()['results'], [])

    def test_tags_loose_search_aliases_and_personal_relevance(self):
        self.assertEqual(self.browse(q='travle').json()['results'][0]['id'], self.roots[0].pk)
        self.assertEqual(self.browse(q='du lịch xa').json()['results'][0]['id'], self.roots[0].pk)
        self.assertEqual(self.browse(interests='travel').json()['results'][0]['id'], self.roots[0].pk)
        self.assertIn('travel', self.browse(interests='travel').json()['suggestions'])

    def test_descendants_group_into_roots_and_permissions_are_preserved(self):
        sub = PracticeNode.objects.create(owner=self.user, language='en', kind='folder', visibility='public', title='Nested', parent=self.roots[0])
        lesson = PracticeNode.objects.create(owner=self.user, language='en', kind='exercise', visibility='public', title='Present simple', parent=sub, payload={'presentation':{'interaction':'short_answer'}, 'questions':[]})
        self.assertEqual([r['id'] for r in self.browse(q='present simple', mode='short_answer').json()['results']], [self.roots[0].pk])
        listing = self.browse(folder=sub.pk).json()
        self.assertEqual([n['id'] for n in listing['results']], [lesson.pk])
        self.assertEqual(listing['results'][0]['root_id'], self.roots[0].pk)
        self.assertEqual(len(listing['ancestors']), 2)
        self.assertEqual(self.client.get('/api/de/practice-hub/explore/', {'browse':'1'}).json()['results'], [])
        self.roots[0].visibility = 'private'; self.roots[0].save()
        self.assertEqual(self.browse(folder=sub.pk).status_code, 404)
        self.assertEqual(self.browse(q='present simple').json()['results'], [])

    def test_root_tags_validate_and_survive_updates_but_clear_on_move(self):
        path = self.base + f'nodes/{self.roots[0].pk}/'
        response = self.client.patch(path, json.dumps({'tags':[' Travel ', 'travel', 'A1']}), content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['node']['tags'], ['travel','a1'])
        response = self.client.patch(path, json.dumps({'title':'Renamed'}), content_type='application/json')
        self.assertEqual(response.json()['node']['tags'], ['travel','a1'])
        for tags in ['bad', ['x'*41], ['']]:
            self.assertEqual(self.client.patch(path, json.dumps({'tags':tags}), content_type='application/json').status_code, 400)
        response = self.client.patch(path, json.dumps({'parent':self.roots[1].pk}), content_type='application/json')
        self.assertEqual(response.json()['node']['tags'], [])
        self.assertEqual(self.client.patch(path, json.dumps({'tags':['travel']}), content_type='application/json').status_code, 400)
