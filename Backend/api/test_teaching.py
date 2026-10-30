import io
import json
import tempfile
import uuid
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from pypdf import PdfWriter
from users.models import Classroom, TeachingBoard, BoardEvent
from users.board_uploads import BoardPDFUploadHandler, MAX_PDF_BYTES
from django.core.files.uploadhandler import StopUpload, StopFutureHandlers
from .teaching import initial

class TeachingTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.settings_override = override_settings(STORAGES={'default': {'BACKEND':'django.core.files.storage.FileSystemStorage'}}, MEDIA_ROOT=self.temp.name)
        self.settings_override.enable()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.settings_override.disable)
        users = get_user_model()
        self.teacher = users.objects.create_user('teacher')
        self.student = users.objects.create_user('student')
        self.outsider = users.objects.create_user('outsider')
        self.room = Classroom.objects.create(owner=self.teacher, language='de', title='Deutsch')
        self.room.members.add(self.student)
        self.board = TeachingBoard.objects.create(classroom=self.room, title='Lesson', state=initial())
        self.url = f'/api/de/classes/{self.room.pk}/boards/{self.board.pk}/'
        self.page = self.board.state['active']
        self.client.force_login(self.teacher)

    def post(self, data):
        return self.client.post(self.url, json.dumps(data), content_type='application/json')

    def ink(self):
        return {'kind':'ink','id':str(uuid.uuid4()),'page':self.page,'tool':'pen','color':'#123456','width':3,'offset':0,'points':[[1,2],[3,4]]}

    def batch(self, op=None, revision=0):
        return {'batch':str(uuid.uuid4()),'revision':revision,'operations':[op or self.ink()]}

    def pdf(self, count=1):
        writer = PdfWriter()
        for _ in range(count): writer.add_blank_page(600,800)
        out=io.BytesIO();writer.write(out)
        return SimpleUploadedFile('lesson.pdf',out.getvalue(),content_type='application/pdf')

    def test_roles_language_and_private_pdf(self):
        self.client.force_login(self.outsider)
        self.assertEqual(self.client.get(self.url).status_code,404)
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(self.url).status_code,200)
        self.assertEqual(self.post(self.batch()).status_code,403)
        self.assertEqual(self.client.post(self.url+'pdfs/',{'file':self.pdf()}).status_code,403)
        self.assertEqual(self.client.get(self.url.replace('/de/','/en/')).status_code,404)
        self.room.members.remove(self.student)
        self.assertEqual(self.client.get(self.url).status_code,404)

    def test_live_chunks_retry_and_conflict(self):
        op=self.ink();batch=self.batch(op)
        first=self.post(batch);self.assertEqual(first.status_code,200,first.content)
        self.assertEqual(self.post(batch).json()['revision'],1)
        self.assertEqual(BoardEvent.objects.count(),1)
        append={**op,'offset':2,'points':[[4,5]]}
        self.assertEqual(self.post(self.batch(append,1)).status_code,200)
        self.board.refresh_from_db()
        self.assertEqual(len(self.board.state['strokes'][op['id']]['points']),3)
        self.assertEqual(self.post(self.batch()).status_code,409)
        self.client.force_login(self.student)
        delta=self.client.get(self.url+'?since=0').json()
        self.assertEqual(delta['revision'],2)
        self.assertEqual(len(delta['events']),2)
        self.assertNotIn('state',delta)
        self.assertEqual(self.client.get(self.url+'?since=2').json()['events'],[])

    def test_atomic_validation_and_bounds(self):
        op=self.ink()
        for bad in ({**op,'points':[[float('nan'),1]]},{**op,'points':[[9999,1]]},{**op,'width':100},{**op,'color':'url(evil)'},{**op,'offset':1},{**op,'tool':'html'}):
            result=self.post(self.batch(bad));self.assertEqual(result.status_code,400,result.content)
        result=self.post({'batch':str(uuid.uuid4()),'revision':0,'operations':[op,{'kind':'unknown','page':self.page}]})
        self.assertEqual(result.status_code,400)
        self.board.refresh_from_db();self.assertEqual(self.board.revision,0);self.assertEqual(self.board.state['strokes'],{})

    def test_erase_restore_and_page_navigation(self):
        op=self.ink();self.post(self.batch(op))
        hide={'kind':'visibility','page':self.page,'ids':[op['id']],'visible':False}
        self.assertEqual(self.post(self.batch(hide,1)).status_code,200)
        self.assertEqual(self.post(self.batch({**hide,'visible':True},2)).status_code,200)
        page=str(uuid.uuid4())
        batch={'batch':str(uuid.uuid4()),'revision':3,'operations':[{'kind':'page','id':page,'width':792,'height':1120,'paper':'grid'},{'kind':'active','page':page}]}
        self.assertEqual(self.post(batch).status_code,200)
        self.board.refresh_from_db();self.assertEqual(self.board.state['active'],page)
        self.assertTrue(self.board.state['strokes'][op['id']]['visible'])

    def test_pdf_import_snapshot_and_authorized_content(self):
        self.post(self.batch())
        result=self.client.post(self.url+'pdfs/',{'file':self.pdf(2)})
        self.assertEqual(result.status_code,201,result.content)
        state=result.json()['state'];self.assertEqual(len(state['pages']),3)
        self.assertEqual(len(state['strokes']),1)
        self.assertEqual(BoardEvent.objects.count(),0)
        self.assertIn('state',self.client.get(self.url+'?since=1').json())
        asset=state['pages'][1]['pdf'];path=self.url+f'pdfs/{asset}/'
        self.client.force_login(self.student)
        response=self.client.get(path);self.assertEqual(response.status_code,200)
        self.assertEqual(response['Content-Type'],'application/pdf');response.close()
        self.client.force_login(self.outsider);self.assertEqual(self.client.get(path).status_code,404)

    def test_invalid_encrypted_and_excessive_pdf(self):
        for file in (SimpleUploadedFile('fake.pdf',b'%PDF-invalid'),SimpleUploadedFile('image.png',b'12345'),self.pdf(201)):
            result=self.client.post(self.url+'pdfs/',{'file':file});self.assertEqual(result.status_code,400,result.content)
        writer=PdfWriter();writer.add_blank_page(600,800);writer.encrypt('secret');out=io.BytesIO();writer.write(out)
        result=self.client.post(self.url+'pdfs/',{'file':SimpleUploadedFile('locked.pdf',out.getvalue())})
        self.assertEqual(result.status_code,400);self.assertIn('Unlock',result.json()['error'])
        self.assertEqual(self.board.pdfs.count(),0)

    def test_upload_handler_enforces_exact_300mb_boundary_without_allocating_file(self):
        from django.test import RequestFactory
        handler=BoardPDFUploadHandler(RequestFactory().post(self.url+'pdfs/'))
        with self.assertRaises(StopFutureHandlers):handler.new_file('file','lesson.pdf','application/pdf',MAX_PDF_BYTES)
        self.assertIsNone(handler.receive_data_chunk(b'x',MAX_PDF_BYTES-1))
        with self.assertRaises(StopUpload):handler.receive_data_chunk(b'x',MAX_PDF_BYTES)

    def test_trimmed_event_history_recovers_snapshot(self):
        self.post(self.batch())
        BoardEvent.objects.all().delete()
        result=self.client.get(self.url+'?since=0').json()
        self.assertIn('state',result)

    def test_csrf_required(self):
        from django.test import Client
        client=Client(enforce_csrf_checks=True);client.force_login(self.teacher)
        self.assertEqual(client.post(self.url,json.dumps(self.batch()),content_type='application/json').status_code,403)

    def test_portable_backup_restores_board_pdf_and_rewrites_asset_ids(self):
        from .backups import export_archive, read_archive, restore_archive
        result=self.client.post(self.url+'pdfs/',{'file':self.pdf()})
        original_pdf=result.json()['state']['pages'][0]['pdf']
        op=self.ink();op['page']=result.json()['state']['active']
        self.assertEqual(self.post(self.batch(op,1)).status_code,200)
        stream=export_archive(self.teacher)
        try: archive,records=read_archive(SimpleUploadedFile('backup.zip',stream.read()))
        finally: stream.close()
        try: restore_archive(self.outsider,archive,records)
        finally: archive.close()
        restored=TeachingBoard.objects.get(classroom__owner=self.outsider)
        self.assertNotEqual(restored.pk,self.board.pk)
        self.assertEqual(restored.revision,0)
        asset=restored.pdfs.get()
        self.assertNotEqual(str(asset.pk),original_pdf)
        self.assertEqual(restored.state['pages'][0]['pdf'],str(asset.pk))
        self.assertEqual(len(restored.state['strokes']),1)
        self.assertEqual(restored.events.count(),0)
        with asset.file.open('rb') as source:self.assertEqual(source.read(5),b'%PDF-')

    def test_idle_delta_does_not_select_the_large_snapshot(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        with CaptureQueriesContext(connection) as queries:
            result=self.client.get(self.url+'?since=0')
        self.assertEqual(result.json()['events'],[])
        self.assertFalse(any('"users_teachingboard"."state"' in row['sql'] for row in queries))

    def test_delta_pagination_does_not_skip_batches(self):
        BoardEvent.objects.bulk_create([BoardEvent(board=self.board,revision=n,batch=uuid.uuid4(),operations=[{'kind':'active','page':self.page}]) for n in range(1,71)])
        self.board.revision=70;self.board.save(update_fields=['revision'])
        first=self.client.get(self.url+'?since=0').json()
        self.assertEqual(len(first['events']),64);self.assertEqual(first['revision'],64)
        second=self.client.get(self.url+'?since=64').json()
        self.assertEqual(len(second['events']),6);self.assertEqual(second['revision'],70)

    def test_import_replaces_untouched_starter_sheet(self):
        result=self.client.post(self.url+'pdfs/',{'file':self.pdf(200)})
        self.assertEqual(result.status_code,201,result.content)
        self.assertEqual(len(result.json()['state']['pages']),200)
        self.assertTrue(all('pdf' in p for p in result.json()['state']['pages']))

    def test_point_budget_is_atomic_across_every_chunk_in_a_batch(self):
        from unittest.mock import patch
        operations=[self.ink(),self.ink()]
        payload={'batch':str(uuid.uuid4()),'revision':0,'operations':operations}
        with patch('api.teaching.MAX_POINTS',3):
            self.assertEqual(self.post(payload).status_code,400)
        self.board.refresh_from_db()
        self.assertEqual(self.board.state['strokes'],{})
        self.assertEqual(self.board.revision,0)
        self.assertEqual(self.board.events.count(),0)
        with patch('api.teaching.MAX_POINTS',4):
            self.assertEqual(self.post(payload).status_code,200)
        self.board.refresh_from_db()
        self.assertEqual(sum(len(s['points']) for s in self.board.state['strokes'].values()),4)

    def test_batch_counts_existing_strokes_once(self):
        from .teaching import apply_batch
        class Strokes(dict):
            scans=0
            def values(self):
                self.scans+=1
                return super().values()
        state=initial();strokes=Strokes();state['strokes']=strokes
        operations=[{**self.ink(),'page':state['active']} for _ in range(128)]
        apply_batch(state,operations)
        self.assertEqual(strokes.scans,1)
        self.assertEqual(len(strokes),128)

    def test_teacher_authorization_does_not_join_every_class_member(self):
        from .teaching import room
        from django.test import RequestFactory
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        request=RequestFactory().get(self.url);request.user=self.teacher;request.language='de'
        with CaptureQueriesContext(connection) as queries:
            self.assertEqual(room(request,self.room.pk,True).pk,self.room.pk)
        self.assertEqual(len(queries),1)
        self.assertNotIn(' JOIN ',queries[0]['sql'])
        self.assertNotIn('DISTINCT',queries[0]['sql'])
