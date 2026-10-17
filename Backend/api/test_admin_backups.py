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


class AdminRestoreTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.admin = User.objects.create_superuser('operator', password='test')
        self.source = User.objects.create_user('writer', password='original-password', is_staff=True)
        Deck.objects.create(owner=self.source, title='Import me')
        self.client.force_login(self.admin)

    def archive(self, credentials=True):
        response = self.client.post('/api/manage/backups/', json.dumps({'scope':'selected','ids':[self.source.pk],'confirm':'EXPORT','include_credentials':credentials}), content_type='application/json')
        self.assertEqual(response.status_code, 200)
        raw = b''.join(response.streaming_content); response.close()
        return raw

    def upload(self, raw, **data):
        from django.core.files.uploadedfile import SimpleUploadedFile
        return self.client.post('/api/manage/backups/import/', {'file': SimpleUploadedFile('backup.zip',raw), **data})

    def test_collision_preview_and_no_overwrite(self):
        raw = self.archive()
        result = self.upload(raw, preview='true')
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['collisions'], ['writer'])
        self.assertEqual(self.upload(raw, confirm='RESTORE').status_code, 400)
        self.source.refresh_from_db()
        self.assertTrue(self.source.check_password('original-password'))

    def test_accounts_passwords_roles_and_content_round_trip(self):
        from django.contrib.auth.models import Group, Permission
        permission = Permission.objects.first()
        group = Group.objects.create(name='Editors'); group.permissions.add(permission)
        self.source.groups.add(group); self.source.user_permissions.add(permission)
        raw = self.archive(); self.source.delete()
        preview = self.upload(raw, preview='true')
        self.assertEqual(preview.status_code, 200)
        self.assertFalse(get_user_model().objects.filter(username='writer').exists())
        result = self.upload(raw, confirm='RESTORE')
        self.assertEqual(result.status_code, 200, result.content)
        user = get_user_model().objects.get(username='writer')
        self.assertTrue(user.is_staff); self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password('original-password'))
        self.assertEqual(list(user.user_permissions.all()), [permission])
        self.assertEqual(list(user.groups.all()), [group])
        self.assertTrue(Deck.objects.filter(owner=user, title='Import me').exists())

    def test_missing_hash_requires_password_reset(self):
        raw = self.archive(False); self.source.delete()
        self.assertEqual(self.upload(raw, confirm='RESTORE').status_code, 200)
        self.assertFalse(get_user_model().objects.get(username='writer').has_usable_password())

    def test_staff_denied_and_confirmation_required(self):
        raw = self.archive()
        self.assertEqual(self.upload(raw).status_code, 400)
        self.client.force_login(self.source)
        self.assertEqual(self.upload(raw, preview='true').status_code, 403)

    def test_corrupt_backup_and_group_mismatch_rejected(self):
        from django.contrib.auth.models import Group, Permission
        group = Group.objects.create(name='Editors'); group.permissions.add(Permission.objects.first())
        self.source.groups.add(group)
        raw = self.archive(); self.source.delete(); group.permissions.clear()
        self.assertEqual(self.upload(raw, confirm='RESTORE').status_code, 400)
        self.assertFalse(get_user_model().objects.filter(username='writer').exists())
        self.assertEqual(self.upload(b'not zip', preview='true').status_code, 400)

    def test_superuser_role_and_disabled_state_preserved(self):
        self.source.is_superuser = True; self.source.is_active = False; self.source.save()
        raw = self.archive(); self.source.delete()
        response = self.upload(raw, confirm='RESTORE')
        self.assertEqual(response.status_code, 200, response.content)
        user = get_user_model().objects.get(username='writer')
        self.assertTrue(user.is_superuser); self.assertTrue(user.is_staff); self.assertFalse(user.is_active)

    def test_corrupt_checksum_rejected_before_creating_accounts(self):
        raw = self.archive(); self.source.delete()
        source = zipfile.ZipFile(io.BytesIO(raw)); output = io.BytesIO()
        with zipfile.ZipFile(output, 'w') as altered:
            for name in source.namelist():
                data = source.read(name)
                if name == 'accounts.json': data = data.replace(b'writer', b'forged')
                altered.writestr(name, data)
        source.close()
        self.assertEqual(self.upload(output.getvalue(), confirm='RESTORE').status_code, 400)
        self.assertFalse(get_user_model().objects.filter(username__in=['writer','forged']).exists())
