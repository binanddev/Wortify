import hashlib
import json
from pathlib import Path
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from users.models import ContentImportKey, Profile
from practice.models import SystemContentPackage
from cards.models import Deck

class ContentImportApiTests(TestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user('api-staff', is_staff=True)
        self.client.force_login(self.staff)
        self.data = json.loads((Path(__file__).resolve().parents[1] / 'sample_data/content-package.json').read_text(encoding='utf-8'))
        self.url = '/api/manage/import-api/'

    def enable(self):
        response = self.client.post(self.url, {}, content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()['key']

    def send(self, key, **fields):
        # External clients have neither session nor CSRF cookie.
        return Client(enforce_csrf_checks=True).post('/api/import/content/', {
            'file': SimpleUploadedFile('package.json', json.dumps(self.data).encode()), **fields}, HTTP_AUTHORIZATION='Bearer '+key)

    def test_preview_publish_retry_and_key_scope(self):
        key=self.enable()
        row=ContentImportKey.objects.get()
        self.assertEqual(row.digest, hashlib.sha256(key.encode()).hexdigest())
        self.assertNotIn(key, self.client.get(self.url).content.decode())
        self.assertEqual(self.send(key, preview='true').status_code,200)
        self.assertEqual(SystemContentPackage.objects.count(),0)
        self.assertEqual(self.send(key, confirm='IMPORT').status_code,201)
        self.assertTrue(self.send(key, confirm='IMPORT').json()['already_imported'])
        self.assertEqual(SystemContentPackage.objects.count(),1)
        self.assertEqual(Deck.objects.count(),0)
        self.assertEqual(Client().get('/api/manage/users/', HTTP_AUTHORIZATION='Bearer '+key).status_code,401)
        row.refresh_from_db();self.assertIsNotNone(row.last_used_at)

    def test_rotate_disable_and_role_changes(self):
        old=self.enable();new=self.enable()
        self.assertEqual(self.send(old, preview='true').status_code,401)
        self.assertEqual(self.send(new, preview='true').status_code,200)
        self.staff.is_staff=False;self.staff.save()
        self.assertEqual(self.send(new, preview='true').status_code,401)
        self.assertEqual(self.client.post(self.url,{}).status_code,403)
        self.staff.is_staff=True;self.staff.save()
        self.assertEqual(self.client.delete(self.url).status_code,200)
        self.assertEqual(self.send(new, preview='true').status_code,401)
        key=self.enable();self.staff.is_active=False;self.staff.save()
        self.assertEqual(self.send(key, preview='true').status_code,401)

    def test_flashcards_confirmation_and_session_not_accepted(self):
        key=self.enable()
        self.assertEqual(self.send(key).status_code,400)
        self.data['flashcards']=[]
        self.assertEqual(self.send(key,confirm='IMPORT').status_code,400)
        self.assertEqual(SystemContentPackage.objects.count(),0)
        self.assertEqual(self.client.post('/api/import/content/',{}).status_code,401)
        self.assertEqual(Client(enforce_csrf_checks=True).post(self.url,{}).status_code,403)

class InterfaceLanguageTests(TestCase):
    def test_account_language_validation_and_session(self):
        user=get_user_model().objects.create_user('language-user')
        self.assertEqual(self.client.patch('/api/me/language/', '{}', content_type='application/json').status_code,401)
        self.client.force_login(user)
        for lang in ('vi','de','en'):
            r=self.client.patch('/api/me/language/',json.dumps({'language':lang}),content_type='application/json')
            self.assertEqual(r.status_code,200)
            self.assertEqual(self.client.get('/api/session/').json()['user']['preferences']['uiLanguage'],lang)
        self.assertEqual(self.client.patch('/api/me/language/','{"language":"fr"}',content_type='application/json').status_code,400)
        self.assertEqual(Profile.objects.get(user=user).preferences['uiLanguage'],'en')
