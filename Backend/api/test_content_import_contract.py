"""Import contracts work without a seed library or any pre-existing content IDs."""
import json
import uuid
from copy import deepcopy

from django.contrib.auth import get_user_model
from django.test import TestCase

from cards.models import Card, Deck, Folder
from practice.models import PackageReceipt, SystemContentPackage
from .content_packages import validate_document


class ContentImportContractTests(TestCase):
    def setUp(self):
        self.editor = get_user_model().objects.create_user('contract-editor', is_staff=True)
        self.client.force_login(self.editor)
        self.url = '/api/manage/content-packages/'

    def document(self, language='en'):
        return {
            'format': 'wortify-content', 'version': 1, 'id': str(uuid.uuid4()),
            'title': 'New library', 'language': language, 'mode': 'upsert',
            'flashcards': [{'kind': 'folder', 'title': 'Everyday life', 'children': [
                {'kind': 'deck', 'title': 'Transport', 'level': 'B1', 'topic': 'Travel',
                 'description': 'Ask for directions.',
                 'cards': [{'german_text': 'station', 'vietnamese_meaning': 'nhà ga'}]},
            ]}],
        }

    def send(self, document, **options):
        return self.client.post(self.url, {'text': json.dumps(document), **options}, content_type='application/json')

    def publish(self, document):
        preview = self.send(document, preview=True)
        self.assertEqual(preview.status_code, 200, preview.content)
        result = self.send(document, confirm='IMPORT', preview_token=preview.json()['preview_token'])
        self.assertEqual(result.status_code, 201, result.content)
        return result

    def test_partial_language_and_section_imports_start_without_seed_and_retry_safely(self):
        for language in ('en', 'de'):
            with self.subTest(language=language):
                document = self.document(language)
                self.publish(document)
                before = (Deck.objects.count(), Card.objects.count(), Folder.objects.count(), PackageReceipt.objects.count())
                retry = self.send(document, confirm='IMPORT')
                self.assertEqual(retry.status_code, 200, retry.content)
                self.assertTrue(retry.json()['already_imported'])
                self.assertEqual(before, (Deck.objects.count(), Card.objects.count(), Folder.objects.count(), PackageReceipt.objects.count()))
        self.assertEqual(set(Deck.objects.values_list('language', flat=True)), {'en', 'de'})
        self.assertEqual(set(Deck.objects.values_list('visibility', flat=True)), {'public'})
        self.assertEqual(Deck.objects.filter(owner=self.editor).count(), 0)

    def test_empty_package_and_invalid_final_node_do_not_create_publisher_or_content(self):
        document = self.document()
        document['flashcards'] = []
        empty = self.send(document, preview=True)
        self.assertEqual(empty.status_code, 400)
        self.assertIn('empty', empty.json()['error'])
        document = self.document()
        document['flashcards'][0]['children'].append({'kind': 'deck', 'title': 'Broken', 'cards': []})
        response = self.send(document, confirm='IMPORT')
        self.assertEqual(response.status_code, 400)
        self.assertIn('flashcards[0].children[1]', response.json()['error'])
        self.assertIn('Broken', response.json()['error'])
        self.assertFalse(SystemContentPackage.objects.exists())
        self.assertFalse(Deck.objects.exists())
        self.assertFalse(get_user_model().objects.filter(username='wortify-publisher').exists())

    def test_invalid_metadata_and_card_errors_identify_the_item(self):
        for field, value in [('level', 'beginner'), ('topic', None), ('description', [])]:
            with self.subTest(field=field):
                document = self.document()
                document['flashcards'][0]['children'][0][field] = value
                response = self.send(document, preview=True)
                self.assertEqual(response.status_code, 400, response.content)
                self.assertIn('flashcards[0].children[0]', response.json()['error'])
        document = self.document()
        document['flashcards'][0]['children'][0]['cards'].append({'german_text': 'bus', 'vietnamese_meaning': ''})
        response = self.send(document, preview=True)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Card 2', response.json()['error'])

    def test_malformed_lesson_payload_has_actionable_path(self):
        for payload in (None, [], 'text'):
            document = self.document()
            document.pop('flashcards')
            document['practice'] = [{'kind': 'folder', 'title': 'Grammar', 'children': [
                {'kind': 'exercise', 'title': 'Lesson', 'payload': payload},
            ]}]
            response = self.send(document, preview=True)
            self.assertEqual(response.status_code, 400, response.content)
            self.assertIn('practice[0].children[0]', response.json()['error'])
            self.assertIn('payload must be a JSON object', response.json()['error'])

    def test_incremental_card_update_preserves_omitted_deck_metadata(self):
        document = self.document()
        self.publish(document)
        deck = Deck.objects.get()
        card = Card.objects.get()
        update = deepcopy(document)
        update['id'] = str(uuid.uuid4())
        node = update['flashcards'][0]['children'][0]
        for field in ('level', 'topic', 'description'):
            node.pop(field)
        node['cards'][0]['vietnamese_meaning'] = 'ga tàu'
        self.publish(update)
        deck.refresh_from_db()
        card.refresh_from_db()
        self.assertEqual((deck.level, deck.topic, deck.description), ('B1', 'Travel', 'Ask for directions.'))
        self.assertEqual(card.vietnamese_meaning, 'ga tàu')
        update['id'] = str(uuid.uuid4())
        node.update(level='A1', topic='', description='')
        self.publish(update)
        deck.refresh_from_db()
        self.assertEqual((deck.level, deck.topic, deck.description), ('A1', '', ''))

    def test_validation_never_mutates_author_input(self):
        document = self.document()
        document['id'] = document['id'].upper()
        original = deepcopy(document)
        normalized, counts = validate_document(document)
        self.assertEqual(document, original)
        self.assertEqual(normalized['id'], original['id'].lower())
        self.assertEqual(counts['cards'], 1)
