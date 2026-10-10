import io
import json
import zipfile
import hashlib
import tempfile
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from cards.models import Folder, Deck, Card, StudyProgress, DeckLearningState
from practice.models import PracticeNode, PracticeProgress
from users.models import Profile, Classroom
from .backups import export_archive, read_archive, restore_archive

class BackupTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user(username='source',password='test')
        self.target=get_user_model().objects.create_user(username='target',password='test')
        self.folder=Folder.objects.create(owner=self.user,name='Words')
        self.deck=Deck.objects.create(owner=self.user,folder=self.folder,title='Deck')
        self.card=Card.objects.create(deck=self.deck,german_text='Hallo',vietnamese_meaning='Hello')
        StudyProgress.objects.create(user=self.user,card=self.card,correct_count=5)
        DeckLearningState.objects.create(user=self.user,deck=self.deck,stars={str(self.card.pk):{'value':True}},progress={str(self.card.pk):{'hits':3}})
        self.root=PracticeNode.objects.create(owner=self.user,language='de',kind='folder',title='Practice')
        self.node=PracticeNode.objects.create(owner=self.user,language='de',kind='exercise',parent=self.root,title='Test',payload={'kind':'text','questions':[]})
        PracticeProgress.objects.create(user=self.user,node=self.node,revision=self.node.updated_at.isoformat(),completed=['1'])
        Profile.objects.update_or_create(user=self.user,defaults={'display_name':'Learner','preferences':{'interface':'notebook'}})
    def archive(self):
        stream=export_archive(self.user,{'de':[self.root.pk]})
        data=stream.read();stream.close();return data
    def restore(self,data=None,settings=True):
        archive,records=read_archive(SimpleUploadedFile('backup.zip',data or self.archive()))
        try:return restore_archive(self.target,archive,records,settings)
        finally:archive.close()
    def test_round_trip_ownership_relations_and_progress(self):
        result=self.restore()
        deck=Deck.objects.get(owner=self.target)
        card=Card.objects.get(deck=deck)
        self.assertNotEqual(card.pk,self.card.pk)
        self.assertEqual(deck.folder.owner,self.target)
        self.assertEqual(StudyProgress.objects.get(user=self.target).correct_count,5)
        state=DeckLearningState.objects.get(user=self.target)
        self.assertEqual(state.progress,{str(card.pk):{'hits':3}})
        self.assertIn(str(card.pk),state.stars)
        node=PracticeNode.objects.get(owner=self.target,kind='exercise')
        self.assertEqual(node.visibility,'private')
        self.assertEqual(node.parent.owner,self.target)
        self.assertEqual(PracticeProgress.objects.get(user=self.target).revision,node.updated_at.isoformat())
        self.assertEqual(result['workspace']['de'],[node.parent_id])
        self.assertEqual(Profile.objects.get(user=self.target).display_name,'Learner')
        self.assertFalse(self.target.is_staff)
    def test_export_excludes_other_users_and_credentials(self):
        Deck.objects.create(owner=self.target,title='Private secret')
        with zipfile.ZipFile(io.BytesIO(self.archive())) as archive:
            content=archive.read('data/cards.deck.json').decode()
            self.assertNotIn('Private secret',content)
            self.assertNotIn('auth.user',archive.namelist())
            self.assertNotIn('password',archive.read('data/users.profile.json').decode())
    def test_repeated_restore_adds_copies(self):
        data=self.archive();self.restore(data);self.restore(data)
        self.assertEqual(Deck.objects.filter(owner=self.target).count(),2)
        self.assertEqual(Folder.objects.filter(owner=self.target).count(),2)
    def test_settings_opt_in_and_class_members_excluded(self):
        Profile.objects.update_or_create(user=self.target,defaults={'display_name':'Keep'})
        classroom=Classroom.objects.create(owner=self.user,language='de',title='Class')
        classroom.members.add(self.target)
        self.restore(settings=False)
        self.assertEqual(Profile.objects.get(user=self.target).display_name,'Keep')
        restored=Classroom.objects.get(owner=self.target)
        self.assertEqual(restored.members.count(),0)
        self.assertNotEqual(restored.invite,classroom.invite)
    def test_corrupt_zip_and_zip_slip_rejected(self):
        with self.assertRaises(ValueError):read_archive(SimpleUploadedFile('x.zip',b'bad'))
        data=io.BytesIO()
        with zipfile.ZipFile(data,'w') as archive:archive.writestr('../bad','x')
        with self.assertRaises(ValueError):read_archive(SimpleUploadedFile('x.zip',data.getvalue()))
    def test_checksum_rejected(self):
        data=io.BytesIO()
        with zipfile.ZipFile(io.BytesIO(self.archive())) as original,zipfile.ZipFile(data,'w') as changed:
            for name in original.namelist():changed.writestr(name,b'[]' if name=='data/cards.card.json' else original.read(name))
        with self.assertRaises(ValueError):read_archive(SimpleUploadedFile('x.zip',data.getvalue()))
    def test_missing_parent_rolls_back(self):
        archive,records=read_archive(SimpleUploadedFile('x.zip',self.archive()))
        for record in records:
            if record['model']=='practice.practicenode' and record['fields']['kind']=='exercise':record['fields']['parent']=999999
        try:
            with self.assertRaises(ValueError):restore_archive(self.target,archive,records,True)
        finally:archive.close()
        self.assertFalse(Deck.objects.filter(owner=self.target).exists())
    def test_authenticated_preview_and_restore_endpoint(self):
        self.assertEqual(self.client.get('/api/me/backup/').status_code,401)
        self.client.force_login(self.target)
        response=self.client.post('/api/me/backup/restore/',{'file':SimpleUploadedFile('backup.zip',self.archive()),'preview':'true'})
        self.assertEqual(response.status_code,200,response.content)
        self.assertFalse(Deck.objects.filter(owner=self.target).exists())
        response=self.client.post('/api/me/backup/restore/',{'file':SimpleUploadedFile('backup.zip',self.archive()),'confirm':'true'})
        self.assertEqual(response.status_code,200,response.content)

    def test_media_and_background_round_trip(self):
        import base64
        from django.core.files.base import ContentFile
        from practice.models import PracticeMedia
        from users.models import Theme
        with tempfile.TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory):
            data=io.BytesIO(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1cAAAAASUVORK5CYII='))
            theme=Theme.objects.create(owner=self.user,name='Green')
            theme.background_image.save('green.png',ContentFile(data.getvalue()))
            profile=Profile.objects.get(user=self.user);profile.theme_de=theme
            profile.preferences={'backgroundByInterface':{'notebook':theme.pk}};profile.save()
            media=PracticeMedia.objects.create(owner=self.user,language='de',name='image.png',size=len(data.getvalue()),content_type='image/png')
            media.file.save('image.png',ContentFile(data.getvalue()))
            self.node.attachments.add(media)
            self.node.payload={'attachments':[{'id':str(media.pk),'url':f'/api/de/practice-hub/media/{media.pk}/'}]};self.node.save()
            self.restore()
            restored=PracticeMedia.objects.get(owner=self.target)
            node=PracticeNode.objects.get(owner=self.target,kind='exercise')
            self.assertEqual(node.attachments.get(),restored)
            self.assertEqual(node.payload['attachments'][0]['id'],str(restored.pk))
            self.assertIn(str(restored.pk),node.payload['attachments'][0]['url'])
            with restored.file.open('rb') as stream:
                self.assertEqual(stream.read(),data.getvalue())
            profile=Profile.objects.get(user=self.target)
            self.assertEqual(profile.preferences['backgroundByInterface']['notebook'],profile.theme_de_id)
    def test_unowned_history_is_archived_but_not_attached_to_someone_else(self):
        other=Deck.objects.create(owner=self.target,title='Other')
        card=Card.objects.create(deck=other,german_text='Other',vietnamese_meaning='Other')
        StudyProgress.objects.create(user=self.user,card=card)
        result=self.restore()
        self.assertEqual(result['skipped'],1)
        self.assertFalse(StudyProgress.objects.filter(user=self.target,card=card).exists())

    def test_csrf_required_for_restore(self):
        from django.test import Client
        client=Client(enforce_csrf_checks=True);client.force_login(self.target)
        response=client.post('/api/me/backup/restore/',{'file':SimpleUploadedFile('backup.zip',self.archive()),'confirm':'true'})
        self.assertEqual(response.status_code,403)
    def test_unrecognized_models_rejected(self):
        content=json.dumps([{'model':'auth.user','pk':1,'fields':{'is_superuser':True}}]).encode()
        data=io.BytesIO()
        with zipfile.ZipFile(data,'w') as archive:
            archive.writestr('data/auth.user.json',content)
            archive.writestr('manifest.json',json.dumps({'format':'wortify-backup','version':1,'files':{'data/auth.user.json':hashlib.sha256(content).hexdigest()}}))
        with self.assertRaises(ValueError):read_archive(SimpleUploadedFile('x.zip',data.getvalue()))
