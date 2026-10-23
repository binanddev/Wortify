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


    def test_metadata_does_not_select_bodies_or_linked_payloads(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        user=get_user_model().objects.create_user('metadata-bodies')
        self.client.force_login(user)
        folder=PracticeNode.objects.create(owner=user,language='en',kind='folder',title='Folder',payload={'tags':['grammar']})
        first=PracticeNode.objects.create(parent=folder,owner=user,language='en',kind='exercise',title='First',payload={'presentation':{'interaction':'multiple_choice'},'context':'x'*100000})
        second=PracticeNode.objects.create(parent=folder,owner=user,language='en',kind='theory',title='Second',payload={'content':'y'*100000})
        first.links.add(second)
        with CaptureQueriesContext(connection) as queries:
            response=self.client.get('/api/en/practice-hub/nodes/?page=1&page_size=24')
        self.assertEqual(response.status_code,200)
        rows={row['id']:row for row in response.json()['nodes']}
        self.assertEqual(rows[first.pk]['links'],[second.pk])
        self.assertEqual(rows[folder.pk]['tags'],['grammar'])
        self.assertLess(len(response.content),3000)
        for query in queries.captured_queries:
            self.assertNotRegex(query['sql'],r'(?:SELECT(?: DISTINCT)? |, )"practice_practicenode"\."payload"(?:,| AS | FROM)')
        full=self.client.get('/api/en/practice-hub/nodes/?full=1').json()['nodes']
        self.assertEqual(response.json()['nodes'],[{k:v for k,v in row.items() if k!='payload'} for row in full])

    def test_workspace_keeps_owned_and_pinned_roots_without_unrelated_public_content(self):
        from practice.models import PracticeProgress
        owner=get_user_model().objects.create_user('metadata-workspace')
        other=get_user_model().objects.create_user('metadata-public')
        mine=PracticeNode.objects.create(owner=owner,language='en',kind='folder',title='Mine')
        public=PracticeNode.objects.create(owner=other,language='en',kind='folder',title='Pinned',visibility='public')
        child=PracticeNode.objects.create(owner=other,parent=public,language='en',kind='theory',title='Lesson',visibility='public')
        unrelated=PracticeNode.objects.create(owner=other,language='en',kind='folder',title='Other',visibility='public')
        private=PracticeNode.objects.create(owner=other,language='en',kind='folder',title='Private')
        PracticeProgress.objects.create(user=owner,node=child,revision=child.updated_at.isoformat(),completed=['1'])
        self.client.force_login(owner)
        response=self.client.get(f'/api/en/practice-hub/nodes/?scope=workspace&roots={child.pk},{private.pk}')
        rows={row['id']:row for row in response.json()['nodes']}
        self.assertEqual(set(rows),{mine.pk,public.pk,child.pk})
        self.assertEqual(rows[child.pk]['progress']['completed'],['1'])
        response=self.client.get(f'/api/en/practice-hub/nodes/?scope=workspace&current={child.pk}')
        self.assertEqual({row['id'] for row in response.json()['nodes']},{mine.pk,public.pk,child.pk})
        self.assertNotIn(unrelated.pk,rows)
        self.assertEqual(self.client.get('/api/en/practice-hub/nodes/?scope=workspace&roots=bad').status_code,400)

    def test_folder_pages_are_stable_and_only_include_authorized_items(self):
        user=get_user_model().objects.create_user('metadata-pages')
        self.client.force_login(user)
        folder=PracticeNode.objects.create(owner=user,language='en',kind='folder',title='Folder')
        children=[PracticeNode.objects.create(parent=folder,owner=user,language='en',kind='theory',title=f'Lesson {i}',position=i) for i in range(7)]
        response=self.client.get(f'/api/en/practice-hub/nodes/?parent={folder.pk}&page=2&page_size=3').json()
        self.assertEqual([row['id'] for row in response['nodes']],[node.pk for node in children[3:6]])
        self.assertEqual(response['total'],7)
        self.assertTrue(response['has_more'])
        response=self.client.get(f'/api/en/practice-hub/nodes/?parent={folder.pk}&q=Lesson 6').json()
        self.assertEqual([row['id'] for row in response['nodes']],[children[6].pk])
