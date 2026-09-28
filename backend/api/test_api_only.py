from pathlib import Path
from django.conf import settings
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.template.loader import get_template


class ApiOnlyTests(TestCase):
    def test_default_admin_remains_available(self):
        user = get_user_model().objects.create_superuser('root', password='Testing-7391-secure')
        self.client.force_login(user)
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'admin/index.html')
        self.assertIn('django', str(get_template('admin/base_site.html').origin.name))

    def test_no_application_templates_static_or_react_distribution_in_backend(self):
        root = Path(settings.BASE_DIR)
        self.assertFalse((root / 'templates').exists())
        for app in ['api', 'cards', 'practice', 'users', 'content', 'learning']:
            self.assertFalse((root / app / 'templates').exists())
            self.assertFalse((root / app / 'static').exists())
        self.assertEqual(settings.STATICFILES_DIRS, [])
        self.assertEqual(settings.TEMPLATES[0]['DIRS'], [])
        self.assertFalse(hasattr(settings, 'REACT_DIST'))

    def test_api_errors_stay_json_including_csrf_and_method_errors(self):
        client = Client(enforce_csrf_checks=True)
        response = client.post('/api/session/', data='{}', content_type='application/json')
        self.assertEqual(response.status_code, 403)
        self.assertIn('error', response.json())
        response = self.client.put('/api/session/', data='{}', content_type='application/json')
        self.assertEqual(response.status_code, 405)
        self.assertIn('error', response.json())
        self.assertIn('GET', response['Allow'])
