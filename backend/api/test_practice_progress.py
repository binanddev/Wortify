import json
import uuid
from django.test import TestCase
from django.contrib.auth import get_user_model
from practice.models import PracticeNode, PracticeProgress, PracticeAttempt
from cards.models import LearningEvent
from .practice_hub import validate_payload


class PracticeProgressTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('practice-user')
        self.client.force_login(self.user)
        self.node=PracticeNode.objects.create(owner=self.user,language='en',kind='exercise',title='Practice',payload=validate_payload('exercise',{'presentation':{'interaction':'short_answer'},'questions':[{'prompt':'one','accepted_answers':['one']},{'prompt':'two','accepted_answers':['two']}]}))

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
        foreign=PracticeNode.objects.create(owner=other,language='en',kind='exercise',title='Other')
        response=self.post(url,{'ids':[self.node.pk,foreign.pk],'parent':folders[0].pk})
        self.assertEqual(response.status_code,400)
        self.node.refresh_from_db()
        self.assertIsNone(self.node.parent_id)

    def test_reorder_visible_subset_preserves_hidden_siblings(self):
        hidden=PracticeNode.objects.create(owner=self.user,language='en',kind='theory',title='Hidden',position=1)
        last=PracticeNode.objects.create(owner=self.user,language='en',kind='theory',title='Last',position=2)
        result=self.post('/api/en/practice-hub/organize/',{'action':'reorder','ids':[last.pk,self.node.pk]})
        self.assertEqual(result.status_code,200,result.content)
        self.assertEqual(list(PracticeNode.objects.order_by('position').values_list('pk',flat=True)),[last.pk,hidden.pk,self.node.pk])
    def test_group_and_undo_restore_original_location(self):
        url='/api/en/practice-hub/organize/'
        response=self.post(url,{'action':'group','ids':[self.node.pk],'title':'My group'})
        self.assertEqual(response.status_code,200,response.content)
        response=self.post(url,{'action':'restore','ids':[self.node.pk],'placements':[{'id':self.node.pk,'parent':None,'position':0}]})
        self.assertEqual(response.status_code,200,response.content)
        self.node.refresh_from_db()
        self.assertIsNone(self.node.parent_id)
