import json
import tempfile
from pathlib import Path
from unittest.mock import patch
from django.test import TestCase, Client, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from content.importing import normalize, import_book, save_exercise
from content.models import Book, BookAsset
from practice.models import Chapter, Exercise, Attempt

class ReactMigrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user=get_user_model().objects.create_user('learner',password='OldPass!7294')
        cls.admin=get_user_model().objects.create_superuser('manager','', 'OldPass!7294')
        cls.book=Book.objects.create(slug='json-book',title='JSON book',language='en')
        cls.chapter=Chapter.objects.create(book=cls.book,number=1,title='Unit',page_start=1)
    def setUp(self):self.client.force_login(self.user)
    def test_converter_maps_choices_without_exposing_answer_key(self):
        source={'id':'U1E1','type':'single_choice','instruction':'Choose','items':[{'text':'Pick a word','options':[{'id':'a','text':'house'},{'id':'b','text':'water'}],'answer':'b'}]}
        e,_=save_exercise(self.chapter,source)
        self.assertEqual(e.questions.get().accepted_answers,['water'])
        payload=self.client.get(f'/api/en/books/json-book/exercises/{e.pk}/').json()
        self.assertNotIn('source_document',payload['exercise'])
        self.assertNotIn('accepted_answers',payload['questions'][0])
        self.assertNotIn('answer',payload['questions'][0])
        self.assertEqual(self.client.get(f'/api/de/books/json-book/exercises/{e.pk}/').status_code,404)
    def test_multiple_choices_and_missing_answers(self):
        r=normalize({'type':'multiple_choice','items':[{'text':'Pick','options':['a one','b two','c three'],'answer':['a','c']}]})
        self.assertEqual(r['kind'],'multi');self.assertEqual(r['rows'][0]['accepted_answers'],['a one','c three'])
        r=normalize({'type':'free_text','items':[{'text':'Your opinion','answer':'Example only'}]})
        self.assertEqual(r['check_mode'],'manual_check')
    def test_multi_blank_preserves_independent_answers(self):
        r=normalize({'type':'fill_blank','items':[{'text':'___ und ___','blanks':[{'answer':'eins'},{'answer':['zwei','2']}]}]})
        self.assertEqual(r['rows'][0]['prompt'],'{{1}} und {{2}}')
        self.assertEqual(r['rows'][0]['blanks'],[{'answers':['eins']},{'answers':['zwei','2']}])
    def test_import_is_idempotent_and_preserves_attempt_snapshot(self):
        with tempfile.TemporaryDirectory() as root:
            folder=Path(root)/'EN'/'Book';folder.mkdir(parents=True)
            source={'number':1,'title':'One','exercises':[{'number':'1.1','type':'fill_blank','instruction':'Fill','items':[{'question':'word','answer':'water'}]}]}
            file=folder/'U01.json';file.write_text(json.dumps(source),encoding='utf-8')
            with patch('content.importing.BOOK_ROOT',Path(root)):
                first=import_book('EN/Book');e=Exercise.objects.get(chapter__book_id=first['book'])
                attempt=Attempt.objects.create(user=self.user,exercise=e,session_key='',answers=[{'answer':'water'}],total=1,score=1)
                self.assertEqual(import_book('EN/Book')['updated'],0)
                source['exercises'][0]['items'][0]['answer']='changed';file.write_text(json.dumps(source),encoding='utf-8')
                self.assertEqual(import_book('EN/Book')['updated'],1)
                attempt.refresh_from_db();self.assertEqual(attempt.answers,[{'answer':'water'}])
    def test_non_admin_cannot_manage_or_reset_passwords(self):
        self.assertEqual(self.client.get('/api/manage/users/').status_code,403)
        self.assertEqual(self.client.patch(f'/api/manage/users/{self.admin.pk}/',json.dumps({'password':'Changed!7924'}),content_type='application/json').status_code,403)
        self.assertEqual(self.client.get('/api/manage/books/').status_code,403)
    def test_admin_reset_password_and_self_lock_protection(self):
        self.client.force_login(self.admin)
        response=self.client.patch(f'/api/manage/users/{self.user.pk}/',json.dumps({'password':'Changed!7924'}),content_type='application/json')
        self.assertEqual(response.status_code,200,response.content)
        self.user.refresh_from_db();self.assertTrue(self.user.check_password('Changed!7924'))
        self.assertEqual(self.client.patch(f'/api/manage/users/{self.admin.pk}/',json.dumps({'is_active':False}),content_type='application/json').status_code,400)
    def test_admin_mutation_still_requires_csrf(self):
        c=Client(enforce_csrf_checks=True);c.force_login(self.admin)
        self.assertEqual(c.post('/api/manage/books/',json.dumps({'directory':'EN/Book'}),content_type='application/json').status_code,403)
    def test_upload_validation_and_authenticated_media(self):
        self.client.force_login(self.admin)
        with tempfile.TemporaryDirectory() as directory,override_settings(MEDIA_ROOT=directory):
            png=b'\x89PNG\r\n\x1a\n'+b'\0'*24
            r=self.client.post(f'/api/manage/books/{self.book.pk}/assets/',{'files':SimpleUploadedFile('image.png',png,'image/png'),'keys':json.dumps(['images/image.png'])})
            self.assertEqual(r.status_code,200,r.content)
            asset=BookAsset.objects.get(book=self.book)
            self.client.force_login(self.user)
            response=self.client.get(f'/api/en/book-assets/{asset.pk}/');self.assertEqual(response.status_code,200);response.close()
            self.assertEqual(self.client.get(f'/api/de/book-assets/{asset.pk}/').status_code,404)
            self.client.logout();self.assertEqual(self.client.get(f'/api/en/book-assets/{asset.pk}/').status_code,401)
            self.client.force_login(self.admin)
            r=self.client.post(f'/api/manage/books/{self.book.pk}/assets/',{'files':SimpleUploadedFile('image.png',png),'keys':json.dumps(['../outside.png'])})
            self.assertEqual(r.status_code,400)
            r=self.client.post(f'/api/manage/books/{self.book.pk}/assets/',{'files':SimpleUploadedFile('image.png',b'<script>bad</script>'),'keys':json.dumps(['images/bad.png'])})
            self.assertEqual(r.status_code,400)
    def test_staff_manages_books_but_not_users(self):
        from django.contrib.auth.models import Permission
        staff=get_user_model().objects.create_user('staff',is_staff=True)
        self.client.force_login(staff)
        self.assertEqual(self.client.get('/api/manage/users/').status_code,403)
        self.assertEqual(self.client.get('/api/manage/books/').status_code,200)
    def test_json_upload_preview_confirm_without_source_directory(self):
        from content.ingestion import TEMPLATE
        from copy import deepcopy
        import shutil
        self.client.force_login(self.admin)
        with patch('content.importing.BOOK_ROOT',Path('/path-that-does-not-exist')):
            created=self.client.post('/api/manage/books/',json.dumps({'title':'Uploaded book','language':'en'}),content_type='application/json')
            self.assertEqual(created.status_code,201,created.content)
            book_id=created.json()['id'];source=deepcopy(TEMPLATE)
            response=self.client.post(f'/api/manage/books/{book_id}/json/preview/',{'files':SimpleUploadedFile('unit.json',json.dumps(source).encode(),'application/json')})
            self.assertEqual(response.status_code,200,response.content)
            self.assertFalse(Chapter.objects.filter(book_id=book_id).exists())
            token=response.json()['token'];url=f'/api/manage/books/{book_id}/json/confirm/'
            confirm=self.client.post(url,json.dumps({'token':token}),content_type='application/json')
            self.assertEqual(confirm.status_code,200,confirm.content)
            self.assertEqual(confirm.json()['exercises'],7)
            self.assertEqual(self.client.post(url,json.dumps({'token':token}),content_type='application/json').json(),confirm.json())
            self.assertEqual(Exercise.objects.filter(chapter__book_id=book_id).count(),7)
            book=Book.objects.get(pk=book_id)
            self.client.force_login(self.user)
            chapter=Chapter.objects.get(book=book)
            payload=self.client.get(f'/api/en/books/{book.slug}/lessons/{chapter.pk}/').json()
            self.assertNotIn('source_document',payload['chapter'])
            self.assertEqual(len(payload['exercises']),7)
    def test_canonical_order_grades_on_server(self):
        from content.ingestion import TEMPLATE,ingest_documents
        from learning.grading import grade
        ingest_documents(self.book,[TEMPLATE]);e=Exercise.objects.get(chapter__book=self.book,source_id='U01-E04');q=e.questions.get()
        self.assertEqual(q.kind,'order')
        self.assertTrue(grade(e,{str(q.pk):['a','b','c','d']})[0]['correct'])
        self.assertFalse(grade(e,{str(q.pk):['b','a','c','d']})[0]['correct'])
    def test_json_supplement_does_not_remove_existing_exercises(self):
        from content.ingestion import TEMPLATE,ingest_documents
        from copy import deepcopy
        ingest_documents(self.book,[TEMPLATE]);supplement=deepcopy(TEMPLATE);supplement['exercises']=[supplement['exercises'][0]]
        supplement['exercises'][0]['instruction']='Updated instruction'
        ingest_documents(self.book,[supplement])
        self.assertEqual(Exercise.objects.filter(chapter__book=self.book,reviewed=True).count(),7)
        self.assertEqual(Exercise.objects.get(chapter__book=self.book,source_id='U01-E01').instruction,'Updated instruction')
    def test_json_invalid_language_and_duplicates_do_not_write(self):
        from content.ingestion import TEMPLATE
        from copy import deepcopy
        source=deepcopy(TEMPLATE);source['book']['language']='de';self.client.force_login(self.admin)
        response=self.client.post(f'/api/manage/books/{self.book.pk}/json/preview/',{'files':SimpleUploadedFile('unit.json',json.dumps(source).encode())})
        self.assertEqual(response.status_code,400)
        self.assertFalse(Exercise.objects.filter(chapter__book=self.book).exists())
    def test_card_reorder_rejects_foreign_ids_and_is_atomic(self):
        from cards.models import Deck,Card
        deck=Deck.objects.create(owner=self.user,title='Order',language='en');cards=[Card.objects.create(deck=deck,german_text=str(i),vietnamese_meaning=str(i),position=i) for i in range(3)]
        url=f'/api/en/decks/{deck.pk}/reorder/'
        response=self.client.post(url,json.dumps({'ids':[cards[0].pk,cards[0].pk,cards[2].pk]}),content_type='application/json')
        self.assertEqual(response.status_code,400)
        response=self.client.post(url,json.dumps({'ids':[c.pk for c in reversed(cards)]}),content_type='application/json')
        self.assertEqual(response.status_code,200)
        self.assertEqual(list(deck.cards.values_list('id',flat=True)),[c.pk for c in reversed(cards)])

    def test_long_exercise_ids_remain_distinct(self):
        prefix='same-prefix-'*3
        for suffix in ('one','two'):
            save_exercise(self.chapter,{'id':prefix+suffix,'type':'text','instruction':'Write','source':{'pages':[]},'items':[{'text':'Word','answer':'ok'}]})
        self.assertEqual(self.chapter.exercise_set.count(),2)
    def test_malformed_json_items_are_validation_errors(self):
        from content.ingestion import validate_document
        for items in (None,[1]):
            with self.assertRaises(ValueError):
                validate_document(self.book,{'chapter':{'number':1,'title':'Unit'},'exercises':[{'id':'bad','type':'ordering','items':items}]})

