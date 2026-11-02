"""Clean-install contracts: no seed data, local database or fixed content IDs."""
import json
import uuid

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from cards.models import Card, Deck, LearningEvent, StudyProgress
from practice.models import SystemContentPackage


@override_settings(SUPERUSER_SETUP_KEY='clean-install-test-key-not-for-deployment-2026')
class CleanStartTests(TestCase):
    password = 'CleanStart-Only!8936'
    setup_url = '/api/superuser-registration/clean-install-test-key-not-for-deployment-2026/'
    import_url = '/api/manage/content-packages/?section=flashcards&language=en'

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.client = Client(enforce_csrf_checks=True)
        self.assertFalse(get_user_model().objects.exists())
        self.assertFalse(Deck.objects.exists())
        self.assertFalse(SystemContentPackage.objects.exists())
        self.client.get('/api/session/')

    def post(self, path, data):
        return self.client.post(path, json.dumps(data), content_type='application/json',
                                HTTP_X_CSRFTOKEN=self.client.cookies['csrftoken'].value)

    def register(self, username, admin=False):
        response = self.post(self.setup_url if admin else '/api/session/', {
            'register': True, 'username': username,
            'password1': self.password, 'password2': self.password,
        })
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()['user']

    def document(self):
        return {
            'format': 'wortify-content', 'version': 1, 'id': str(uuid.uuid4()),
            'title': 'First English content', 'language': 'en', 'mode': 'append',
            'flashcards': [{'kind': 'deck', 'title': 'First journey', 'level': 'A1',
                           'topic': 'Travel', 'cards': [
                               {'german_text': 'train', 'vietnamese_meaning': 'tàu hỏa'},
                               {'german_text': 'ticket', 'vietnamese_meaning': 'vé'},
                           ]}],
        }

    def test_empty_install_and_new_account_have_safe_empty_responses(self):
        for lang in ('en', 'de'):
            for path, key in [('flashcard/discover/', 'results'),
                              ('reading/discover/', 'lessons'),
                              ('practice-hub/explore/?browse=1', 'results')]:
                response = self.client.get(f'/api/{lang}/{path}')
                self.assertEqual(response.status_code, 200, response.content)
                self.assertEqual(response.json()['total'], 0)
                self.assertEqual(response.json()[key], [])
        self.assertFalse(get_user_model().objects.exists())
        self.register('new-learner')
        for lang in ('en', 'de'):
            response = self.client.get(f'/api/{lang}/profile/')
            self.assertEqual(response.status_code, 200, response.content)
            data = response.json()
            self.assertEqual(data['cards']['total'], 0)
            self.assertEqual(data['timeline'], [])
            self.assertIsNone(data['resume'])
            self.assertIsNone(data['periods']['7']['accuracy'])
            self.assertEqual(data['today_questions'], 0)
            self.assertEqual(self.client.get(f'/api/{lang}/decks/').json()['decks'], [])

    def test_bootstrap_publish_register_copy_and_resume_without_seed_data(self):
        self.assertEqual(self.client.get(self.setup_url).status_code, 200)
        admin = self.register('initial-admin', admin=True)
        self.assertTrue(admin['superuser'])
        document = self.document()
        preview = self.post(self.import_url, {'text': json.dumps(document), 'preview': True})
        self.assertEqual(preview.status_code, 200, preview.content)
        self.assertFalse(Deck.objects.exists())
        self.assertFalse(Card.objects.exists())
        self.assertFalse(SystemContentPackage.objects.exists())
        published = self.post(self.import_url, {
            'text': json.dumps(document), 'confirm': 'IMPORT',
            'preview_token': preview.json()['preview_token'],
        })
        self.assertEqual(published.status_code, 201, published.content)
        source = Deck.objects.get()
        self.assertEqual(source.visibility, 'public')
        self.assertNotEqual(source.owner_id, admin['id'])
        self.assertFalse(source.owner.has_usable_password())
        # Retrying the same upload cannot create a second library entry.
        retry = self.post(self.import_url, {'text': json.dumps(document), 'confirm': 'IMPORT'})
        self.assertEqual(retry.status_code, 200, retry.content)
        self.assertTrue(retry.json()['already_imported'])
        self.assertEqual(Deck.objects.count(), 1)
        # Disable the temporary setup entry point after first deployment.
        with override_settings(SUPERUSER_SETUP_KEY=''):
            self.assertEqual(self.client.get(self.setup_url).status_code, 404)
        self.client.logout()
        self.client.get('/api/session/')
        catalog = self.client.get('/api/en/flashcard/discover/').json()
        self.assertEqual([row['id'] for row in catalog['results']], [source.pk])
        self.assertEqual(self.client.get('/api/de/flashcard/discover/').json()['total'], 0)
        learner = self.register('first-learner')
        copied = self.post(f'/api/en/flashcard/discover/{source.pk}/copy/', {})
        self.assertEqual(copied.status_code, 201, copied.content)
        deck_id = copied.json()['id']
        self.assertNotEqual(deck_id, source.pk)
        self.assertEqual(Deck.objects.get(pk=deck_id).owner_id, learner['id'])
        card = Card.objects.filter(deck_id=deck_id).first()
        event = {'token': str(uuid.uuid4()), 'kind': 'review', 'at': timezone.now().isoformat(),
                 'payload': {'deck': deck_id, 'card': card.pk, 'correct': True, 'type': 'written'}}
        for _ in range(2):
            synced = self.post('/api/en/learning/sync/', {'account_id': learner['id'], 'events': [event]})
            self.assertEqual(synced.status_code, 200, synced.content)
            self.assertEqual(synced.json()['errors'], [])
            self.assertEqual(len(synced.json()['accepted']), 1)
        self.assertEqual(LearningEvent.objects.filter(user_id=learner['id']).count(), 1)
        self.assertEqual(StudyProgress.objects.filter(user_id=learner['id']).count(), 1)
        self.client.logout()
        self.client.get('/api/session/')
        logged_in = self.post('/api/session/', {'username': 'first-learner', 'password': self.password})
        self.assertEqual(logged_in.status_code, 200, logged_in.content)
        detail = self.client.get(f'/api/en/decks/{deck_id}/')
        self.assertEqual(detail.status_code, 200, detail.content)
        self.assertEqual(detail.json()['learning']['progress'][str(card.pk)]['hits'], 1)
        self.assertEqual(self.client.get('/api/en/profile/').json()['today_questions'], 1)
        self.assertEqual(self.client.get('/api/de/profile/').json()['today_questions'], 0)
        self.register('second-learner')
        self.assertEqual(self.client.get(f'/api/en/decks/{deck_id}/').status_code, 404)
        self.assertEqual(self.client.get('/api/en/profile/').json()['today_questions'], 0)

    def test_invalid_first_import_leaves_empty_library_usable(self):
        self.register('initial-admin', admin=True)
        document = self.document()
        document['flashcards'].append({'kind': 'deck', 'title': 'Invalid last item', 'cards': []})
        response = self.post(self.import_url, {'text': json.dumps(document), 'preview': True})
        self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(Deck.objects.exists())
        self.assertFalse(Card.objects.exists())
        self.assertFalse(SystemContentPackage.objects.exists())
        self.assertEqual(self.client.get('/api/en/flashcard/discover/').json()['total'], 0)
        valid = self.post(self.import_url, {'text': json.dumps(self.document()), 'preview': True})
        self.assertEqual(valid.status_code, 200, valid.content)
