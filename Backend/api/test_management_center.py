import json
from django.contrib.admin.models import LogEntry
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from practice.models import PracticeNode


class ManagementWorkspaceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.admin = User.objects.create_user('administrator', is_staff=True, is_superuser=True)
        cls.staff = User.objects.create_user('editor', is_staff=True)
        cls.learner = User.objects.create_user('learner', email='learner@example.com')
        cls.folder = PracticeNode.objects.create(owner=cls.admin, language='en', kind='folder', title='System lessons')
        cls.theory = PracticeNode.objects.create(owner=cls.admin, language='en', kind='theory', parent=cls.folder, title='Greetings', payload={'format':'markdown', 'content':'Hello'})

    def setUp(self):
        self.client.force_login(self.staff)

    def write(self, path, data, method='patch'):
        return getattr(self.client, method)(path, json.dumps(data), content_type='application/json')

    def detail(self, node):
        return self.client.get(f'/api/manage/content/{node.pk}/').json()

    def test_staff_operates_content_but_not_privileged_accounts_or_system(self):
        self.assertEqual(self.client.get('/api/manage/summary/').json()['users'], 1)
        self.assertEqual(self.client.get('/api/manage/content/').json()['total'], 2)
        self.assertEqual(self.client.get(f'/api/manage/users/{self.admin.pk}/').status_code, 404)
        self.assertEqual(self.client.get('/api/manage/overview/').status_code, 403)
        self.assertEqual(self.client.get('/api/manage/appearance/').status_code, 403)
        self.client.force_login(self.learner)
        for path in ('summary/', 'activity/', 'content/', f'content/{self.theory.pk}/'):
            self.assertEqual(self.client.get('/api/manage/'+path).status_code, 403)

    def test_edit_system_content_keeps_owner_and_prevents_lost_updates(self):
        url = f'/api/manage/content/{self.theory.pk}/'
        data = self.detail(self.theory)
        result = self.write(url, {'version':data['version'], 'title':'New title', 'payload':{'format':'markdown','content':'Changed'}})
        self.assertEqual(result.status_code, 200, result.content)
        self.theory.refresh_from_db()
        self.assertEqual(self.theory.owner, self.admin)
        self.assertEqual(self.theory.payload['content'], 'Changed')
        self.assertEqual(self.write(url, {'version':data['version'],'title':'Stale overwrite'}).status_code, 409)
        self.assertEqual(self.write(url, {'version':result.json()['version'],'owner':self.staff.pk}).status_code, 400)
        self.assertEqual(LogEntry.objects.latest('pk').user, self.staff)

    def test_publish_tree_requires_reason_and_preserves_learning_revision(self):
        data = self.detail(self.folder)
        url = f'/api/manage/content/{self.folder.pk}/'
        payload = {'version':data['version'],'visibility':'public','cascade':True}
        self.assertEqual(self.write(url, payload).status_code, 400)
        before = self.theory.updated_at
        previous_version = self.detail(self.theory)['version']
        response = self.write(url, {**payload,'reason':'Đã kiểm tra nội dung'})
        self.assertEqual(response.status_code, 200, response.content)
        self.theory.refresh_from_db()
        self.assertEqual(self.theory.visibility, 'public')
        self.assertEqual(self.theory.updated_at, before)
        # A stale child editor must see a conflict after a cascade.
        self.assertEqual(self.write(f'/api/manage/content/{self.theory.pk}/', {'version':previous_version,'title':'Stale'}).status_code, 409)
        self.assertEqual(self.write(url, {'version':response.json()['version'],'visibility':'public','cascade':True}).status_code, 400)

    def test_editorial_upload_keeps_owner_and_private_media_access(self):
        import tempfile
        from .tests import PracticeMediaTests
        from practice.models import PracticeMedia
        exercise = PracticeNode.objects.create(owner=self.admin, language='en', kind='exercise', parent=self.folder, title='Media lesson')
        with tempfile.TemporaryDirectory() as media_root, self.settings(MEDIA_ROOT=media_root):
            response = self.client.post(f'/api/manage/content/{exercise.pk}/media/', {'file':PracticeMediaTests.image(self)})
            self.assertEqual(response.status_code, 201, response.content)
            media = response.json()['media']
            self.assertEqual(PracticeMedia.objects.get(pk=media['id']).owner, self.admin)
            self.assertEqual(LogEntry.objects.latest('pk').user, self.staff)
            response = self.client.get(media['url'])
            self.assertEqual(response.status_code, 200)
            response.close()
            self.client.force_login(self.learner)
            self.assertEqual(self.client.get(media['url']).status_code, 404)
            self.assertEqual(self.client.post(f'/api/manage/content/{exercise.pk}/media/').status_code, 403)

    def test_create_validation_filters_and_delete_confirmation(self):
        response = self.write('/api/manage/content/', {'kind':'folder','language':'de','title':'My lessons'}, 'post')
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertEqual(data['owner']['id'], self.staff.pk)
        self.assertEqual(data['visibility'], 'private')
        self.assertEqual(self.client.get('/api/manage/content/?language=de&source=mine').json()['total'], 1)
        self.assertEqual(self.client.get('/api/manage/content/?language=invalid').status_code, 400)
        self.assertEqual(self.write('/api/manage/content/', {'kind':'exercise','title':'No folder','language':'en'}, 'post').status_code, 400)
        url = f"/api/manage/content/{data['id']}/"
        self.assertEqual(self.write(url, {'version':data['version'],'confirm':'wrong','reason':'Duplicate'}, 'delete').status_code, 400)
        self.assertEqual(self.write(url, {'version':data['version'],'confirm':data['title'],'reason':'Duplicate'}, 'delete').status_code, 200)

    def test_roles_filters_sessions_and_audit(self):
        self.client.force_login(self.admin)
        url = f'/api/manage/users/{self.learner.pk}/'
        self.assertEqual(self.write(url, {'role':'staff'}).status_code, 200)
        self.learner.refresh_from_db(); self.assertTrue(self.learner.is_staff)
        self.assertEqual(self.client.get('/api/manage/users/?role=staff&status=active').json()['total'], 2)
        self.assertEqual(self.write(f'/api/manage/users/{self.admin.pk}/', {'role':'user'}).status_code, 400)
        self.assertEqual(self.write(url, {'role':'user','is_active':False,'reason':'Support request'}).status_code, 200)
        self.assertEqual(self.client.get('/api/manage/users/?status=inactive&q=learner').json()['total'], 1)
        self.client.force_login(self.staff)
        self.assertEqual(self.client.get('/api/manage/activity/').json()['total'], 0)
        self.assertEqual(self.write(url, {'role':'staff'}).status_code, 403)

    def test_account_delete_requires_name_and_reason(self):
        url = f'/api/manage/users/{self.learner.pk}/'
        self.assertEqual(self.client.delete(url).status_code, 400)
        self.assertEqual(self.write(url, {'confirm':'learner','reason':'Duplicate account'}, 'delete').status_code, 200)
        self.assertIn('Duplicate account', LogEntry.objects.latest('pk').change_message)

    def test_csrf_is_enforced_for_editorial_changes(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.staff)
        self.assertEqual(client.post('/api/manage/content/', '{}', content_type='application/json').status_code, 403)
