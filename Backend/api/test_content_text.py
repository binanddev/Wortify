import json
from pathlib import Path
from copy import deepcopy
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from api.content_text import parse_package, parse_lesson
from api.content_packages import validate_document
from api.practice_hub import validate_payload
from practice.models import SystemContentPackage, ReadingLesson

SAMPLES = Path(__file__).resolve().parents[1] / 'sample_data'

class ContentTextTests(TestCase):
    def setUp(self):
        self.text = (SAMPLES/'content-package.txt').read_text(encoding='utf-8')
        self.staff = get_user_model().objects.create_user('text-staff',is_staff=True)
        self.client.force_login(self.staff)
        self.key = self.client.post('/api/manage/import-api/',{},content_type='application/json').json()['key']
        self.bot = Client(enforce_csrf_checks=True)

    def send(self, text=None, **fields):
        return self.bot.post('/api/import/content/',{'text':text or self.text,**fields},content_type='application/json',HTTP_AUTHORIZATION='Bearer '+self.key)

    def test_all_editor_templates_have_equivalent_backend_payloads(self):
        for case in json.loads((SAMPLES/'content-text-cases.json').read_text(encoding='utf-8')):
            with self.subTest(mode=case['mode'],style=case['style']):
                result = parse_lesson(list(enumerate(case['text'].splitlines(),1)))
                expected = validate_payload('exercise',deepcopy(case['payload']))
                # Frontend adds type-independent empty context and field ordering only.
                for key in ('questions','presentation','kind','title','instruction','ignore_case','ignore_punctuation'):
                    self.assertEqual(result.get(key), expected.get(key))

    def test_preview_publish_retry_and_public_discovery(self):
        self.assertEqual(self.send(confirm='IMPORT').status_code,400)
        response=self.send(preview=True)
        self.assertEqual(response.status_code,200,response.content)
        preview=response.json()
        self.assertEqual(preview['counts']['reading'],1)
        self.assertEqual(preview['counts']['exercise'],1)
        self.assertEqual(SystemContentPackage.objects.count(),0)
        changed=self.text.replace('A2 Travel','Different title')
        self.assertEqual(self.send(changed,confirm='IMPORT',preview_token=preview['preview_token']).status_code,400)
        response=self.send(confirm='IMPORT',preview_token=preview['preview_token'])
        self.assertEqual(response.status_code,201,response.content)
        self.assertEqual(response.json()['visibility'],'public')
        self.assertEqual(self.send(confirm='IMPORT',preview_token=preview['preview_token']).status_code,200)
        self.assertEqual(SystemContentPackage.objects.count(),1)
        self.assertEqual(ReadingLesson.objects.filter(owner=self.staff).count(),1)
        learner=get_user_model().objects.create_user('text-reader')
        self.client.force_login(learner)
        self.assertEqual(self.client.get('/api/en/reading/discover/').json()['total'],1)
        self.assertEqual(len(self.client.get('/api/en/system-library/').json()['packages']),1)

    def test_file_raw_and_same_parser(self):
        raw=self.bot.post('/api/import/content/?preview=true',self.text,content_type='text/plain',HTTP_AUTHORIZATION='Bearer '+self.key)
        file=self.client.post('/api/manage/content-packages/',{'file':SimpleUploadedFile('mixed.txt',self.text.encode()),'preview':'true'})
        self.assertEqual(raw.status_code,200,raw.content)
        self.assertEqual(file.status_code,200,file.content)
        self.assertEqual(raw.json()['digest'],file.json()['digest'])
        result=self.bot.post('/api/import/content/?confirm=IMPORT',self.text,content_type='text/plain',HTTP_AUTHORIZATION='Bearer '+self.key,HTTP_X_WORTIFY_PREVIEW=raw.json()['preview_token'])
        self.assertEqual(result.status_code,201,result.content)

    def test_token_bound_to_staff_and_expiry(self):
        from unittest.mock import patch
        import time
        token=self.send(preview=True).json()['preview_token']
        second=get_user_model().objects.create_user('second-staff',is_staff=True)
        self.client.force_login(second)
        other=self.client.post('/api/manage/import-api/',{},content_type='application/json').json()['key']
        response=self.bot.post('/api/import/content/',{'text':self.text,'confirm':'IMPORT','preview_token':token},content_type='application/json',HTTP_AUTHORIZATION='Bearer '+other)
        self.assertEqual(response.status_code,400)
        with patch('django.core.signing.time.time',return_value=time.time()+90000):
            self.assertEqual(self.send(confirm='IMPORT',preview_token=token).status_code,400)
        self.assertEqual(SystemContentPackage.objects.count(),0)

    def test_large_tree_and_atomic_invalid_tail(self):
        header=self.text.split('SECTION:')[0]
        lesson='EXERCISE: Item {i}\nTYPE: short_answer\nSTYLE: sentence_rewrite\nQUESTION: Say yes.\nANSWER: Yes\n'
        large=header+'SECTION: practice\n'+''.join(f'FOLDER: Root/Group {i}/Child\n'+lesson.format(i=i) for i in range(150))
        preview=self.send(large,preview=True)
        self.assertEqual(preview.status_code,200,preview.content)
        self.assertEqual(preview.json()['counts']['exercise'],150)
        self.assertEqual(preview.json()['counts']['practice_folders'],301)
        broken=large+'EXERCISE: Broken\nTYPE: unknown\nQUESTION: Bad\nANSWER: Bad\n'
        response=self.send(broken,preview=True)
        self.assertEqual(response.status_code,400)
        self.assertIn('Line ',response.json()['error'])
        self.assertEqual(SystemContentPackage.objects.count(),0)
        published=self.send(large,confirm='IMPORT',preview_token=preview.json()['preview_token'])
        self.assertEqual(published.status_code,201,published.content)
        from practice.models import PracticeNode
        self.assertEqual(PracticeNode.objects.filter(owner=self.staff,kind='exercise').count(),150)

    def test_theory_continuation_and_invalid_directives(self):
        text=self.text+'SECTION: practice\nFOLDER: Notes\nTHEORY: Tips\nCONTENT: # Heading\n> SECTION: literal text\n> **Bold**\n'
        doc,counts=validate_document(parse_package(text))
        self.assertEqual(counts['theory'],1)
        for bad in (self.text.replace('LEVEL: A2','LEVEL: A9'),self.text.replace('A2/Travel/Transport','../Travel'),self.text.replace('ANSWER: At the ticket office.','ANSWER: Missing'),self.text.replace('SECTION: reading','SECTION: flashcards')):
            with self.assertRaises(ValueError):validate_document(parse_package(bad))

    def test_docs_and_request_limits(self):
        spec=self.client.get('/api/import/openapi/').json()
        self.assertEqual(spec['openapi'],'3.1.0')
        self.assertIn('/api/import/content/',spec['paths'])
        self.assertContains(self.client.get('/api/import/guide/'),'WORTIFY TEXT 1')
        self.assertEqual(self.bot.post('/api/import/content/', 'x'*(8*1024*1024+1),content_type='text/plain',HTTP_AUTHORIZATION='Bearer '+self.key).status_code,400)

    def test_legacy_idempotence_when_optional_defaults_are_added(self):
        import hashlib
        document, counts = validate_document(parse_package(self.text))
        for node in document['reading']:
            for child in node.get('children', []):
                for lesson in child.get('children', []):
                    if lesson.get('kind') == 'reading':
                        lesson.pop('level', None);lesson.pop('topic', None)
        # A real legacy digest may predate added defaults; normalized content
        # must still identify an unchanged retry.
        SystemContentPackage.objects.create(id=document['id'],title=document['title'],language='en',document=document,counts=counts,digest='legacy-digest')
        response=self.client.post('/api/manage/content-packages/',{'file':SimpleUploadedFile('legacy.json',json.dumps(document).encode()),'confirm':'IMPORT'})
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(SystemContentPackage.objects.count(),1)
