import json
from copy import deepcopy
from pathlib import Path
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from cards.models import Deck, Card, Folder
from practice.models import SystemContentPackage, PackageReceipt, ReadingLesson, ReadingFolder, PracticeNode


class ContentPackageTests(TestCase):
    def setUp(self):
        User=get_user_model()
        self.staff=User.objects.create_user('staff',is_staff=True)
        self.learner=User.objects.create_user('learner')
        self.client.force_login(self.staff)
        self.data=json.loads((Path(__file__).resolve().parents[1]/'sample_data'/'content-package.json').read_text(encoding='utf-8'))

    def upload(self,data=None,**options):
        return self.client.post('/api/manage/content-packages/',{'file':SimpleUploadedFile('package.json',json.dumps(data or self.data).encode()),**options})

    def test_preview_creates_nothing_and_import_preserves_tree(self):
        response=self.upload(preview='true'); self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['counts']['exercise'],1)
        self.assertEqual(SystemContentPackage.objects.count(),0)
        response=self.upload(confirm='IMPORT');self.assertEqual(response.status_code,201,response.content)
        self.assertEqual(Deck.objects.count(),0)
        self.assertEqual(ReadingLesson.objects.get(owner=self.staff).folder.title,'Bài đọc')
        self.assertEqual(PracticeNode.objects.filter(owner=self.staff,kind='exercise').get().parent.title,'Bài tập giao thông')

    def test_retry_does_not_duplicate_and_changed_id_is_rejected(self):
        self.assertEqual(self.upload(confirm='IMPORT').status_code,201)
        self.assertTrue(self.upload(confirm='IMPORT').json()['already_imported'])
        self.assertEqual(Deck.objects.count(),0)
        self.data['title']='Changed'
        self.assertEqual(self.upload(confirm='IMPORT').status_code,400)

    def test_public_library_has_system_identity_and_independent_copy(self):
        self.upload(confirm='IMPORT'); self.client.force_login(self.learner)
        catalog=self.client.get('/api/de/system-library/').json()
        self.assertEqual(catalog['packages'][0]['publisher'],'Wortify')
        self.assertNotIn('staff',json.dumps(catalog))
        endpoint=f'/api/de/system-library/{self.data["id"]}/copy/'
        response=self.client.post(endpoint,{},content_type='application/json');self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(Deck.objects.filter(owner=self.learner).count(),0)
        self.assertTrue(self.client.post(endpoint,{},content_type='application/json').json()['already_imported'])
        self.assertEqual(ReadingLesson.objects.filter(owner=self.learner).count(),1)
        self.assertEqual(self.client.post(endpoint.replace('/de/','/en/'),{},content_type='application/json').status_code,404)

    def test_only_staff_can_publish_and_confirmation_required(self):
        self.assertEqual(self.upload().status_code,400)
        self.client.force_login(self.learner)
        self.assertEqual(self.upload(confirm='IMPORT').status_code,403)

    def test_invalid_last_node_rolls_back_everything(self):
        self.data['reading'][0]['children'][0]['payload']['questions'][0]['accepted_answers']=['not an option']
        self.assertEqual(self.upload(confirm='IMPORT').status_code,400)
        self.assertEqual(Folder.objects.count(),0)
        self.assertEqual(SystemContentPackage.objects.count(),0)

    def test_many_folders_allow_same_name_in_different_branches(self):
        template=self.data['practice'][0]
        self.data['practice']=[{**deepcopy(template),'title':f'Topic {i}'} for i in range(120)]
        result=self.upload(confirm='IMPORT');self.assertEqual(result.status_code,201,result.content)
        self.assertEqual(PracticeNode.objects.filter(owner=self.staff,kind='exercise').count(),120)
        self.assertEqual(Deck.objects.count(),0)

    def test_depth_and_invalid_flashcards_rejected(self):
        node={'kind':'folder','title':'leaf','children':[]}
        for i in range(10):node={'kind':'folder','title':str(i),'children':[node]}
        data=deepcopy(self.data);data['practice']=[node]
        self.assertEqual(self.upload(data,confirm='IMPORT').status_code,400)
        for value in ({}, [{'kind':'deck','title':'Missing cards'}]):
            data=deepcopy(self.data);data['flashcards']=value
            self.assertEqual(self.upload(data,confirm='IMPORT').status_code,400)
        self.assertEqual(SystemContentPackage.objects.count(),0)

    def test_library_survives_uploader_deletion(self):
        self.upload(confirm='IMPORT');self.staff.delete();self.client.force_login(self.learner)
        self.assertEqual(len(self.client.get('/api/de/system-library/').json()['packages']),1)
        self.assertEqual(self.client.post(f'/api/de/system-library/{self.data["id"]}/copy/',{},content_type='application/json').status_code,200)
