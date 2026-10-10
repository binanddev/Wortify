import io
import json
import zipfile
from django.test import TestCase
from django.contrib.auth import get_user_model
from cards.models import Deck
from django.contrib.admin.models import LogEntry

class AdminBackupTests(TestCase):
    def setUp(self):
        User=get_user_model()
        self.admin=User.objects.create_superuser('admin','admin@example.com','test')
        self.staff=User.objects.create_user('staff',is_staff=True)
        self.user=User.objects.create_user('learner',email='learn@example.com')
        self.disabled=User.objects.create_user('disabled',is_active=False)
        Deck.objects.create(owner=self.user,title='Private deck')
        self.client.force_login(self.admin)
    def post(self,**data):return self.client.post('/api/manage/backups/',json.dumps(data),content_type='application/json')
    def test_admin_only(self):
        for user in (self.staff,self.user):
            self.client.force_login(user)
            self.assertEqual(self.post(scope='all',preview=True).status_code,403)
    def test_scopes(self):
        self.assertEqual(self.post(scope='all',preview=True).json()['count'],4)
        self.assertEqual(self.post(scope='filtered',role='user',status='active',q='learn',preview=True).json()['count'],1)
        self.assertEqual(self.post(scope='selected',ids=[self.user.pk,self.staff.pk],preview=True).json()['count'],2)
        self.assertEqual(self.post(scope='selected',ids=[99999],preview=True).status_code,400)
    def test_export_identity_options_and_audit(self):
        response=self.post(scope='selected',ids=[self.user.pk],confirm='EXPORT',include_media=True)
        self.assertEqual(response.status_code,200)
        with zipfile.ZipFile(io.BytesIO(b''.join(response.streaming_content))) as archive:
            accounts=json.loads(archive.read('accounts.json'))
            self.assertEqual(len(accounts),1)
            self.assertEqual(accounts[0]['fields']['username'],'learner')
            self.assertTrue(accounts[0]['fields']['password'].startswith('!'))
            self.assertIn(f'users/{self.user.pk}/portable.zip',archive.namelist())
            self.assertNotIn(f'users/{self.admin.pk}/portable.zip',archive.namelist())
        response.close()
        self.assertTrue(LogEntry.objects.filter(change_message__contains='Emergency backup exported').exists())
    def test_credentials_opt_in_and_metadata_only(self):
        response=self.post(scope='selected',ids=[self.admin.pk],confirm='EXPORT',include_credentials=True,include_media=False,include_audit=False)
        with zipfile.ZipFile(io.BytesIO(b''.join(response.streaming_content))) as archive:
            self.assertEqual(json.loads(archive.read('accounts.json'))[0]['fields']['password'],self.admin.password)
            self.assertNotIn('audit.json',archive.namelist())
            self.assertFalse(any(name.endswith('portable.zip') for name in archive.namelist()))
        response.close()
    def test_confirmation_required(self):
        self.assertEqual(self.post(scope='all').status_code,400)
