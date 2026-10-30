import base64
import json
import uuid
from django.test import Client,TestCase,TransactionTestCase,override_settings
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from . import test_teaching
from users.models import TeachingBoard


@override_settings(TEACHING_REALTIME_URL='wss://relay.example/ws',TEACHING_REALTIME_SECRET='test-only-shared-secret-12345678901234567890')
class PublicTeachingTests(TestCase):
    setUp=test_teaching.TeachingTests.setUp
    post=test_teaching.TeachingTests.post
    ink=test_teaching.TeachingTests.ink
    batch=test_teaching.TeachingTests.batch
    pdf=test_teaching.TeachingTests.pdf

    def enable(self,**data):
        result=self.client.post(self.url+'sharing/',json.dumps({'enabled':True,**data}),content_type='application/json')
        self.assertEqual(result.status_code,200,result.content)
        self.board.refresh_from_db()
        return f'/api/de/classes/public/{self.board.public_token}/',result.json()

    def decode(self,proof):return json.loads(base64.urlsafe_b64decode(proof['data']+'='*(-len(proof['data'])%4)))

    def test_private_by_default_and_owner_only_settings(self):
        guest=Client();path=f'/api/de/classes/public/{self.board.public_token}/'
        self.assertFalse(self.board.public_enabled);self.assertEqual(guest.get(path).status_code,404)
        self.client.force_login(self.student)
        self.assertEqual(self.client.get(self.url+'sharing/').status_code,403)
        self.assertEqual(self.client.post(self.url+'sharing/',json.dumps({'enabled':True}),content_type='application/json').status_code,403)
        self.assertEqual(guest.get(self.url).status_code,401)

    def test_guest_reads_lesson_without_class_or_member_data_and_cannot_write(self):
        path,_=self.enable();guest=Client();response=guest.get(path)
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['title'],self.board.title)
        for key in ('members','invite','assignments','owner','public_token'):self.assertNotIn(key,response.json())
        self.assertEqual(guest.post(path,json.dumps(self.batch()),content_type='application/json').status_code,401)
        self.assertEqual(guest.get(path.replace('/de/','/en/')).status_code,404)
        self.assertEqual(response['Cache-Control'],'private, no-store');self.assertIn('noindex',response['X-Robots-Tag'])
        self.assertEqual(guest.get(path+'info/').json()['read_only'],True)

    def test_public_ticket_is_anonymous_read_only_and_version_scoped(self):
        path,_=self.enable();data=Client().get(path+'realtime/').json();ticket=self.decode(data['ticket'])
        self.assertTrue(ticket['public']);self.assertFalse(ticket['write']);self.assertEqual(ticket['user'],0)
        self.assertEqual(ticket['access'],self.board.public_version);self.assertEqual(ticket['room'],str(self.board.pk))
        self.assertEqual(ticket['exp']-ticket['iat'],60)

    def test_rotate_and_disable_revoke_old_links(self):
        old,_=self.enable();version=self.board.public_version
        new,result=self.enable(rotate=True)
        self.assertNotEqual(old,new);self.assertGreater(self.board.public_version,version)
        self.assertEqual(Client().get(old).status_code,404)
        notice=self.decode(result['notification']);self.assertEqual(notice['public_access'],self.board.public_version)
        self.enable(enabled=False)
        for tail in ('','info/','realtime/'):
            self.assertEqual(Client().get(new+tail).status_code,404)

    def test_guest_pdf_is_scoped_to_the_enabled_lesson(self):
        uploaded=self.client.post(self.url+'pdfs/',{'file':self.pdf()}).json()
        asset=uploaded['state']['pages'][0]['pdf'];path,_=self.enable()
        response=Client().get(path+f'pdfs/{asset}/');self.assertEqual(response.status_code,200);response.close()
        other=TeachingBoard.objects.create(classroom=self.room,title='Other',state=self.board.state,public_enabled=True,public_version=1)
        self.assertEqual(Client().get(f'/api/de/classes/public/{other.public_token}/pdfs/{asset}/').status_code,404)
        self.enable(enabled=False);self.assertEqual(Client().get(path+f'pdfs/{asset}/').status_code,404)

    def test_public_live_deltas_and_revoke_proof(self):
        path,result=self.enable();revision=result['revision'];op=self.ink()
        response=self.post(self.batch(op,revision));self.assertEqual(response.status_code,200)
        update=self.decode(response.json()['notification']);self.assertEqual(update['public_access'],self.board.public_version)
        delta=Client().get(path+f'?since={revision}').json();self.assertEqual(len(delta['events']),1)
        _,disabled=self.enable(enabled=False);self.assertIsNone(self.decode(disabled['notification'])['public_access'])

    def test_restoring_a_public_lesson_is_private_with_a_new_link(self):
        from .backups import export_archive,read_archive,restore_archive
        from django.core.files.uploadedfile import SimpleUploadedFile
        path,_=self.enable();stream=export_archive(self.teacher)
        try:archive,records=read_archive(SimpleUploadedFile('backup.zip',stream.read()))
        finally:stream.close()
        try:restore_archive(self.outsider,archive,records)
        finally:archive.close()
        restored=TeachingBoard.objects.get(classroom__owner=self.outsider)
        self.assertFalse(restored.public_enabled);self.assertNotEqual(restored.public_token,self.board.public_token);self.assertEqual(restored.public_version,0)

    def test_inactive_teacher_and_bad_sharing_payload_are_rejected(self):
        path,_=self.enable()
        self.assertEqual(self.client.post(self.url+'sharing/',json.dumps({'enabled':'yes'}),content_type='application/json').status_code,400)
        self.teacher.is_active=False;self.teacher.save(update_fields=['is_active'])
        self.assertEqual(Client().get(path).status_code,404)


class PublicSharingMigrationTests(TransactionTestCase):
    def test_existing_lessons_receive_distinct_private_tokens(self):
        executor=MigrationExecutor(connection)
        old=[('users','0009_teachingboard_boardpdf_boardevent')]
        try:
            executor.migrate(old);apps=executor.loader.project_state(old).apps
            user=apps.get_model('auth','User').objects.create(username='migration-teacher')
            classroom=apps.get_model('users','Classroom').objects.create(owner_id=user.pk,language='de',title='Existing')
            Board=apps.get_model('users','TeachingBoard')
            ids=[Board.objects.create(classroom_id=classroom.pk,title=str(i),state={}).pk for i in range(3)]
            executor=MigrationExecutor(connection);target=[('users','0010_teachingboard_public_sharing')];executor.migrate(target)
            apps=executor.loader.project_state(target).apps
            rows=list(apps.get_model('users','TeachingBoard').objects.filter(pk__in=ids))
            self.assertEqual(len({row.public_token for row in rows}),3);self.assertTrue(all(row.public_token for row in rows));self.assertTrue(all(not row.public_enabled for row in rows))
        finally:
            executor=MigrationExecutor(connection);executor.migrate(executor.loader.graph.leaf_nodes())
