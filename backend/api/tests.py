import io
import json
import uuid
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, Client, SimpleTestCase
from cards.models import Deck, Card, StudyProgress, StudyAttempt, Folder
from cards.services.speech import OpenAISpeechProvider, SpeechError
from practice.models import Exercise, Attempt, Question, Chapter
from content.models import Book
from learning.grading import grade

class PlatformTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user('learner', password='Testing-7391-secure')
        cls.other = get_user_model().objects.create_user('other', password='Testing-7391-secure')
        cls.deck = Deck.objects.create(owner=cls.user, title='English', language='en', level='A1')
        cls.card = Card.objects.create(deck=cls.deck, german_text='a house', vietnamese_meaning='một ngôi nhà', example_german='This is a house.')
        chapter = Chapter.objects.create(number=1, book=Book.objects.get(slug='english-a1'), title='Everyday English', page_start=1)
        cls.exercise = Exercise.objects.create(chapter=chapter, number='1', title='Greetings', instruction='Complete.', source_page=1, decision='DIGITIZE', reviewed=True, kind='text', check_mode='auto_check')
        cls.question = Question.objects.create(exercise=cls.exercise, position=1, prompt='Hello', accepted_answers=['Hello'])

    def setUp(self):
        self.client.force_login(self.user)

    def post(self, path, data):
        return self.client.post(path, data=json.dumps(data), content_type='application/json')

    def test_authentication_and_ownership(self):
        anonymous = Client()
        self.assertEqual(anonymous.get('/api/en/decks/').status_code, 401)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/en/decks/{self.deck.pk}/').status_code, 404)
        self.assertEqual(self.post('/api/en/next/', {'deck': self.deck.pk}).status_code, 404)
        self.assertEqual(self.post(f'/api/en/decks/{self.deck.pk}/cards/', {'german_text': 'bad'}).status_code, 404)

    def test_csrf_required_and_session_login(self):
        client = Client(enforce_csrf_checks=True)
        client.get('/api/session/')
        self.assertEqual(client.post('/api/session/', data='{}', content_type='application/json').status_code, 403)
        csrf = client.cookies['csrftoken'].value
        result = client.post('/api/session/', data=json.dumps({'username': 'learner', 'password': 'Testing-7391-secure'}), content_type='application/json', HTTP_X_CSRFTOKEN=csrf)
        self.assertEqual(result.json()['user']['username'], 'learner')

    def test_shell_deep_links_and_unknown_api(self):
        for path in ['/en/flashcard', '/de/flashcard/deck/1', '/de/books/german-a2/lesson/1', '/en/books/english-a1/exercise/1']:
            response = self.client.get(path)
            self.assertContains(response, 'type="module"')
            self.assertNotContains(response, 'htmx')
            self.assertNotContains(response, 'alpine')
        self.assertEqual(self.client.get('/api/en/missing/').status_code, 404)
        self.assertEqual(self.client.get('/unregistered').status_code, 404)

    def test_flashcard_language_and_idempotent_grading(self):
        response = self.post('/api/en/next/', {'deck': self.deck.pk, 'mode': 'write'}).json()
        self.assertEqual(response['language'], 'en')
        self.assertNotIn('target', response)
        token = response['token']
        first = self.post(f'/api/en/submit/{token}/', {'answer': 'a house'})
        self.assertTrue(first.json()['is_correct'])
        self.post(f'/api/en/submit/{token}/', {'answer': 'wrong'})
        self.assertEqual(StudyProgress.objects.get(card=self.card).correct_count, 1)

    def test_deck_validation_private_folder_and_card_crud(self):
        foreign = Folder.objects.create(owner=self.other, name='Other folder')
        data = {'title': 'Test', 'language': 'en', 'level': 'A1', 'folder': foreign.pk}
        self.assertEqual(self.post('/api/en/decks/', data).status_code, 400)
        data['folder'] = ''
        deck_id = self.post('/api/en/decks/', data).json()['id']
        response = self.post(f'/api/en/decks/{deck_id}/cards/', {'german_text': 'hello', 'vietnamese_meaning': 'xin chào'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.delete(f'/api/en/decks/{deck_id}/cards/{response.json()["id"]}/').status_code, 200)
        data['language'] = 'xx'
        self.assertEqual(self.post('/api/en/decks/', data).status_code, 400)

    def test_import_preview_atomic_and_idempotent(self):
        path = f'/api/en/decks/{self.deck.pk}/import/'
        before = self.deck.cards.count()
        self.assertEqual(self.post(path, {'text': 'house,nhà\nbroken'}).status_code, 400)
        self.assertEqual(self.deck.cards.count(), before)
        data = self.post(path, {'text': 'house,nhà\nbook,sách'}).json()
        self.assertEqual(self.deck.cards.count(), before)
        for _ in range(2):
            self.assertEqual(self.post(path, {'token': data['token']}).status_code, 200)
        self.assertEqual(self.deck.cards.count(), before+2)

    def test_exercise_no_answers_before_submission_idempotency_and_privacy(self):
        path = f'/api/en/books/english-a1/exercises/{self.exercise.pk}/'
        data = self.client.get(path).json()
        self.assertNotIn('accepted_answers', data['questions'][0])
        self.assertEqual(data['questions'][0]['sample'], [])
        payload = {'token': data['token'], 'answers': {str(self.question.pk): 'Hello'}}
        result = self.post(path, payload)
        self.assertEqual(result.status_code, 201)
        self.assertEqual(self.post(path, payload).json()['id'], result.json()['id'])
        self.assertEqual(Attempt.objects.count(), 1)
        self.assertEqual(Attempt.objects.get().score, 1)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/en/results/{result.json()["id"]}/').status_code, 404)
        self.assertEqual(self.post(path, payload).status_code, 400)
        self.assertEqual(self.client.get(f'/api/en/books/german-a2/exercises/{self.exercise.pk}/').status_code, 404)

    def test_bad_json_and_unpublished_exercises(self):
        self.assertEqual(self.client.post('/api/en/decks/', data='[]', content_type='application/json').status_code, 400)
        self.exercise.reviewed = False
        self.exercise.save()
        self.assertEqual(self.client.get(f'/api/en/books/english-a1/exercises/{self.exercise.pk}/').status_code, 404)

    def test_manual_grading_and_notification(self):
        self.exercise.check_mode = 'manual_check'; self.exercise.save()
        response = self.post(f'/api/en/books/english-a1/exercises/{self.exercise.pk}/', {'token': str(uuid.uuid4()), 'answers': {str(self.question.pk): 'My own answer'}})
        self.assertEqual(response.status_code, 201)
        attempt = Attempt.objects.get(pk=response.json()['id'])
        self.assertIsNone(attempt.score)
        self.assertEqual(attempt.status, 'pending_manual')
        attempt.status = 'graded'; attempt.score = 1; attempt.teacher_feedback = 'Well done.'; attempt.save()
        self.assertEqual(len(self.client.get('/api/en/dashboard/').json()['notifications']), 1)

class BookContentTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command('load_book', stdout=io.StringIO())

    def test_all_217_exercises_against_reference_answers(self):
        self.assertEqual(Exercise.objects.count(), 217)
        for exercise in Exercise.objects.select_related('chapter').prefetch_related('questions'):
            with self.subTest(exercise=str(exercise)):
                data = {}
                for q in exercise.questions.all():
                    if q.example: continue
                    if q.blanks:
                        for i, blank in enumerate(q.blanks): data[f'{q.pk}_{i}'] = blank['answers'][0]
                    elif exercise.kind == 'multi': data[str(q.pk)] = q.accepted_answers
                    elif exercise.kind == 'wordset': data[str(q.pk)] = '; '.join(q.accepted_answers)
                    else: data[str(q.pk)] = q.accepted_answers[0] if q.accepted_answers else 'Meine Antwort.'
                results = grade(exercise, data)
                self.assertTrue(results)
                if exercise.check_mode == 'auto_check': self.assertTrue(all(r['correct'] for r in results))
                else: self.assertTrue(all(r['correct'] is None for r in results))

class LanguageTests(SimpleTestCase):
    @patch('cards.services.speech.call_api')
    def test_english_and_german_speech_language(self, mocked):
        for language, reported in [('en', 'english'), ('de', 'german')]:
            mocked.return_value = json.dumps({'text': 'Hello' if language == 'en' else 'Hallo', 'language': reported}).encode()
            self.assertIn('transcript', OpenAISpeechProvider().transcribe(b'audio', 'test.wav', 'audio/wav', language=language))
        mocked.return_value = b'{"text":"bonjour","language":"french"}'
        with self.assertRaises(SpeechError):
            OpenAISpeechProvider().transcribe(b'audio', 'test.wav', 'audio/wav', language='en')
