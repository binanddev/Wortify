import json, uuid
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.utils import timezone
from cards.models import Deck, Card, LearningEvent, StudyProgress
from practice.models import PracticeNode, PracticeAttempt
from users.models import Classroom, ClassroomAssignment
from .practice_hub import validate_payload


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

    def test_practice_is_graded_and_saved_once(self):
        node=PracticeNode.objects.create(owner=self.user,language='en',kind='exercise',title='Greeting',payload=validate_payload('exercise',{'presentation':{'interaction':'short_answer'},'questions':[{'prompt':'Xin chào','accepted_answers':['hello']}]}))
        event=self.event('practice',node=node.pk,revision=node.updated_at.isoformat(),answers={'1':'hello'})
        result=self.sync([event]);self.assertEqual(result['accepted'][0]['result']['score'],1)
        self.sync([event]);self.assertEqual(PracticeAttempt.objects.count(),1)
        self.assertEqual(self.client.get('/api/en/profile/').json()['history'][0]['score'],1)

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
