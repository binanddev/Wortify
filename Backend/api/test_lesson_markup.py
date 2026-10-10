import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from practice.models import PracticeNode, PracticeMedia
from .practice_media import media_data

class LessonMarkupTests(TestCase):
    def setUp(self):
        self.owner=get_user_model().objects.create_user('lesson-owner')
        self.reader=get_user_model().objects.create_user('lesson-reader')
        self.client.force_login(self.owner)
        self.folder=PracticeNode.objects.create(owner=self.owner,language='en',kind='folder',title='Lessons',visibility='public')
        self.asset=PracticeMedia.objects.create(owner=self.owner,language='en',file='practice_media/lesson.png',name='lesson.png',size=10,content_type='image/png')
    def create(self, asset, visibility='private'):
        return self.client.post('/api/en/practice-hub/nodes/',json.dumps({
            'kind':'theory','title':'Formatted theory','parent':self.folder.pk,'visibility':visibility,
            'payload':{'format':'markdown','content':r'\includegraphics[width=50%]{'+media_data(asset)['url']+'}',
                       'attachments':[media_data(asset)]}}),content_type='application/json')
    def test_theory_attachments_validate_ownership_and_visibility(self):
        response=self.create(self.asset)
        self.assertEqual(response.status_code,201,response.content)
        node=PracticeNode.objects.get(pk=response.json()['node']['id'])
        self.assertEqual(list(node.attachments.all()),[self.asset])
        self.client.force_login(self.reader)
        self.assertEqual(self.client.get(media_data(self.asset)['url']).status_code,404)
        node.visibility='public';node.save()
        self.assertEqual(self.client.get(media_data(self.asset)['url']).status_code,200)
        self.client.force_login(self.owner)
        foreign=PracticeMedia.objects.create(owner=self.reader,language='en',file='x.png',name='x.png',size=10,content_type='image/png')
        self.assertEqual(self.create(foreign).status_code,400)
    def test_copy_remaps_embedded_image_and_retains_markup(self):
        response=self.create(self.asset,'public')
        self.assertEqual(response.status_code,201)
        self.client.force_login(self.reader)
        copied=self.client.post(f'/api/en/practice-hub/nodes/{self.folder.pk}/copy/')
        self.assertEqual(copied.status_code,201,copied.content)
        theory=PracticeNode.objects.get(owner=self.reader,kind='theory')
        media=theory.attachments.get()
        self.assertNotEqual(media.pk,self.asset.pk)
        self.assertIn(media_data(media)['url'],theory.payload['content'])
        self.assertNotIn(str(self.asset.pk),theory.payload['content'])
        self.assertIn(r'\includegraphics[width=50%]',theory.payload['content'])
