import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from practice.models import PracticeNode

class BulkDeleteTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('owner')
        self.other=get_user_model().objects.create_user('other')
        self.client.force_login(self.user)
    def node(self,**kwargs):
        return PracticeNode.objects.create(**{'owner':self.user,'language':'en','kind':'folder','title':'Folder',**kwargs})
    def delete(self,ids):
        return self.client.post('/api/en/practice-hub/organize/',json.dumps({'action':'delete','ids':ids}),content_type='application/json')
    def test_deletes_selection_and_descendants_once(self):
        parent=self.node();child=self.node(parent=parent);other=self.node();keep=self.node()
        response=self.delete([parent.pk,child.pk,other.pk])
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['deleted'],3)
        self.assertEqual(list(PracticeNode.objects.values_list('pk',flat=True)),[keep.pk])
    def test_foreign_or_other_language_selection_is_atomic(self):
        own=self.node()
        for forbidden in [self.node(owner=self.other),self.node(language='de')]:
            self.assertEqual(self.delete([own.pk,forbidden.pk]).status_code,400)
            self.assertTrue(PracticeNode.objects.filter(pk=own.pk).exists())
    def test_empty_selection_rejected(self):
        self.assertEqual(self.delete([]).status_code,400)
