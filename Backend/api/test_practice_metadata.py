from django.test import TestCase
from django.contrib.auth import get_user_model
from practice.models import PracticeNode

class PracticeMetadataTests(TestCase):
    def test_catalog_omits_payload_but_preserves_legacy_exercise_mode(self):
        user=get_user_model().objects.create_user('metadata-owner')
        self.client.force_login(user)
        folder=PracticeNode.objects.create(owner=user,language='en',kind='folder',title='Folder')
        node=PracticeNode.objects.create(parent=folder,owner=user,language='en',kind='exercise',title='Legacy choice',payload={'kind':'choice','context':'x'*10000,'questions':[]})
        response=self.client.get('/api/en/practice-hub/nodes/')
        self.assertEqual(response.status_code,200)
        row=next(row for row in response.json()['nodes'] if row['id']==node.pk)
        self.assertNotIn('payload',row)
        self.assertEqual(row['interaction'],'multiple_choice')
        detail=self.client.get(f'/api/en/practice-hub/nodes/{node.pk}/')
        self.assertEqual(detail.status_code,200)
        self.assertEqual(len(detail.json()['node']['payload']['context']),10000)
