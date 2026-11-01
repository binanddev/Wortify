"""Large-library reads stay bounded without changing the study contract."""
import uuid
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from cards.models import Card, Deck, StudyAttempt, StudySession


class DeckLoadingTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user('deck-pages')
        cls.other = get_user_model().objects.create_user('deck-pages-other')
        cls.deck = Deck.objects.create(owner=cls.user, language='en', title='Large')
        Card.objects.bulk_create([Card(deck=cls.deck, german_text=f'Term {i:03}', vietnamese_meaning=f'Meaning {i:03}', position=i) for i in range(125)])
        cls.foreign = Deck.objects.create(owner=cls.other, language='en', title='Private')

    def setUp(self):
        self.client.force_login(self.user)

    def test_management_pages_are_bounded_and_do_not_load_learning_state(self):
        url = f'/api/en/decks/{self.deck.pk}/'
        with CaptureQueriesContext(connection) as queries:
            response = self.client.get(url, {'cards_page': 2, 'page_size': 50})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['pagination'], {'page': 2, 'size': 50, 'count': 125})
        self.assertEqual(len(data['cards']), 50)
        self.assertEqual(data['cards'][0]['german_text'], 'Term 050')
        self.assertNotIn('learning', data)
        self.assertFalse(any('cards_decklearningstate' in query['sql'].lower() for query in queries))
        full = self.client.get(url).json()
        self.assertEqual(len(full['cards']), 125)
        self.assertIn('learning', full)

    def test_search_and_page_clamping_apply_on_server(self):
        url = f'/api/en/decks/{self.deck.pk}/'
        data = self.client.get(url, {'cards_page': 99, 'page_size': 4, 'q': 'Meaning 01'}).json()
        self.assertEqual(data['pagination'], {'page': 3, 'size': 4, 'count': 10})
        self.assertEqual([card['german_text'] for card in data['cards']], ['Term 018', 'Term 019'])
        self.assertEqual(self.client.get(url, {'cards_page': 1, 'page_size': 10000}).json()['pagination']['size'], 100)
        self.assertEqual(self.client.get(url, {'cards_page': 'bad'}).status_code, 400)
        self.assertEqual(self.client.get(f'/api/en/decks/{self.foreign.pk}/', {'cards_page': 1}).status_code, 404)
        self.assertEqual(self.client.get(f'/api/de/decks/{self.deck.pk}/', {'cards_page': 1}).status_code, 404)

    def test_resume_checks_older_batches_without_materializing_all_sessions(self):
        card = self.deck.cards.first()
        attempt = StudyAttempt.objects.create(user=self.user, card=card, mode='write')
        older = StudySession.objects.create(user=self.user, language='en', kind='learn', tokens=[str(attempt.token)])
        StudySession.objects.bulk_create([StudySession(user=self.user, language='en', kind='learn', tokens=[str(uuid.uuid4())]) for _ in range(60)])
        with CaptureQueriesContext(connection) as queries:
            data = self.client.get('/api/en/decks/').json()
        self.assertEqual(data['resume'], str(older.token))
        reads = [query['sql'].upper() for query in queries if 'FROM "cards_studysession"' in query['sql']]
        self.assertTrue(reads)
        self.assertTrue(all('LIMIT 25' in sql for sql in reads))
        latest = StudySession.objects.create(user=self.user, language='en', kind='learn', tokens=[str(attempt.token)])
        with CaptureQueriesContext(connection) as queries:
            data = self.client.get('/api/en/decks/').json()
        self.assertEqual(data['resume'], str(latest.token))
        self.assertEqual(len([q for q in queries if 'FROM "cards_studysession"' in q['sql']]), 1)


class DeckReadTransactionTests(TransactionTestCase):
    def test_first_deck_read_does_not_write_or_hold_an_atomic_transaction(self):
        from unittest.mock import patch
        from cards.models import DeckLearningState, StudySettings
        from api.learning_sync import state_payload
        user = get_user_model().objects.create_user('first-read')
        deck = Deck.objects.create(owner=user, language='en', title='First read')
        self.client.force_login(user)
        atomic_states = []

        def observe(state):
            atomic_states.append(connection.in_atomic_block)
            return state_payload(state)

        with patch('api.learning_sync.state_payload', side_effect=observe), CaptureQueriesContext(connection) as queries:
            response = self.client.get(f'/api/en/decks/{deck.pk}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(atomic_states, [False])
        self.assertEqual(response.json()['learning']['progress'], {})
        self.assertFalse(DeckLearningState.objects.filter(user=user).exists())
        self.assertFalse(StudySettings.objects.filter(user=user).exists())
        self.assertFalse(any(query['sql'].lstrip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')) for query in queries))
