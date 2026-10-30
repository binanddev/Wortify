from django.test import TestCase
from django.contrib.auth import get_user_model
from users.models import FeatureAvailability

class FeatureAvailabilityTests(TestCase):
    def setUp(self):
        self.admin = get_user_model().objects.create_superuser('switch-admin', password='test')
    def test_defaults_and_permissions(self):
        data = self.client.get('/api/site/features/').json()
        self.assertTrue(data['classes'])
        self.assertTrue(all(data['themes'].values()))
        self.assertEqual(self.client.patch('/api/manage/features/', '{}', content_type='application/json').status_code, 403)
        user = get_user_model().objects.create_user('staff-switch', is_staff=True)
        self.client.force_login(user)
        self.assertEqual(self.client.patch('/api/manage/features/', '{}', content_type='application/json').status_code, 403)
    def test_switches_and_class_routes(self):
        self.client.force_login(self.admin)
        result = self.client.patch('/api/manage/features/', '{"themes":{"xp":false},"classes":false}', content_type='application/json')
        self.assertEqual(result.status_code, 200)
        self.assertFalse(result.json()['themes']['xp'])
        self.assertTrue(result.json()['themes']['studio'])
        for path in ['/api/en/classes/', '/api/de/classes/1/boards/', '/api/en/classes/public/00000000-0000-0000-0000-000000000001/']:
            result = self.client.get(path)
            self.assertEqual(result.status_code, 503)
            self.assertEqual(result.json()['code'], 'feature_disabled')
        self.client.logout()
        self.assertFalse(self.client.get('/api/site/features/').json()['classes'])
        self.client.force_login(self.admin)
        self.assertEqual(self.client.patch('/api/manage/features/', '{"themes":{"studio":false}}', content_type='application/json').status_code, 400)
        self.assertEqual(self.client.patch('/api/manage/features/', '{"classes":"false"}', content_type='application/json').status_code, 400)
        self.client.patch('/api/manage/features/', '{"classes":true}', content_type='application/json')
        self.assertTrue(FeatureAvailability.objects.get(pk=1).classes)
        self.assertFalse(FeatureAvailability.objects.get(pk=1).themes['xp'])
