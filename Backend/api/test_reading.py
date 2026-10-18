from copy import deepcopy
from unittest.mock import patch
from django.utils.dateparse import parse_datetime
from django.test import TestCase
from django.contrib.auth import get_user_model
from api.practice_hub import validate_payload
from practice.models import PracticeNode, ReadingLesson

class ReadingTests(TestCase):
    def setUp(self):
        self.payload = {'kind':'choice','context':'<h2>Garden</h2><p>We grow carrots and tomatoes.</p>', 'presentation':{'interaction':'reading','style':'split_reading','context_format':'html'}, 'questions':[{'prompt':'What grows here?','options':['Carrots','Tomatoes','Rice'],'accepted_answers':['Carrots','Tomatoes']},{'prompt':'Does rice grow here?','options':['Yes','No'],'accepted_answers':['No']}]}
    def test_mixed_question_types(self):
        cleaned = validate_payload('exercise',deepcopy(self.payload))
        self.assertEqual([q['kind'] for q in cleaned['questions']],['multi','choice'])
    def test_invalid_payloads(self):
        for context in ('', 1, 'x'*100001):
            with self.assertRaises(ValueError): validate_payload('exercise',{**deepcopy(self.payload),'context':context})
        data=deepcopy(self.payload);data['questions'][0]['accepted_answers']=['Missing']
        with self.assertRaises(ValueError): validate_payload('exercise',data)
    def test_create_and_reload(self):
        owner=get_user_model().objects.create_user('reading-owner')
        self.client.force_login(owner)
        folder=PracticeNode.objects.create(owner=owner,language='en',title='Reading',kind='folder')
        response=self.client.post('/api/en/reading/',{'lessons':[{'title':'Garden','payload':self.payload}]},content_type='application/json')
        self.assertEqual(response.status_code,201,response.content)
        node=ReadingLesson.objects.get(pk=response.json()['lessons'][0]['id'])
        self.assertEqual(node.payload['questions'][0]['kind'],'multi')
        self.assertIn('<h2>',node.payload['context'])

    def test_scope_progress_revision_and_edit(self):
        owner=get_user_model().objects.create_user('reader-one')
        other=get_user_model().objects.create_user('reader-two')
        self.client.force_login(owner)
        created=self.client.post('/api/en/reading/',{'lessons':[{'title':'Garden','payload':self.payload}]},content_type='application/json').json()['lessons'][0]
        url=f"/api/en/reading/{created['id']}/"
        self.assertEqual(self.client.get(url.replace('/en/','/de/')).status_code,404)
        self.assertEqual(self.client.post(url,{'revision':created['revision'],'completed':['1']},content_type='application/json').status_code,200)
        self.assertEqual(self.client.get(url).json()['progress']['completed'],['1'])
        self.assertEqual(self.client.post(url,{'revision':created['revision'],'completed':['999']},content_type='application/json').status_code,400)
        with patch('django.utils.timezone.now',return_value=parse_datetime(created['revision'])):
            edited=self.client.patch(url,{'revision':created['revision'],'payload':self.payload,'title':'New title'},content_type='application/json')
        self.assertEqual(edited.status_code,200)
        self.assertEqual(edited.json()['progress']['completed'],[])
        self.assertEqual(self.client.post(url,{'revision':created['revision'],'completed':['1']},content_type='application/json').status_code,409)
        self.client.force_login(other)
        self.assertEqual(self.client.get(url).status_code,404)
        self.assertEqual(self.client.delete(url).status_code,404)

    def test_backup_preserves_reading(self):
        from api.backups import export_archive, read_archive, restore_archive
        from django.core.files.uploadedfile import SimpleUploadedFile
        owner=get_user_model().objects.create_user('reading-backup')
        target=get_user_model().objects.create_user('reading-restore')
        ReadingLesson.objects.create(owner=owner,language='en',title='Garden',payload=validate_payload('exercise',deepcopy(self.payload)),completed=['1'])
        stream=export_archive(owner)
        archive,records=read_archive(SimpleUploadedFile('backup.zip',stream.read()))
        try: restore_archive(target,archive,records,True)
        finally: archive.close();stream.close()
        restored=ReadingLesson.objects.get(owner=target)
        self.assertEqual(restored.completed,['1'])
        self.assertEqual(restored.payload['questions'][0]['kind'],'multi')

    def test_batch_atomicity(self):
        owner=get_user_model().objects.create_user('reading-batch')
        self.client.force_login(owner)
        result=self.client.post('/api/en/reading/',{'lessons':[{'title':'Valid','payload':self.payload},{'title':'Invalid','payload':{}}]},content_type='application/json')
        self.assertEqual(result.status_code,400)
        self.assertFalse(ReadingLesson.objects.filter(owner=owner).exists())
