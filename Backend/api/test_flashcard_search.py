from django.test import TestCase
from django.contrib.auth import get_user_model
from cards.models import Deck,Card,Folder


class FlashcardSearchTests(TestCase):
    def setUp(self):
        self.author=get_user_model().objects.create_user('search-author',first_name='Anna',last_name='Vogt')
        self.root=Folder.objects.create(owner=self.author,language='de',name='B1 – Giao tiếp',theory_format='html',theory_content='<p>Cuộc sống hằng ngày</p>')
        self.child=Folder.objects.create(owner=self.author,language='de',name='Du lịch',parent=self.root)
        self.deck=Deck.objects.create(owner=self.author,language='de',folder=self.child,title='Transport',description='Useful railway vocabulary',topic='Travel',level='B1',visibility='public')
        Card.objects.create(deck=self.deck,german_text='Bahnhof',vietnamese_meaning='nhà ga',notes='Fahrkartenautomat',accepted_answers=['Station'],usage='Regionalverkehr')
        self.other_root=Folder.objects.create(owner=self.author,language='de',name='Workplace')
        self.other=Deck.objects.create(owner=self.author,language='de',folder=self.other_root,title='Office',level='B2',visibility='public')
        self.url='/api/de/flashcard/discover/'

    def search(self,**params):
        response=self.client.get(self.url,params)
        self.assertEqual(response.status_code,200,response.content)
        return response.json()

    def test_all_public_fields_and_unicode_are_searchable(self):
        for query in ['B1','railway','Travel','Anna Vogt','search-author','giao tiep','cuoc song','Du lịch','nhà ga','Fahrkartenautomat','Station','Regionalverkehr','Deutsch']:
            with self.subTest(query=query):
                result=self.search(q=query)
                self.assertIn(self.deck.pk,[row['id'] for row in result['results']])
                if query not in ('Deutsch','Anna Vogt','search-author'): self.assertEqual(result['results'][0]['id'],self.deck.pk)
        self.assertFalse(self.search(q='B1')['approximate'])

    def test_exact_results_outrank_typos_and_history(self):
        Deck.objects.create(owner=self.author,language='de',title='Transprot',visibility='public')
        result=self.search(q='Transport',recent_folders=str(self.other_root.pk))
        self.assertEqual(result['results'][0]['id'],self.deck.pk)
        result=self.search(q='Transportt')
        self.assertEqual(result['results'][0]['id'],self.deck.pk)
        self.assertTrue(result['approximate'])

    def test_no_match_suggests_closest_without_relaxing_filters(self):
        result=self.search(q='zzzzxyq')
        self.assertTrue(result['results'])
        self.assertTrue(result['approximate'])
        result=self.search(q='Transport',level='C2')
        self.assertEqual(result['total'],0)
        result=self.search(q='Transport',topic='nonexistenttopic')
        self.assertEqual(result['total'],0)

    def test_folders_are_grouped_and_navigable_with_counts(self):
        result=self.search(browse=1,q='B1')
        self.assertEqual([(row['kind'],row['id']) for row in result['results']],[('folder',self.root.pk)])
        self.assertEqual(result['results'][0]['deck_count'],1)
        result=self.search(browse=1,folder=self.root.pk)
        self.assertEqual(result['results'][0]['id'],self.child.pk)
        result=self.search(browse=1,folder=self.child.pk)
        self.assertEqual(result['results'][0]['kind'],'deck')
        self.assertEqual(result['results'][0]['id'],self.deck.pk)
        self.assertEqual([row['id'] for row in result['ancestors']],[self.root.pk,self.child.pk])
        result=self.search(browse=1,folder=self.child.pk,level='C2')
        self.assertEqual(result['total'],0)
        self.assertEqual(result['ancestors'][-1]['id'],self.child.pk)

    def test_recent_queries_and_folders_prioritize_browsing_not_active_relevance(self):
        import json
        self.assertEqual(self.search(browse=1)['results'][0]['id'],self.other_root.pk)
        result=self.search(browse=1,recent=json.dumps(['B1']))
        self.assertEqual(result['results'][0]['id'],self.root.pk)
        result=self.search(browse=1,recent_folders=str(self.root.pk))
        self.assertEqual(result['results'][0]['id'],self.root.pk)
        result=self.search(browse=1,recent=json.dumps(['B2','B1']),recent_folders=str(self.root.pk))
        self.assertEqual(result['results'][0]['id'],self.other_root.pk)
        result=self.search(browse=1,q='Transport',recent_folders=str(self.other_root.pk))
        self.assertEqual(result['results'][0]['id'],self.root.pk)

    def test_private_disabled_and_other_language_never_enter_cached_results(self):
        hidden=Folder.objects.create(owner=self.author,language='de',name='Private folder')
        private=Deck.objects.create(owner=self.author,language='de',folder=hidden,title='Secret',visibility='private')
        foreign=Deck.objects.create(owner=self.author,language='en',title='English secret',visibility='public')
        self.assertNotIn(private.pk,[row['id'] for row in self.search(q='Secret')['results']])
        self.assertNotIn(foreign.pk,[row['id'] for row in self.search(q='English secret')['results']])
        self.assertEqual(self.client.get(self.url,{'browse':1,'folder':hidden.pk}).status_code,404)
        Deck.objects.filter(pk=self.deck.pk).update(visibility='private')
        self.assertNotIn(self.deck.pk,[row['id'] for row in self.search(q='B1')['results']])
        get_user_model().objects.filter(pk=self.author.pk).update(is_active=False)
        self.assertEqual(self.search(browse=1,recent_folders=str(hidden.pk))['total'],0)

    def test_index_reuses_card_text_and_refreshes_after_card_folder_and_bulk_edits(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        self.search(q='Bahnhof')
        with CaptureQueriesContext(connection) as queries:
            self.search(q='Station')
        self.assertFalse(any('FROM "cards_card"' in query['sql'] for query in queries.captured_queries))
        card=self.deck.cards.get();card.notes='Schnellzug';card.save()
        self.assertEqual(self.search(q='Schnellzug')['results'][0]['id'],self.deck.pk)
        Folder.objects.filter(pk=self.root.pk).update(name='Bahnreisen')
        self.assertEqual(self.search(q='Bahnreisen')['results'][0]['id'],self.deck.pk)
        Card.objects.filter(pk=card.pk).update(german_text='Expresszug')
        from .flashcard_search import _snapshots
        _snapshots['de']['at']-=61
        self.assertEqual(self.search(q='Expresszug')['results'][0]['id'],self.deck.pk)

    def test_pagination_and_saved_ids_remain_compatible(self):
        reader=get_user_model().objects.create_user('search-reader')
        saved=Deck.objects.create(owner=reader,language='de',title='Copy',source_deck=self.deck)
        self.client.force_login(reader)
        for i in range(27):Deck.objects.create(owner=self.author,language='de',title=f'Public {i}',visibility='public')
        first=self.search()
        second=self.search(page=2)
        self.assertEqual(len(first['results']),24)
        self.assertTrue(second['results'])
        self.assertFalse({row['id'] for row in first['results']} & {row['id'] for row in second['results']})
        result=self.search(q='Transport')
        self.assertEqual(result['results'][0]['saved_id'],saved.pk)
