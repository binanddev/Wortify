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
    def test_django_admin_is_not_exposed(self):
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response['Content-Type'], 'application/json')

    def test_no_application_templates_static_or_react_distribution_in_backend(self):
        root = Path(settings.BASE_DIR)
        self.assertFalse((root / 'templates').exists())
        for app in ['api', 'cards', 'practice', 'users', 'content', 'learning']:
            self.assertFalse((root / app / 'templates').exists())
            self.assertFalse((root / app / 'static').exists())
        self.assertEqual(settings.STATICFILES_DIRS, [])
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
        fixture = settings.BASE_DIR / 'sample_data/practice-hub-v2.json'
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

    def test_ten_folder_levels_and_move_cycle(self):
        parent = None
        ids = []
        for title in [f'Level {i}' for i in range(10)]:
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
        fixture = settings.BASE_DIR / 'sample_data' / 'practice-hub-demo.json'
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
        for i in range(10):
            folders.append(PracticeNode.objects.create(owner=self.user,language='en',kind='folder',title=str(i),parent=folders[-1] if folders else None))
        response=self.post(url,{'action':'move','ids':[folders[0].pk],'parent':folders[-1].pk})
        self.assertEqual(response.status_code,400)
        response=self.post(url,{'action':'group','ids':[self.node.pk],'parent':folders[-1].pk,'title':'Too deep'})
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
    """Discover the application test suites from this standalone backend."""
    def build_suite(self, test_labels=None, **kwargs):
        return super().build_suite(test_labels or ['api', 'cards', 'users'], **kwargs)


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
        template=json.loads((settings.BASE_DIR/'sample_data/practice-hub.json').read_text(encoding='utf-8'))
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

    def test_staff_manages_users_but_not_site_and_can_author(self):
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get('/api/manage/users/').status_code,200)
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
        self.assertEqual(self.client.delete(url,json.dumps({'confirm':self.user.username,'reason':'Remove test account'}),content_type='application/json').status_code,200)

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

class PracticeCopyTests(TestCase):
    def test_copy_is_owned_private_and_independent_with_media_and_links(self):
        from practice.models import PracticeMedia
        author = get_user_model().objects.create_user('copy-author')
        reader = get_user_model().objects.create_user('copy-reader')
        root = PracticeNode.objects.create(owner=author,language='en',kind='folder',title='Source',visibility='public',payload={'tags':['travel']})
        child = PracticeNode.objects.create(owner=author,language='en',parent=root,kind='exercise',title='Listen',visibility='public',payload={'questions':[{'id':'1','prompt':'Hello'}]})
        private = PracticeNode.objects.create(owner=author,language='en',parent=root,kind='folder',title='Private')
        PracticeNode.objects.create(owner=author,language='en',parent=private,kind='theory',title='Hidden descendant',visibility='public')
        asset = PracticeMedia.objects.create(owner=author,language='en',file='practice_media/test.mp3',name='test.mp3',size=42,content_type='audio/mpeg')
        from api.practice_media import media_data
        child.payload['attachments']=[{**media_data(asset),'question':'1'}]; child.save(); child.attachments.add(asset)
        root.links.add(child)
        self.client.force_login(reader)
        response = self.client.post(f'/api/en/practice-hub/nodes/{root.pk}/copy/')
        self.assertEqual(response.status_code,201,response.content)
        copied = PracticeNode.objects.get(pk=response.json()['id'])
        self.assertEqual(response.json()['count'],2)
        self.assertEqual(copied.owner,reader)
        self.assertEqual(copied.visibility,'private')
        self.assertEqual(copied.payload['tags'],['travel'])
        copy_child = copied.children.get()
        self.assertEqual(list(copied.links.all()),[copy_child])
        copy_asset = copy_child.attachments.get()
        self.assertNotEqual(copy_asset.pk,asset.pk)
        self.assertEqual(copy_asset.owner,reader)
        self.assertEqual(copy_child.payload['attachments'][0]['question'],'1')
        root.delete()
        self.assertTrue(PracticeNode.objects.filter(pk=copy_child.pk,owner=reader).exists())
        self.assertTrue(PracticeMedia.objects.filter(pk=copy_asset.pk).exists())
        self.assertEqual(self.client.post(f'/api/de/practice-hub/nodes/{copied.pk}/copy/').status_code,404)
        self.assertEqual(self.client.post(f'/api/en/practice-hub/nodes/{copied.pk}/copy/').status_code,404)

    def test_question_media_scope_is_validated(self):
        from types import SimpleNamespace
        from practice.models import PracticeMedia
        from api.practice_media import validated_attachments
        owner = get_user_model().objects.create_user('scope-owner')
        item = PracticeMedia.objects.create(owner=owner,language='en',file='test.mp3',name='test',size=10,content_type='audio/mpeg')
        req=SimpleNamespace(user=owner,language='en')
        payload={'questions':[{'id':'1'}],'attachments':[{'id':str(item.pk),'question':'1'}]}
        validated_attachments(req,payload)
        self.assertEqual(payload['attachments'][0]['question'],'1')
        payload['attachments'][0]['question']='2'
        with self.assertRaises(ValueError):validated_attachments(req,payload)

class SpacedReviewTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('spaced-user')
        self.client.force_login(self.user)
        self.deck=Deck.objects.create(owner=self.user,language='en',title='Spaced')
        self.card=Card.objects.create(deck=self.deck,german_text='hello',vietnamese_meaning='xin chào')
        self.url=f'/api/en/decks/{self.deck.pk}/review/'

    def event(self, **extra):
        from django.utils import timezone
        import uuid
        return {'token':str(uuid.uuid4()),'kind':'review','at':timezone.now().isoformat(),'payload':{'deck':self.deck.pk,'card':self.card.pk,'correct':True,'type':'written','response_ms':2000,**extra}}

    def sync(self,event):
        return self.client.post('/api/en/learning/sync/',json.dumps({'events':[event]}),content_type='application/json').json()

    def test_fsrs_review_queue_rating_and_retry_are_idempotent(self):
        from cards.models import StudyProgress
        initial=self.client.get(self.url).json()
        self.assertEqual(initial['new'],1)
        self.assertEqual(set(initial['cards'][0]['choices']),{'1','2','3','4'})
        event=self.event(type='flash',rating=4)
        self.assertEqual(len(self.sync(event)['accepted']),1)
        p=StudyProgress.objects.get(card=self.card)
        due=p.due_at
        self.assertGreater(p.interval_days,1)
        self.assertIn('card',p.memory)
        self.assertEqual(p.response_time_ms,2000)
        self.sync(event);p.refresh_from_db()
        self.assertEqual(p.correct_count,1)
        self.assertEqual(p.due_at,due)
        self.assertEqual(self.client.get(self.url).json()['new'],0)
        self.assertEqual(self.client.get(self.url).json()['cards'],[])
        self.assertEqual(self.client.get(self.url.replace('/en/','/de/')).status_code,404)
        other=get_user_model().objects.create_user('spaced-other'); self.client.force_login(other)
        self.assertEqual(self.client.get(self.url).status_code,404)

    def test_settings_validation_and_old_options_do_not_overwrite_fsrs(self):
        from cards.models import DeckLearningState
        response=self.client.patch(self.url,json.dumps({'retention':.92,'new_limit':5}),content_type='application/json')
        self.assertEqual(response.status_code,200,response.content)
        event=self.event();event['kind']='options';event['payload']={'deck':self.deck.pk,'options':{'mode':'learn','srs':{'retention':0}}}
        self.sync(event)
        self.assertEqual(DeckLearningState.objects.get(deck=self.deck).options['srs']['retention'],.92)
        for patch in [{'retention':1},{'new_limit':-1},{'review_limit':True},{'adapt_time':'yes'}]:
            self.assertEqual(self.client.patch(self.url,json.dumps(patch),content_type='application/json').status_code,400)

    def test_latency_is_secondary_and_immediate_practice_does_not_inflate_intervals(self):
        from cards.services.spaced import review
        from cards.models import StudyProgress
        from django.utils import timezone
        from datetime import timedelta
        now=timezone.now(); p=StudyProgress(user=self.user,card=self.card)
        p.memory={'timings':{'written':{'count':5,'average':2000}}}
        review(p,True,'written',now,30000)
        self.assertEqual(p.memory['rating'],2)
        due=p.due_at
        review(p,True,'written',now+timedelta(seconds=5),1000)
        self.assertEqual(p.due_at,due)
        review(p,False,'written',now+timedelta(seconds=10),1000)
        self.assertEqual(p.memory['rating'],1)
        self.assertEqual(p.state,'weak')
        due=p.due_at
        review(p,True,'written',now-timedelta(days=1),2000,rating=4)
        self.assertEqual(p.due_at,due)
        with self.assertRaises(ValueError):review(p,True,'written',now,True)

    def test_learning_steps_remain_available_after_daily_budget(self):
        from cards.models import StudyProgress
        from django.utils import timezone
        from datetime import timedelta
        self.client.patch(self.url,json.dumps({'new_limit':1,'review_limit':1}),content_type='application/json')
        event=self.event(correct=False,type='flash',rating=1)
        self.sync(event)
        StudyProgress.objects.filter(card=self.card).update(due_at=timezone.now()-timedelta(minutes=1))
        self.assertEqual(len(self.client.get(self.url).json()['cards']),1)

    def test_bad_rating_and_timing_do_not_commit_partial_progress(self):
        from cards.models import StudyProgress
        for patch in [{'rating':1,'correct':True},{'rating':7},{'response_ms':-1},{'response_ms':'fast'}]:
            result=self.sync(self.event(**patch))
            self.assertEqual(len(result['errors']),1)
            self.assertFalse(StudyProgress.objects.filter(card=self.card).exists())


class FlashcardFolderTreeTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('folder-tree')
        self.other = get_user_model().objects.create_user('folder-other')
        self.client.force_login(self.user)
        self.root = Folder.objects.create(owner=self.user, language='de', name='Root')

    def write(self, data, pk=None):
        path = f'/api/de/folders/{str(pk) + "/" if pk else ""}'
        return getattr(self.client, 'patch' if pk else 'post')(path, data=json.dumps(data), content_type='application/json')

    def test_nested_create_rename_move_and_serialization(self):
        result = self.write({'name': 'Child', 'parent': self.root.pk})
        self.assertEqual(result.status_code, 200)
        child = Folder.objects.get(pk=result.json()['id'])
        self.assertEqual(child.parent_id, self.root.pk)
        self.assertEqual(self.write({'name': 'Renamed'}, child.pk).status_code, 200)
        child.refresh_from_db()
        self.assertEqual(child.parent_id, self.root.pk)
        rows = self.client.get('/api/de/decks/').json()['folders']
        self.assertEqual(next(f for f in rows if f['id'] == child.pk)['parent_id'], self.root.pk)
        self.assertEqual(self.write({'parent': None}, child.pk).status_code, 200)
        child.refresh_from_db()
        self.assertIsNone(child.parent_id)

    def test_reject_cycles_foreign_owner_and_language(self):
        child = Folder.objects.create(owner=self.user, language='de', name='Child', parent=self.root)
        stranger = Folder.objects.create(owner=self.other, language='de', name='Other')
        english = Folder.objects.create(owner=self.user, language='en', name='English')
        for parent in [self.root, child, stranger, english]:
            self.assertEqual(self.write({'parent': parent.pk}, self.root.pk).status_code, 400)
        self.root.refresh_from_db()
        self.assertIsNone(self.root.parent_id)

    def test_depth_checks_whole_subtree(self):
        parent = self.root
        for level in range(2, 11):
            result = self.write({'name': f'Level {level}', 'parent': parent.pk})
            self.assertEqual(result.status_code, 200)
            parent = Folder.objects.get(pk=result.json()['id'])
        self.assertEqual(self.write({'name': 'Too deep', 'parent': parent.pk}).status_code, 400)
        branch = Folder.objects.create(owner=self.user, language='de', name='Branch')
        Folder.objects.create(owner=self.user, language='de', name='Leaf', parent=branch)
        self.assertEqual(self.write({'parent': parent.parent_id}, branch.pk).status_code, 400)

    def test_delete_preserves_children_and_decks(self):
        child = Folder.objects.create(owner=self.user, language='de', name='Child', parent=self.root)
        deck = Deck.objects.create(owner=self.user, language='de', title='Keep', folder=self.root)
        nested = Deck.objects.create(owner=self.user, language='de', title='Nested', folder=child)
        self.assertEqual(self.client.delete(f'/api/de/folders/{self.root.pk}/').status_code, 200)
        child.refresh_from_db(); deck.refresh_from_db(); nested.refresh_from_db()
        self.assertIsNone(child.parent_id)
        self.assertIsNone(deck.folder_id)
        self.assertEqual(nested.folder_id, child.pk)


class ManagementAccessTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.root = User.objects.create_superuser('manage-root', password='Original!47380')
        self.staff = User.objects.create_user('manage-staff', is_staff=True)
        self.user = User.objects.create_user('manage-user', password='Original!47380')
        self.other = User.objects.create_user('manage-other')
        self.deck = Deck.objects.create(owner=self.user, language='en', title='Owned')
        self.card = Card.objects.create(deck=self.deck, german_text='word', vietnamese_meaning='meaning')
        self.foreign = Deck.objects.create(owner=self.root, language='en', title='Protected')
        self.client.force_login(self.staff)
        self.base = f'/api/manage/users/{self.user.pk}/'

    def write(self, path, data, method='patch'):
        return getattr(self.client, method)(path, json.dumps(data), content_type='application/json')

    def test_regular_users_cannot_manage_and_staff_cannot_target_privileged_users(self):
        ids = {u['id'] for u in self.client.get('/api/manage/users/').json()['users']}
        self.assertNotIn(self.root.pk, ids); self.assertNotIn(self.staff.pk, ids)
        for target in (self.root, self.staff):
            path = f'/api/manage/users/{target.pk}/'
            for suffix in ('', 'data/', 'data/decks/'):
                self.assertEqual(self.client.get(path + suffix).status_code, 404)
            self.assertEqual(self.write(path, {'password': 'Changed!384940'}).status_code, 404)
            self.assertEqual(self.client.delete(path).status_code, 404)
            self.assertEqual(self.write(path+'data/', {'confirm': target.username}, 'delete').status_code, 404)
        self.root.refresh_from_db();self.assertTrue(self.root.check_password('Original!47380'))
        self.assertEqual(self.client.get('/api/manage/overview/').status_code, 403)
        self.assertEqual(self.client.get('/api/manage/appearance/').status_code, 403)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get('/api/manage/users/').status_code, 403)
        self.assertEqual(self.client.get(self.base+'data/').status_code, 403)

    def test_staff_can_edit_regular_user_but_cannot_escalate(self):
        self.assertEqual(self.write(self.base, {'email':'new@example.com','password':'Revised!384940'}).status_code, 200)
        self.user.refresh_from_db();self.assertTrue(self.user.check_password('Revised!384940'))
        for data in ({'role':'superuser'},{'role':'staff'},{'is_superuser':True},{'groups':[1]},{'user_permissions':[1]}):
            self.assertEqual(self.write(self.base, data).status_code, 403)
        self.user.refresh_from_db();self.assertFalse(self.user.is_staff)
        self.assertEqual(self.write('/api/manage/users/', {'username':'new-root','password':'Secure!484940','role':'superuser'}, 'post').status_code, 403)
        self.assertFalse(get_user_model().objects.filter(username='new-root').exists())
        self.assertEqual(self.write('/api/manage/users/', {'username':'new-regular','password':'Secure!484940','role':'user'}, 'post').status_code, 201)

    def test_data_crud_ownership_and_content_validation(self):
        url = self.base+'data/decks/'
        self.assertEqual(self.client.get(url).json()['total'], 1)
        self.assertEqual(self.write(url+f'{self.deck.pk}/', {'title':'Edited'}).status_code, 200)
        self.deck.refresh_from_db();self.assertEqual(self.deck.title,'Edited')
        self.assertEqual(self.write(url+f'{self.deck.pk}/', {'owner':self.root.pk}).status_code, 400)
        self.assertEqual(self.write(url+f'{self.foreign.pk}/', {'title':'No'}).status_code, 404)
        cards = self.base+'data/cards/'
        self.assertEqual(self.write(cards+f'{self.card.pk}/', {'deck':self.foreign.pk}).status_code, 400)
        self.assertEqual(self.write(cards, {'deck':self.deck.pk,'german_text':'new','vietnamese_meaning':'mới'}, 'post').status_code, 201)
        self.assertEqual(self.write(self.base+'data/folders/', {'name':'Parent','language':'en'}, 'post').status_code, 201)
        self.assertEqual(self.write(self.base+'data/practice/', {'title':'Invalid','kind':'exercise','language':'en'}, 'post').status_code, 400)
        self.assertEqual(self.client.get(self.base+'data/auth/').status_code, 404)
        self.assertEqual(self.client.delete(cards+f'{self.card.pk}/').status_code, 200)
        self.assertTrue(Deck.objects.filter(pk=self.foreign.pk).exists())

    def test_practice_edit_changes_revision_and_rejects_cycles(self):
        root = PracticeNode.objects.create(owner=self.user,language='en',kind='folder',title='Parent')
        child = PracticeNode.objects.create(owner=self.user,language='en',kind='theory',parent=root,title='Theory',payload={'format':'markdown','content':'Old'})
        before = child.updated_at
        url = self.base+f'data/practice/{child.pk}/'
        self.assertEqual(self.write(url, {'payload':{'format':'markdown','content':'New'}}).status_code, 200)
        child.refresh_from_db();self.assertGreater(child.updated_at,before)
        self.assertEqual(self.write(self.base+f'data/practice/{root.pk}/',{'parent':root.pk}).status_code, 400)
        self.assertEqual(self.write(url, {'language':'de'}).status_code, 400)

    def test_purge_keeps_account_and_other_users_and_audits(self):
        from django.contrib.admin.models import LogEntry
        Profile.objects.create(user=self.user,bio='Remove')
        StudyProgress.objects.create(user=self.user,card=self.card)
        folder = PracticeNode.objects.create(owner=self.user,language='de',kind='folder',title='Delete')
        classroom = Classroom.objects.create(owner=self.other,language='de',title='Keep')
        classroom.members.add(self.user)
        ClassroomAssignment.objects.create(classroom=classroom,node=folder,assigned_by=self.user)
        self.assertEqual(self.write(self.base+'data/',{'confirm':'wrong'},'delete').status_code,400)
        self.assertTrue(Deck.objects.filter(pk=self.deck.pk).exists())
        self.assertEqual(self.write(self.base+'data/',{'confirm':self.user.username},'delete').status_code,200)
        self.user.refresh_from_db();self.assertTrue(self.user.check_password('Original!47380'))
        self.assertFalse(Deck.objects.filter(owner=self.user).exists())
        self.assertFalse(Profile.objects.filter(user=self.user).exists())
        self.assertFalse(StudyProgress.objects.filter(user=self.user).exists())
        self.assertFalse(PracticeNode.objects.filter(owner=self.user).exists())
        self.assertFalse(classroom.members.filter(pk=self.user.pk).exists())
        self.assertTrue(Deck.objects.filter(pk=self.foreign.pk).exists())
        self.assertTrue(Classroom.objects.filter(pk=classroom.pk).exists())
        self.assertTrue(LogEntry.objects.filter(user=self.staff,object_id=str(self.user.pk)).exists())

    def test_superuser_dashboard_and_learner_features_remain(self):
        self.client.force_login(self.root)
        result = self.client.get('/api/manage/overview/')
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json()['users']['total'],4)
        self.assertTrue(result.json()['system']['database_ok'])
        self.assertEqual(self.client.get('/api/en/decks/').status_code,200)
        self.assertEqual(self.client.get('/api/de/practice-hub/nodes/').status_code,200)


    def test_catalogs_and_classes_members_are_scoped(self):
        summary = self.client.get(self.base+'data/').json()
        for entry in summary['collections']:
            result = self.client.get(self.base+f"data/{entry['key']}/")
            self.assertEqual(result.status_code,200,entry['key'])
        room = Classroom.objects.create(owner=self.user,language='de',title='Room')
        url = self.base+f'data/classes/{room.pk}/'
        self.assertEqual(self.write(url,{'members':[self.other.pk]}).status_code,200)
        self.assertEqual(self.write(url,{'members':[self.root.pk]}).status_code,400)
        self.assertEqual(list(room.members.values_list('pk',flat=True)),[self.other.pk])
        public = PracticeNode.objects.create(owner=self.root,language='en',kind='folder',title='Public',visibility='public')
        progress = PracticeProgress.objects.create(user=self.user,node=public,revision='v1')
        self.assertEqual(self.write(self.base+f'data/practice-progress/{progress.pk}/',{'completed':['1']}).status_code,200)


    def test_create_learning_record_with_empty_defaults_and_nullable_fields(self):
        result = self.write(self.base+'data/attempts/', {'card':self.card.pk,'mode':'written'}, 'post')
        self.assertEqual(result.status_code,201,result.content)
        attempt = StudyAttempt.objects.get(pk=result.json()['id'])
        self.assertEqual(attempt.user,self.user)
        self.assertEqual(attempt.question,{})
        self.assertIsNone(attempt.completed_at)


class PersonalAppearanceAndMonitoringTests(TestCase):
    def setUp(self):
        import tempfile
        from django.test import override_settings
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        override = override_settings(MEDIA_ROOT=self.temp.name, BACKEND_MONITOR_SECRET='test-server-monitor-key')
        override.enable(); self.addCleanup(override.disable)
        self.user = get_user_model().objects.create_user('appearance-user')
        self.other = get_user_model().objects.create_user('appearance-other')
        self.staff = get_user_model().objects.create_user('appearance-staff', is_staff=True)
        self.root = get_user_model().objects.create_superuser('appearance-root', password='Testing!673802')
        self.client.force_login(self.user)

    def test_background_private_upload_replace_delete(self):
        result = self.client.post('/api/me/background/', {'image': PracticeMediaTests.image(self)})
        self.assertEqual(result.status_code, 200, result.content)
        url = result.json()['background_url']
        self.assertTrue(url)
        profile = Profile.objects.get(user=self.user)
        old = profile.background_image.path
        response = self.client.get(url)
        self.assertEqual(response.status_code,200)
        self.assertTrue(b''.join(response.streaming_content).startswith(b'\x89PNG'))
        response.close()
        self.client.force_login(self.other)
        self.assertEqual(self.client.get('/api/me/background/').json()['background_url'],'')
        self.assertEqual(self.client.get(url).status_code,404)
        self.client.force_login(self.user)
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.post('/api/me/background/',{'image':PracticeMediaTests.image(self)}).status_code,200)
        self.assertFalse(Path(old).exists())
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete('/api/me/background/').status_code,200)
        self.assertEqual(self.client.get(url).status_code,404)

    def test_bad_images_and_preference_limits(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from users.preferences import validate_preferences
        for name, content in [('image.png',b'<html>bad</html>'),('image.svg',b'<svg/>'),('big.jpg',b'x'*(8*1024*1024+1))]:
            self.assertEqual(self.client.post('/api/me/background/',{'image':SimpleUploadedFile(name,content)}).status_code,400)
        values={'transparency':100,'textWeight':700,'textContrast':100,'textColor':'#192838'}
        self.assertEqual(validate_preferences(values),values)
        for values in ({'transparency':101},{'textWeight':900},{'textContrast':-1},{'textColor':'url(example)'},{'textWeight':True}):
            with self.assertRaises(ValueError):validate_preferences(values)

    def test_monitor_probe_reporting_idempotency_and_access(self):
        from content.models import BackendCheck
        self.assertEqual(Client().get('/api/health/check/').json(),{'ok':True})
        check={'token':str(uuid.uuid4()),'at':timezone.now().isoformat(),'ok':False,'latency_ms':15000,'error':'timeout'}
        send=lambda: self.client.post('/api/monitor/',json.dumps({'checks':[check]}),content_type='application/json',HTTP_X_WORTIFY_MONITOR_KEY='test-server-monitor-key')
        self.assertEqual(send().status_code,200)
        self.assertEqual(send().status_code,200)
        self.assertEqual(BackendCheck.objects.count(),1)
        self.assertIsNone(BackendCheck.objects.get().user)
        self.assertEqual(BackendCheck.objects.get().source,'frontend-server')
        self.assertEqual(self.client.get('/api/manage/monitor/').status_code,403)
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get('/api/manage/monitor/').status_code,403)
        self.client.force_login(self.root)
        result=self.client.get('/api/manage/monitor/?failures=1').json()
        self.assertEqual(result['total'],1)
        self.assertEqual(result['logs'][0]['error'],'timeout')
        self.assertEqual(result['logs'][0]['source'],'Frontend server')
        self.assertNotIn('user',result['logs'][0])

    def test_monitor_validation_retention_and_database_failure(self):
        from content.models import BackendCheck
        from django.db import DatabaseError
        old=BackendCheck.objects.create(token=uuid.uuid4(),user=self.user,checked_at=timezone.now()-timedelta(days=31),ok=True,latency_ms=1)
        good={'token':str(uuid.uuid4()),'at':timezone.now().isoformat(),'ok':True,'latency_ms':3,'error':''}
        for changes in ({'ok':'yes'},{'error':'secret dump'},{'latency_ms':-1},{'at':'invalid'}):
            self.assertEqual(self.client.post('/api/monitor/',json.dumps({'checks':[{**good,**changes}]}),content_type='application/json',HTTP_X_WORTIFY_MONITOR_KEY='test-server-monitor-key').status_code,400)
        self.assertEqual(self.client.post('/api/monitor/',json.dumps({'checks':[good]}),content_type='application/json',HTTP_X_WORTIFY_MONITOR_KEY='test-server-monitor-key').status_code,200)
        self.assertFalse(BackendCheck.objects.filter(pk=old.pk).exists())
        with patch('api.monitoring.connection.cursor',side_effect=DatabaseError('internal path')):
            result=Client().get('/api/health/check/')
        self.assertEqual(result.status_code,503)
        self.assertEqual(result.json(),{'ok':False})

class DeploymentEnvironmentTests(SimpleTestCase):
    def test_explicit_env_file_preserves_process_values_and_literal_secrets(self):
        import os
        import tempfile
        from config.environment import load_environment
        with tempfile.TemporaryDirectory() as directory:
            filename = Path(directory) / 'app.env'
            filename.write_text('# comment\nEXISTING=file\nSECRET="a$literal=value#hash"\n', encoding='utf-8-sig')
            with patch.dict(os.environ, {'WORTIFY_ENV_FILE': str(filename), 'EXISTING': 'process'}, clear=True):
                load_environment()
                self.assertEqual(os.environ['EXISTING'], 'process')
                self.assertEqual(os.environ['SECRET'], 'a$literal=value#hash')
            filename.write_text('invalid line', encoding='utf-8')
            with patch.dict(os.environ, {'WORTIFY_ENV_FILE': str(filename)}, clear=True):
                with self.assertRaises(ValueError):
                    load_environment()

class BackgroundLibraryTests(TestCase):
    def setUp(self):
        PersonalAppearanceAndMonitoringTests.setUp(self)

    def upload(self):
        return self.client.post('/api/me/backgrounds/', {'image': PracticeMediaTests.image(self)})

    def test_limit_access_and_preset_retirement(self):
        from users.models import Theme
        for _ in range(10): self.assertEqual(self.upload().status_code, 201)
        self.assertEqual(self.upload().status_code, 400)
        self.assertEqual(self.client.post('/api/me/background/', {'image': PracticeMediaTests.image(self)}).status_code, 400)
        rows = self.client.get('/api/me/backgrounds/').json()['images']
        self.assertEqual(len(rows), 10)
        self.assertTrue(all(t.preferences == {} for t in Theme.objects.filter(owner=self.user)))
        self.assertEqual(self.client.post('/api/themes/', {'name':'Old preset'}).status_code, 410)
        self.assertEqual(self.client.post('/api/themes/select/', '{}', content_type='application/json').status_code, 410)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get('/api/me/backgrounds/').json()['images'], [])
        pk=rows[0]['id']
        self.assertEqual(self.client.post('/api/me/backgrounds/select/', json.dumps({'id':pk}), content_type='application/json').status_code,404)
        self.assertEqual(self.client.delete(f'/api/me/backgrounds/{pk}/').status_code,404)
        self.assertEqual(self.client.get(rows[0]['url']).status_code,404)

    def test_selection_is_shared_and_deletion_falls_back(self):
        from users.models import Theme
        first=self.upload().json()['id']
        second=self.upload().json()['id']
        self.assertEqual(self.client.post('/api/me/backgrounds/select/', json.dumps({'id':first}), content_type='application/json').status_code,200)
        profile=Profile.objects.get(user=self.user)
        self.assertEqual((profile.theme_de_id,profile.theme_en_id),(first,first))
        manifest=self.client.get('/api/me/appearance/').json()
        self.assertEqual(manifest['de'],manifest['en'])
        self.assertEqual(manifest['de']['preferences'],{})
        self.assertIn(f'/themes/{first}/image/',manifest['de']['background_url'])
        image_path=Theme.objects.get(pk=first).background_image.path
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(f'/api/me/backgrounds/{first}/').status_code,200)
        self.assertFalse(Path(image_path).exists())
        self.assertTrue(Theme.objects.filter(pk=second).exists())
        self.assertIsNone(self.client.get('/api/me/backgrounds/').json()['selected'])

    def test_legacy_images_are_preserved_without_visual_preferences(self):
        from users.models import Theme
        self.client.post('/api/me/background/',{'image':PracticeMediaTests.image(self)})
        rows=self.client.get('/api/me/backgrounds/').json()['images']
        self.assertEqual(rows[0]['id'],0)
        item=Theme.objects.create(owner=self.user,name='Legacy',preferences={'interface':'glass'})
        item.background_image.save('legacy.png',PracticeMediaTests.image(self))
        Profile.objects.filter(user=self.user).update(theme_de=item)
        manifest=self.client.get('/api/me/appearance/').json()
        self.assertEqual(manifest['de']['preferences'],{})
        self.assertEqual(manifest['de'],manifest['en'])
        self.assertEqual(len(self.client.get('/api/me/backgrounds/').json()['images']),2)

    def test_reset_uses_code_background_without_deleting_images(self):
        pk=self.upload().json()['id']
        response=self.client.post('/api/me/backgrounds/select/',json.dumps({'id':None}),content_type='application/json')
        self.assertEqual(response.status_code,200)
        self.assertEqual(self.client.get('/api/me/appearance/').json()['de']['background_url'],'')
        self.assertEqual(len(self.client.get('/api/me/backgrounds/').json()['images']),1)
        self.client.post('/api/me/backgrounds/select/',json.dumps({'id':pk}),content_type='application/json')
        self.assertIn(f'/themes/{pk}/image/',self.client.get('/api/me/appearance/').json()['en']['background_url'])

    def test_upload_validation_and_csrf(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.assertEqual(self.client.post('/api/me/backgrounds/',{}).status_code,400)
        self.assertEqual(self.client.post('/api/me/backgrounds/',{'image':SimpleUploadedFile('bad.png',b'bad','image/png')}).status_code,400)
        png=PracticeMediaTests.image(self).read()
        large=png+b'\0'*(30*1024*1024-len(png))
        self.assertEqual(self.client.post('/api/me/backgrounds/',{'image':SimpleUploadedFile('large.png',large,'image/png')}).status_code,201)
        self.assertEqual(self.client.post('/api/me/backgrounds/',{'image':SimpleUploadedFile('large.png',large+b'x','image/png')}).status_code,400)
        strict=Client(enforce_csrf_checks=True);strict.force_login(self.user)
        self.assertEqual(strict.post('/api/me/backgrounds/',{}).status_code,403)
        self.assertEqual(Client().get('/api/me/backgrounds/').status_code,401)
        for value in (True,-1,'1'):
            self.assertEqual(self.client.post('/api/me/backgrounds/select/',json.dumps({'id':value}),content_type='application/json').status_code,400)

    def test_login_cache_identity_is_stable_until_new_login(self):
        self.user.set_password('Testing!883392');self.user.save();self.client.force_login(self.user)
        first=self.client.get('/api/session/').json()['user']['appearance_session']
        self.assertEqual(first,self.client.get('/api/session/').json()['user']['appearance_session'])
        self.client.delete('/api/session/')
        response=self.client.post('/api/session/',json.dumps({'username':self.user.username,'password':'Testing!883392'}),content_type='application/json')
        second=response.json()['user']['appearance_session']
        self.assertNotEqual(first,second)
        self.assertEqual(second,self.client.get('/api/session/').json()['user']['appearance_session'])


class ServerMonitoringAndSkipTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('skip-learner')
        self.deck=Deck.objects.create(owner=self.user,title='Skip deck',language='en')
        self.card=Card.objects.create(deck=self.deck,german_text='house',vietnamese_meaning='nhà')
        self.client.force_login(self.user)

    def test_server_report_requires_secret_not_user_or_csrf_session(self):
        from content.models import BackendCheck
        payload=json.dumps({'checks':[{'token':str(uuid.uuid4()),'at':timezone.now().isoformat(),'ok':True,'latency_ms':3,'error':''}]})
        with self.settings(BACKEND_MONITOR_SECRET='server-test-secret'):
            self.assertEqual(self.client.post('/api/monitor/',payload,content_type='application/json').status_code,403)
            server=Client(enforce_csrf_checks=True)
            self.assertEqual(server.post('/api/monitor/',payload,content_type='application/json',HTTP_X_WORTIFY_MONITOR_KEY='wrong').status_code,403)
            self.assertEqual(server.post('/api/monitor/',payload,content_type='application/json',HTTP_X_WORTIFY_MONITOR_KEY='server-test-secret').status_code,200)
            self.assertIsNone(BackendCheck.objects.get().user_id)
            self.assertEqual(BackendCheck.objects.get().source,'frontend-server')
        with self.settings(BACKEND_MONITOR_SECRET=''):
            self.assertEqual(server.post('/api/monitor/',payload,content_type='application/json').status_code,403)

    def test_skipped_sessions_save_as_incorrect_once_and_allow_finish(self):
        for kind in ('flash','learn','test'):
            created=self.client.post('/api/en/sessions/',json.dumps({'deck':self.deck.pk,'kind':kind,'count':1}),content_type='application/json')
            self.assertEqual(created.status_code,201,created.content)
            session=created.json();question=session['questions'][0]
            payload={'answers':{question['token']:'__wortify_skipped__'},'timings':{question['token']:1000}}
            url=f"/api/en/sessions/{session['token']}/finish/"
            result=self.client.post(url,json.dumps(payload),content_type='application/json')
            self.assertEqual(result.status_code,200,result.content)
            self.assertEqual(result.json()['result']['correct'],0)
            self.assertTrue(result.json()['result']['rows'][0]['skipped'])
            progress=StudyProgress.objects.get(user=self.user,card=self.card)
            incorrect=progress.incorrect_count
            self.assertEqual(self.client.post(url,json.dumps(payload),content_type='application/json').status_code,200)
            progress.refresh_from_db();self.assertEqual(progress.incorrect_count,incorrect)
            self.assertEqual(progress.correct_count,0)

    def test_individual_skip_reveals_correct_answer_without_awarding_success(self):
        created=self.client.post('/api/en/sessions/',json.dumps({'deck':self.deck.pk,'kind':'learn','count':1}),content_type='application/json').json()
        result=self.client.post(f"/api/en/sessions/{created['token']}/answer/",json.dumps({'question':created['questions'][0]['token'],'answer':'__wortify_skipped__','response_ms':1500}),content_type='application/json')
        self.assertEqual(result.status_code,200,result.content)
        self.assertFalse(result.json()['feedback']['is_correct'])
        self.assertEqual(result.json()['feedback']['target'],'house')
