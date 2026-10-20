from django.contrib.auth import get_user_model
from django.test import TestCase
from cards.models import Deck, Card, StudyProgress

class DefenseDataTests(TestCase):
    def test_difficult_cards_come_from_owned_deck_srs(self):
        user=get_user_model().objects.create_user('defender')
        other=get_user_model().objects.create_user('other-defender')
        deck=Deck.objects.create(owner=user,language='de',title='Defense')
        cards=[Card.objects.create(deck=deck,german_text=f'Wort {i}',vietnamese_meaning='từ') for i in range(3)]
        StudyProgress.objects.create(user=user,card=cards[0],state='weak')
        StudyProgress.objects.create(user=user,card=cards[1],memory={'rating':2})
        StudyProgress.objects.create(user=other,card=cards[2],state='weak')
        self.client.force_login(user)
        response=self.client.get(f'/api/de/decks/{deck.pk}/')
        self.assertEqual(response.status_code,200)
        self.assertCountEqual(response.json()['difficult_cards'],[cards[0].pk,cards[1].pk])
        self.assertEqual(self.client.get(f'/api/en/decks/{deck.pk}/').status_code,404)
        self.client.force_login(other)
        self.assertEqual(self.client.get(f'/api/de/decks/{deck.pk}/').status_code,404)
