import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from practice.models import PracticeNode


class PracticeHubTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('hub', password='test')
        self.client.force_login(self.user)
        self.base = '/api/en/practice-hub/nodes/'

    def create(self, **data):
        return self.client.post(self.base, json.dumps(data), content_type='application/json')

    def test_three_folder_levels_and_move_cycle(self):
        parent = None
        ids = []
        for title in ('A', 'B', 'C'):
            response = self.create(kind='folder', title=title, parent=parent)
            self.assertEqual(response.status_code, 201, response.content)
            parent = response.json()['node']['id']
            ids.append(parent)
        self.assertEqual(self.create(kind='folder', title='D', parent=parent).status_code, 400)
        self.assertEqual(self.create(kind='theory', title='At level 3', parent=parent, payload={'content':'Hello'}).status_code, 201)
        response = self.client.patch(f'{self.base}{ids[0]}/', json.dumps({'parent':ids[2]}), content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_import_rolls_back_all_nodes(self):
        response = self.client.post('/api/en/practice-hub/import/', json.dumps({'nodes':[
            {'kind':'folder','title':'Valid'}, {'kind':'exercise','title':'Invalid','payload':{}}
        ]}), content_type='application/json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(PracticeNode.objects.count(), 0)

    def test_required_answers_links_and_access(self):
        theory = self.create(kind='theory', title='Theory', payload={'format':'html','content':'<p>Hello</p>'}).json()['node']
        response = self.create(kind='exercise', title='Writing', links=[theory['id']], payload={
            'presentation':{'interaction':'short_answer'}, 'questions':[{'prompt':'Translate hello','accepted_answers':['xin chào']}]
        })
        self.assertEqual(response.status_code, 201, response.content)
        node = response.json()['node']
        self.assertEqual(node['payload']['questions'][0]['accepted_answers'], ['xin chào'])
        self.assertEqual(node['links'], [theory['id']])
        self.assertNotIn('payload', self.client.get(self.base).json()['nodes'][0])
        self.assertIn('payload', self.client.get(self.base+'?full=1').json()['nodes'][0])
        other = get_user_model().objects.create_user('other-hub')
        self.client.force_login(other)
        self.assertEqual(self.client.get(f'{self.base}{node["id"]}/').status_code, 404)

    def test_malformed_presentation_is_validation_error(self):
        self.assertEqual(self.create(kind='exercise', title='Invalid', payload={'presentation':[]}).status_code, 400)
