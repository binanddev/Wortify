from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from cards.models import Deck, Card, StudyProgress, StudySettings
from cards.services.study import queue


class QueuePerformanceTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username='queue-test')
        self.deck = Deck.objects.create(owner=self.user, title='German', language='de')
        self.other = Deck.objects.create(owner=self.user, title='English', language='en')
        self.cards = [Card.objects.create(deck=self.deck, german_text=str(i), vietnamese_meaning=str(i), position=i) for i in range(3)]
        Card.objects.create(deck=self.other, german_text='other', vietnamese_meaning='other')
        self.settings = StudySettings.objects.create(user=self.user, language='de', new_cards_per_day=1)
        StudyProgress.objects.create(user=self.user, card=self.cards[0], due_at=timezone.now()-timedelta(days=1))
        StudyProgress.objects.create(user=self.user, card=self.cards[1], state='weak', due_at=timezone.now()+timedelta(days=1))

    def test_browse_uses_one_query(self):
        with self.assertNumQueries(1):
            self.assertEqual(queue(self.user, self.settings, language='de'), self.cards)

    def test_filters_use_two_queries_and_preserve_results(self):
        for name, expected in [('new', [self.cards[2]]), ('due', [self.cards[0]]), ('weak', [self.cards[1]]), ('review', self.cards[:2])]:
            with self.subTest(name=name), self.assertNumQueries(2):
                self.assertEqual(queue(self.user, self.settings, self.deck.pk, name, language='de'), expected)

    def test_learning_keeps_daily_limit_and_due_priority(self):
        with self.assertNumQueries(3):
            self.assertEqual(queue(self.user, self.settings, self.deck.pk, learn=True, language='de'), [self.cards[0], self.cards[2]])
