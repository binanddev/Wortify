from django.test import TestCase
from django.contrib.auth import get_user_model
from cards.models import Deck, Card, StudyProgress

class DeckWorkspaceTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('workspace-owner')
        self.other=get_user_model().objects.create_user('other-owner')
        self.deck=Deck.objects.create(owner=self.user,language='en',title='Travel')
        self.card=Card.objects.create(deck=self.deck,german_text='bus',vietnamese_meaning='xe buýt')
        self.progress=StudyProgress.objects.create(user=self.user,card=self.card)
        self.client.force_login(self.user)
        self.url=f'/api/en/decks/{self.deck.pk}/'
    def test_remove_restore_preserves_data(self):
        self.assertEqual(self.client.patch(self.url,{'archived':True},content_type='application/json').status_code,200)
        self.assertEqual(self.client.get('/api/en/decks/').json()['decks'],[])
        self.assertTrue(self.client.get('/api/en/decks/?include_archived=true').json()['decks'][0]['archived'])
        self.assertTrue(Card.objects.filter(pk=self.card.pk).exists())
        self.assertTrue(StudyProgress.objects.filter(pk=self.progress.pk).exists())
        self.assertEqual(self.client.patch(self.url,{'archived':False},content_type='application/json').status_code,200)
        self.assertEqual(len(self.client.get('/api/en/decks/').json()['decks']),1)
    def test_permission_language_and_validation(self):
        self.assertEqual(self.client.patch(self.url,{'archived':'false'},content_type='application/json').status_code,400)
        self.assertEqual(self.client.patch(self.url.replace('/en/','/de/'),{'archived':True},content_type='application/json').status_code,404)
        self.client.force_login(self.other)
        self.assertEqual(self.client.patch(self.url,{'archived':True},content_type='application/json').status_code,404)
        self.assertEqual(self.client.get('/api/en/decks/?include_archived=true').json()['decks'],[])

    def test_root_folder_hides_descendants_without_changing_cards(self):
        from cards.models import Folder
        root=Folder.objects.create(owner=self.user,language='en',name='Root')
        child=Folder.objects.create(owner=self.user,language='en',name='Child',parent=root)
        self.deck.folder=child
        self.deck.save()
        url=f'/api/en/folders/{root.pk}/'
        self.assertEqual(self.client.patch(url,{'archived':True},content_type='application/json').status_code,200)
        visible=self.client.get('/api/en/decks/').json()
        self.assertEqual(visible['folders'],[])
        self.assertEqual(visible['decks'],[])
        self.assertEqual(len(self.client.get('/api/en/decks/?include_archived=true').json()['folders']),2)
        self.assertTrue(StudyProgress.objects.filter(pk=self.progress.pk).exists())
        self.assertEqual(self.client.patch(url,{'archived':False},content_type='application/json').status_code,200)
        self.assertEqual(len(self.client.get('/api/en/decks/').json()['folders']),2)
        self.assertEqual(self.client.delete(url+'?delete_contents=true').status_code,200)
        self.assertFalse(Folder.objects.filter(pk=child.pk).exists())
        self.assertFalse(Deck.objects.filter(pk=self.deck.pk).exists())

    def test_folder_owner_and_bool_validation(self):
        from cards.models import Folder
        root=Folder.objects.create(owner=self.other,language='en',name='Private')
        url=f'/api/en/folders/{root.pk}/'
        self.assertEqual(self.client.patch(url,{'archived':True},content_type='application/json').status_code,404)
        self.assertEqual(self.client.delete(url+'?delete_contents=true').status_code,404)
