"""Queued changes must not follow a shared browser cookie into another account."""
import json
import uuid

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from cards.models import LearningEvent
from users.models import Profile


class SyncAccountTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.original = get_user_model().objects.create_user('queue-owner')
        cls.other = get_user_model().objects.create_user('other-session')

    def batch(self, **fields):
        self.token = str(uuid.uuid4())
        return {**fields, 'events': [{
            'token': self.token,
            'at': timezone.now().isoformat(),
            'kind': 'preferences',
            'payload': {'textSize': 20},
        }]}

    def send(self, data):
        return self.client.post('/api/en/learning/sync/', json.dumps(data), content_type='application/json')

    def test_changed_cookie_rejects_whole_batch_without_consuming_token(self):
        data = self.batch(account_id=self.original.pk)
        self.client.force_login(self.other)
        response = self.send(data)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()['code'], 'account_changed')
        self.assertFalse(LearningEvent.objects.filter(token=self.token).exists())
        self.assertFalse(Profile.objects.filter(user=self.other, preferences__textSize=20).exists())
        self.client.force_login(self.original)
        retry = self.send(data)
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(retry.json()['accepted'][0]['token'], self.token)
        self.assertEqual(Profile.objects.get(user=self.original).preferences['textSize'], 20)

    def test_guard_requires_exact_integer_identity(self):
        self.client.force_login(self.original)
        for identity in (str(self.original.pk), float(self.original.pk), True, None, [], {}):
            with self.subTest(identity=identity):
                response = self.send(self.batch(account_id=identity))
                self.assertEqual(response.status_code, 409)
                self.assertFalse(LearningEvent.objects.filter(token=self.token).exists())

    def test_legacy_client_without_identity_remains_compatible(self):
        self.client.force_login(self.original)
        response = self.send(self.batch())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['accepted'][0]['token'], self.token)
