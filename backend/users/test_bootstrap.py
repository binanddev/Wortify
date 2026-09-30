from django.test import TestCase, Client, override_settings
from django.contrib.auth import get_user_model
from .models import SuperuserBootstrap

URL = '/api/setup-7f3c91d8/first-admin/'
KEY = 'test-bootstrap-key-' + 'x' * 40

@override_settings(SUPERUSER_SETUP_KEY=KEY)
class BootstrapTests(TestCase):
    def payload(self, **extra):
        return {'username': 'firstadmin', 'password1': 'Strong-Setup-7391!', 'password2': 'Strong-Setup-7391!', 'setup_key': KEY, **extra}

    def test_disabled_without_strong_key(self):
        for key in ['', 'short']:
            with override_settings(SUPERUSER_SETUP_KEY=key):
                self.assertEqual(self.client.get(URL).status_code, 404)

    def test_key_and_csrf_required(self):
        client = Client(enforce_csrf_checks=True)
        self.assertEqual(client.get(URL).status_code, 200)
        self.assertEqual(client.post(URL, self.payload()).status_code, 403)
        token = client.cookies['csrftoken'].value
        response = client.post(URL, self.payload(setup_key='wrong'), HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 403)
        self.assertFalse(get_user_model().objects.exists())
        self.assertFalse(SuperuserBootstrap.objects.exists())
        response = client.post(URL, self.payload(), HTTP_X_CSRFTOKEN=token)
        self.assertEqual(response.status_code, 200)
        self.assertIn('no-store', response['Cache-Control'])
        user = get_user_model().objects.get(username='firstadmin')
        self.assertTrue(user.is_superuser and user.is_staff)
        self.assertTrue(user.check_password('Strong-Setup-7391!'))
        self.assertEqual(client.get(URL).status_code, 404)
        user.delete()
        self.assertEqual(client.post(URL, self.payload(), HTTP_X_CSRFTOKEN=token).status_code, 404)

    def test_existing_superuser_closes_setup(self):
        get_user_model().objects.create_superuser(username='existing', password='Strong-Setup-7391!')
        self.assertEqual(self.client.get(URL).status_code, 404)
        self.assertEqual(self.client.post(URL, self.payload()).status_code, 404)

    def test_invalid_password_does_not_consume_setup(self):
        self.assertEqual(self.client.post(URL, self.payload(password2='different')).status_code, 400)
        self.assertFalse(SuperuserBootstrap.objects.exists())
