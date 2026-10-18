from django.test import TestCase
from django.contrib.auth import get_user_model
from cards.models import Deck, Card

class FlashcardDiscoveryTests(TestCase):
    def setUp(self):
        self.author=get_user_model().objects.create_user('deck-author')
        self.user=get_user_model().objects.create_user('deck-reader')
        self.source=Deck.objects.create(owner=self.author,language='de',title='Transport',topic='Travel',level='A2',visibility='public')
        self.card=Card.objects.create(deck=self.source,german_text='Bus',vietnamese_meaning='bus',example_german='Ich fahre Bus.')
        self.url=f'/api/de/flashcard/discover/{self.source.pk}/copy/'
        self.client.force_login(self.user)

    def test_discovery_filters_and_copy_is_independent(self):
        Deck.objects.create(owner=self.author,language='de',title='Private')
        self.assertEqual(self.client.get('/api/de/flashcard/discover/?q=Transport&level=A2').json()['total'],1)
        self.assertEqual(self.client.get('/api/de/flashcard/discover/?level=B2').json()['total'],0)
        result=self.client.post(self.url,{},content_type='application/json')
        self.assertEqual(result.status_code,201,result.content)
        saved=Deck.objects.get(pk=result.json()['id'])
        self.assertEqual(saved.owner,self.user)
        self.assertEqual(saved.visibility,'private')
        self.assertNotEqual(saved.cards.get().pk,self.card.pk)
        self.assertEqual(saved.cards.get().example_german,self.card.example_german)
        self.assertEqual(self.client.post(self.url,{},content_type='application/json').json()['id'],saved.pk)
        self.card.german_text='Changed';self.card.save()
        self.assertEqual(saved.cards.get().german_text,'Bus')
        self.source.delete()
        saved.refresh_from_db()
        self.assertIsNone(saved.source_deck_id)
        self.assertEqual(saved.cards.count(),1)

    def test_private_other_language_and_disabled_owner_are_blocked(self):
        self.assertEqual(self.client.post(self.url.replace('/de/','/en/'),{},content_type='application/json').status_code,404)
        self.source.visibility='private';self.source.save()
        self.assertEqual(self.client.post(self.url,{},content_type='application/json').status_code,404)
        self.source.visibility='public';self.source.save()
        self.author.is_active=False;self.author.save()
        self.assertEqual(self.client.post(self.url,{},content_type='application/json').status_code,404)
        self.assertEqual(self.client.get('/api/de/flashcard/discover/').json()['total'],0)
