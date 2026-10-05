import json
from django.contrib.auth import get_user_model
from django.test import TestCase, SimpleTestCase
from django.urls import get_resolver
from .api_reference import reference_data, postman_collection, markdown_reference, NOTES, RECIPES


class ApiReferenceAccessTests(TestCase):
    def test_documented_exercise_recipe_can_be_created_and_published(self):
        user = get_user_model().objects.create_user('recipe-editor', is_staff=True)
        self.client.force_login(user)
        path = '/api/manage/content/'
        folder = self.client.post(path, json.dumps({'kind':'folder','title':'API example','language':'en'}), content_type='application/json')
        self.assertEqual(folder.status_code, 201, folder.content)
        recipe = RECIPES[0]
        response = self.client.post(path, json.dumps({**recipe['body'],'parent':folder.json()['id']}), content_type='application/json')
        self.assertEqual(response.status_code, 201, response.content)
        detail = response.json()
        publish = {**RECIPES[-1]['body'],'version':detail['version'],'cascade':False}
        response = self.client.patch(f"{path}{detail['id']}/", json.dumps(publish), content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['visibility'], 'public')

    def test_admin_only_including_downloads_and_no_secret_values(self):
        User = get_user_model()
        staff = User.objects.create_user('reference-staff', is_staff=True)
        admin = User.objects.create_user('reference-admin', is_staff=True, is_superuser=True)
        path = '/api/manage/api-docs/'
        self.assertEqual(self.client.get(path).status_code, 401)
        self.client.force_login(staff)
        for format in ('json', 'postman', 'markdown'):
            self.assertEqual(self.client.get(path, {'format':format}).status_code, 403)
        with self.settings(SECRET_KEY='sentinel-not-exported', BACKEND_MONITOR_SECRET='monitor-never-exported', SUPERUSER_SETUP_KEY='bootstrap-never-exported'):
            self.client.force_login(admin)
            for format in ('json', 'postman', 'markdown'):
                response = self.client.get(path, {'format':format})
                self.assertEqual(response.status_code, 200)
                for secret in ('sentinel-not-exported','monitor-never-exported','bootstrap-never-exported'):
                    self.assertNotIn(secret.encode(), response.content)
                if format != 'json': self.assertIn('attachment', response['Content-Disposition'])
        self.client.force_login(admin)
        self.assertEqual(self.client.get(path, {'format':'invalid'}).status_code, 400)


class ApiReferenceContractTests(SimpleTestCase):
    def test_every_api_route_has_documentation_and_relevant_examples(self):
        data = reference_data()
        routes = [p for p in get_resolver().url_patterns if getattr(p.pattern, '_route', '').startswith('api/')]
        self.assertEqual(len(data['endpoints']), len(routes))
        self.assertEqual(len({r['path'] for r in data['endpoints']}), len(routes))
        for row in data['endpoints']:
            self.assertIn(row['source'], NOTES, row['path'])
            self.assertTrue(row['methods'])
        upload = next(r for r in data['endpoints'] if r['path']=='/api/me/background/')
        self.assertEqual(upload['multipart'][0][0], 'image')
        detail = next(r for r in data['endpoints'] if r['path']=='/api/manage/content/{pk}/')
        self.assertIn('version', detail['examples']['PATCH'])

    def test_postman_cookie_workflow_and_portable_secrets(self):
        data = reference_data()
        collection = postman_collection(data)
        json.loads(json.dumps(collection))
        self.assertTrue(collection['info']['schema'].endswith('/v2.1.0/collection.json'))
        self.assertEqual([r['request']['method'] for r in collection['item'][0]['item']], ['GET','POST','GET'])
        variables = {v['key']:v['value'] for v in collection['variable']}
        for name in ('username','password','newPassword','setup_key','monitorKey'):
            self.assertEqual(variables[name], '')
        self.assertIn('csrftoken', '\n'.join(collection['event'][0]['script']['exec']))
        requests = [r['request'] for f in collection['item'] for r in f['item']]
        self.assertTrue(all(r['url'].startswith('{{baseUrl}}/api/') for r in requests))
        for request in requests:
            if request.get('body',{}).get('mode')=='formdata':
                self.assertNotIn('Content-Type', {h['key'] for h in request['header']})
        self.assertIn('X-CSRFToken', markdown_reference(data))
