import uuid
from copy import deepcopy
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.contrib.admin.models import LogEntry
from django.utils import timezone
from cards.models import Card, Deck, DeckLearningState, StudyProgress, Folder
from content.models import ContentPolicy
from practice.models import ReadingLesson, ReadingProgress, PracticeNode
from users.models import Profile
from .content_merge import publisher


class StaffWorkspaceTests(TestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user('staff-editor', is_staff=True)
        self.other = get_user_model().objects.create_user('second-editor', is_staff=True)
        self.learner = get_user_model().objects.create_user('learner')
        self.client.force_login(self.staff)
        self.second = Client(); self.second.force_login(self.other)
        self.shared = publisher(create=True)
        self.deck = Deck.objects.create(owner=self.shared,language='de',title='Shared deck',visibility='public')
        self.card = Card.objects.create(deck=self.deck,german_text='Bus',vietnamese_meaning='xe buýt')

    def revision(self, client=None, path='/api/de/decks/'):
        response = (client or self.client).get(path)
        self.assertEqual(response.status_code,200,response.content)
        return response.headers['X-Wortify-Revision']

    def test_import_and_normal_library_share_same_objects(self):
        doc={'format':'wortify-content','version':1,'id':str(uuid.uuid4()),'title':'Batch','language':'de','mode':'append','flashcards':[{'kind':'deck','title':'Imported','cards':[{'german_text':'Zug','vietnamese_meaning':'tàu'}]}]}
        url='/api/manage/content-packages/?section=flashcards&language=de'
        # The import API accepts the JSON package through text, matching the actual UI.
        import json
        preview=self.client.post(url,{'text':json.dumps(doc),'preview':True},content_type='application/json')
        self.assertEqual(preview.status_code,200,preview.content)
        result=self.client.post(url,{'text':json.dumps(doc),'confirm':'IMPORT','preview_token':preview.json()['preview_token']},content_type='application/json')
        self.assertEqual(result.status_code,201,result.content)
        expected=set(Deck.objects.filter(owner=self.shared).values_list('id',flat=True))
        for client in (self.client,self.second):
            self.assertEqual({d['id'] for d in client.get('/api/de/decks/').json()['decks']},expected)
        self.assertFalse(Deck.objects.filter(owner=self.staff).exists())

    def test_native_edit_changes_shared_content_and_preserves_actor(self):
        rev=self.revision(path=f'/api/de/decks/{self.deck.pk}/')
        response=self.client.patch(f'/api/de/decks/{self.deck.pk}/cards/{self.card.pk}/',{'german_text':'Bus','vietnamese_meaning':'autobus'},content_type='application/json',HTTP_X_WORTIFY_REVISION=rev)
        self.assertEqual(response.status_code,200,response.content)
        self.card.refresh_from_db();self.assertEqual(self.card.vietnamese_meaning,'autobus')
        self.assertTrue(LogEntry.objects.filter(user=self.staff,change_message__contains='Wortify flashcards').exists())
        self.assertEqual(self.second.get(f'/api/de/decks/{self.deck.pk}/').json()['cards'][0]['vietnamese_meaning'],'autobus')

    def test_stale_and_missing_revisions_do_not_overwrite(self):
        old=self.revision();new=self.revision(client=self.second)
        url=f'/api/de/decks/{self.deck.pk}/'
        self.assertEqual(self.second.patch(url,{'title':'Second editor'},content_type='application/json',HTTP_X_WORTIFY_REVISION=new).status_code,200)
        for headers in ({'HTTP_X_WORTIFY_REVISION':old},{}):
            response=self.client.patch(url,{'title':'Stale title'},content_type='application/json',**headers)
            self.assertEqual(response.status_code,409,response.content)
        self.deck.refresh_from_db();self.assertEqual(self.deck.title,'Second editor')

    def test_creation_shared_and_private_sandbox_override_global_policy(self):
        ContentPolicy.objects.update_or_create(pk=1,defaults={'mode':'public'})
        payload={'title':'New','level':'A1','visibility':'private'}
        created=self.client.post('/api/de/decks/',payload,content_type='application/json')
        self.assertEqual(created.status_code,201,created.content)
        shared=Deck.objects.get(pk=created.json()['id']);self.assertEqual(shared.owner,self.shared);self.assertEqual(shared.visibility,'public')
        response=self.client.post('/api/de/decks/',{**payload,'title':'Sandbox','visibility':'public'},content_type='application/json',HTTP_X_WORTIFY_WORKSPACE='personal')
        self.assertEqual(response.status_code,201,response.content)
        personal=Deck.objects.get(pk=response.json()['id']);self.assertEqual(personal.owner,self.staff);self.assertEqual(personal.visibility,'private')
        self.assertEqual(self.client.get(f'/api/de/decks/{personal.pk}/export/json/?workspace=personal').status_code,200)
        self.assertEqual(self.client.get(f'/api/de/decks/{personal.pk}/export/json/').status_code,404)
        self.assertNotIn(personal.pk,[d['id'] for d in self.client.get('/api/de/decks/').json()['decks']])
        self.assertIn(personal.pk,[d['id'] for d in self.client.get('/api/de/decks/',HTTP_X_WORTIFY_WORKSPACE='personal').json()['decks']])
        self.assertNotIn('Sandbox',[d['title'] for d in self.client.get('/api/de/flashcard/discover/').json()['results']])

    def test_normal_user_cannot_spoof_shared_workspace_or_other_private_owner(self):
        self.client.force_login(self.learner)
        headers={'HTTP_X_WORTIFY_WORKSPACE':'shared'}
        self.assertEqual(self.client.get('/api/de/decks/',**headers).json()['decks'],[])
        self.assertEqual(self.client.get(f'/api/de/decks/{self.deck.pk}/',**headers).status_code,404)
        self.assertEqual(self.client.patch(f'/api/de/decks/{self.deck.pk}/',{'title':'No'},content_type='application/json',**headers).status_code,404)
        personal=Deck.objects.create(owner=self.other,language='de',title='Other private')
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get(f'/api/de/decks/{personal.pk}/').status_code,404)
        self.assertEqual(self.client.get(f'/api/en/decks/{self.deck.pk}/').status_code,404)

    def test_shared_progress_and_star_remain_per_staff_even_after_switch(self):
        event={'token':str(uuid.uuid4()),'at':timezone.now().isoformat(),'kind':'review','payload':{'deck':self.deck.pk,'card':self.card.pk,'correct':True,'type':'written'}}
        url='/api/de/learning/sync/'
        result=self.client.post(url,{'events':[event]},content_type='application/json',HTTP_X_WORTIFY_WORKSPACE='personal')
        self.assertEqual(result.json()['errors'],[],result.content)
        self.assertTrue(StudyProgress.objects.filter(user=self.staff,card=self.card).exists())
        self.assertFalse(StudyProgress.objects.filter(user=self.shared).exists())
        self.assertEqual(self.second.get(f'/api/de/decks/{self.deck.pk}/').json()['learning']['progress'],{})
        self.assertEqual(self.client.post(url,{'events':[event]},content_type='application/json').json()['errors'],[])
        self.assertEqual(StudyProgress.objects.filter(user=self.staff,card=self.card).count(),1)
        self.staff.is_staff=False;self.staff.save()
        event['token']=str(uuid.uuid4())
        self.assertTrue(self.client.post(url,{'events':[event]},content_type='application/json').json()['errors'])

    def test_reading_learning_is_personal_and_revision_aware(self):
        from .practice_hub import validate_payload
        payload=validate_payload('exercise',{'kind':'choice','context':'The bus is red.','presentation':{'interaction':'reading'},'questions':[{'prompt':'What colour?','options':['Red','Blue'],'accepted_answers':['Red']}]})
        lesson=ReadingLesson.objects.create(owner=self.shared,language='de',title='Bus',visibility='public',payload=payload)
        url=f'/api/de/reading/{lesson.pk}/'
        initial=self.client.get(url).json()
        response=self.client.post(url,{'revision':initial['revision'],'completed':['1']},content_type='application/json')
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(self.client.get(url).json()['progress']['completed'],['1'])
        self.assertEqual(self.second.get(url).json()['progress']['completed'],[])
        lesson.refresh_from_db();self.assertEqual(lesson.completed,[])
        lesson.title='Changed';lesson.save()
        self.assertEqual(self.client.get(url).json()['progress']['completed'],[])
        self.assertEqual(self.client.post(url,{'revision':initial['revision'],'completed':['1']},content_type='application/json').status_code,409)

    def test_shared_practice_can_edit_but_keeps_progress_personal(self):
        folder=PracticeNode.objects.create(owner=self.shared,language='de',kind='folder',title='Grammar',visibility='public')
        rows=self.client.get('/api/de/practice-hub/nodes/').json()['nodes']
        self.assertTrue(next(n for n in rows if n['id']==folder.pk)['can_edit'])
        rev=self.revision(path='/api/de/practice-hub/nodes/')
        response=self.client.patch(f'/api/de/practice-hub/nodes/{folder.pk}/',{'title':'Grammar A1'},content_type='application/json',HTTP_X_WORTIFY_REVISION=rev)
        self.assertEqual(response.status_code,200,response.content)
        folder.refresh_from_db();self.assertEqual(folder.title,'Grammar A1')
        personal=PracticeNode.objects.create(owner=self.staff,language='de',kind='folder',title='Private')
        ids=[n['id'] for n in self.client.get('/api/de/practice-hub/nodes/').json()['nodes']]
        self.assertNotIn(personal.pk,ids)

    def test_sessions_and_study_queue_use_shared_cards_with_real_user(self):
        response=self.client.post('/api/de/sessions/',{'deck':self.deck.pk,'kind':'flash','count':1},content_type='application/json')
        self.assertEqual(response.status_code,201,response.content)
        self.assertEqual(response.json()['total'],1)
        self.assertEqual(self.client.get('/api/de/study-pack/').json()['cards'][0]['id'],self.card.pk)
        from cards.models import StudySession, StudyAttempt
        session=StudySession.objects.get();self.assertEqual(session.user,self.staff)
        self.assertEqual(StudyAttempt.objects.get().user,self.staff)

    def test_staff_theme_is_studio_on_login_and_sync(self):
        profile,_=Profile.objects.get_or_create(user=self.staff)
        profile.preferences={'interface':'xp','appearanceSelections':{'default':{'interface':'glass'}}};profile.save()
        self.assertEqual(self.client.get('/api/session/').json()['user']['preferences']['interface'],'studio')
        event={'token':str(uuid.uuid4()),'at':timezone.now().isoformat(),'kind':'preferences','payload':{'interface':'retro','appearanceSelections':{'default':{'interface':'xp'}}}}
        response=self.client.post('/api/de/learning/sync/',{'events':[event]},content_type='application/json')
        self.assertEqual(response.json()['errors'],[],response.content)
        profile.refresh_from_db();self.assertEqual(profile.preferences['interface'],'studio')
        self.assertEqual(profile.preferences['appearanceSelections']['default']['interface'],'studio')
        self.client.force_login(self.learner)
        profile,_=Profile.objects.get_or_create(user=self.learner);profile.preferences={'interface':'glass'};profile.save()
        self.assertEqual(self.client.get('/api/session/').json()['user']['preferences']['interface'],'glass')

    def test_legacy_matching_round_is_owned_by_actual_staff(self):
        from cards.models import StudyAttempt, MatchRound
        Card.objects.create(deck=self.deck,german_text='Zug',vietnamese_meaning='train')
        response=self.client.post(f'/api/de/match/{self.deck.pk}/new/',{},content_type='application/json')
        self.assertEqual(response.status_code,200,response.content)
        match=MatchRound.objects.get(token=response.json()['token'])
        self.assertEqual(set(StudyAttempt.objects.values_list('user_id',flat=True)),{self.staff.pk})
        pairs={pair['id']:str(i) for i,pair in enumerate(match.pairs)}
        url=f'/api/de/match/{match.token}/submit/'
        self.assertEqual(self.second.post(url,{'pairs':pairs},content_type='application/json').status_code,404)
        result=self.client.post(url,{'pairs':pairs},content_type='application/json')
        self.assertEqual(result.status_code,200,result.content)
        self.assertFalse(StudyProgress.objects.filter(user=self.shared).exists())
        self.assertEqual(StudyProgress.objects.filter(user=self.staff).count(),2)

    def test_same_clock_tick_native_edit_invalidates_shared_revision(self):
        from unittest.mock import patch
        old=self.revision(path=f'/api/de/decks/{self.deck.pk}/')
        with patch('django.utils.timezone.now',return_value=self.deck.updated_at):
            result=self.client.patch(f'/api/de/decks/{self.deck.pk}/',{'title':'Renamed'},content_type='application/json',HTTP_X_WORTIFY_REVISION=old)
        self.assertEqual(result.status_code,200,result.content)
        self.deck.refresh_from_db();self.assertNotEqual(result.headers['X-Wortify-Revision'],old)

    def test_discover_continue_links_follow_selected_workspace(self):
        source=Deck.objects.create(owner=self.learner,language='de',title='Community deck',visibility='public')
        copied=Deck.objects.create(owner=self.staff,language='de',title='Sandbox copy',source_deck=source)
        shared={row['id']:row for row in self.client.get('/api/de/flashcard/discover/').json()['results']}
        self.assertEqual(shared[self.deck.pk]['saved_id'],self.deck.pk)
        self.assertIsNone(shared[source.pk]['saved_id'])
        personal={row['id']:row for row in self.client.get('/api/de/flashcard/discover/',HTTP_X_WORTIFY_WORKSPACE='personal').json()['results']}
        self.assertEqual(personal[source.pk]['saved_id'],copied.pk)
        shared_lesson=ReadingLesson.objects.create(owner=self.shared,language='de',title='Shared reading',visibility='public')
        source_lesson=ReadingLesson.objects.create(owner=self.learner,language='de',title='Community reading',visibility='public')
        personal_lesson=ReadingLesson.objects.create(owner=self.staff,language='de',title='Private copy',source_key=f'community:{source_lesson.pk}')
        shared_rows={row['key']:row for row in self.client.get('/api/de/reading/discover/').json()['lessons']}
        self.assertEqual(shared_rows[f'community:{shared_lesson.pk}']['saved_id'],shared_lesson.pk)
        self.assertEqual(self.client.post('/api/de/reading/discover/save/',{'key':f'community:{shared_lesson.pk}'},content_type='application/json').json()['id'],shared_lesson.pk)
        self.assertIsNone(shared_rows[f'community:{source_lesson.pk}']['saved_id'])
        personal_rows={row['key']:row for row in self.client.get('/api/de/reading/discover/',HTTP_X_WORTIFY_WORKSPACE='personal').json()['lessons']}
        self.assertEqual(personal_rows[f'community:{source_lesson.pk}']['saved_id'],personal_lesson.pk)
