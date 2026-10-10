from django.test import TestCase
from django.contrib.auth import get_user_model

class AdminGridTests(TestCase):
    def setUp(self):
        User=get_user_model()
        self.admin=User.objects.create_superuser('root','r@example.com','test')
        self.client.force_login(self.admin)
        User.objects.create_user('z-user');User.objects.create_user('a-user')
        User.objects.create_user('staff',is_staff=True)
    def test_multi_sort_and_filter_before_pagination(self):
        response=self.client.get('/api/manage/users/?ordering=role,-username')
        self.assertEqual(response.status_code,200)
        self.assertEqual([u['username'] for u in response.json()['users']],['z-user','a-user','staff','root'])
        response=self.client.get('/api/manage/users/?role=user&ordering=username')
        self.assertEqual([u['username'] for u in response.json()['users']],['a-user','z-user'])
    def test_invalid_sort_rejected(self):
        self.assertEqual(self.client.get('/api/manage/users/?ordering=password').status_code,400)
        self.assertEqual(self.client.get('/api/manage/activity/?ordering=unknown').status_code,400)
        self.assertEqual(self.client.get('/api/manage/content/?ordering=unknown').status_code,400)
