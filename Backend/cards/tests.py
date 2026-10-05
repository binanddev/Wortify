import io
import json
import tempfile
import wave
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, SimpleTestCase, override_settings, Client
from django.utils import timezone
from .models import Deck, Card, StudyAttempt, StudyProgress, StudySettings
from .services.comparison import compare, normalize
from .services.study import choices, finish, queue
from .services.speech import SpeechError, SpeechToTextService, TextToSpeechService, OpenAISpeechProvider


def wav_file(seconds=1):
    output = io.BytesIO()
    with wave.open(output, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(8000)
        audio.writeframes(b'\x01\x00' * int(8000 * seconds))
    return SimpleUploadedFile('unsafe-name.wav', output.getvalue(), content_type='audio/wav')


class ComparisonTests(SimpleTestCase):
    def test_alignment_cases(self):
        for transcript, kind in [('Ich trinke Tee', 'correct'), ('Ich Tee', 'missing'), ('Ich trinke gerne Tee', 'extra'), ('Ich trinke Kaffee', 'replace')]:
            with self.subTest(transcript=transcript):
                result = compare('Ich trinke Tee', transcript)
                self.assertIn(kind, [w['kind'] for w in result['words']])
                self.assertEqual(result['is_correct'], kind == 'correct')

    def test_order_case_unicode_and_empty(self):
        self.assertFalse(compare('Ich trinke Tee', 'Tee trinke Ich')['is_correct'])
        self.assertTrue(compare('Guten Tag!', '  guten  tag ')['is_correct'])
        self.assertFalse(compare('Guten Tag', 'guten tag', ignore_case=False)['is_correct'])
        self.assertFalse(compare('Tag!', 'Tag', ignore_punctuation=False)['is_correct'])
        self.assertEqual(normalize('gru\u0308n'), 'grün')
        self.assertFalse(compare('Hallo', '')['is_correct'])
        self.assertEqual(compare('Hallo', '')['score'], 0)

    def test_umlaut_and_alternatives(self):
        self.assertFalse(compare('schön', 'schon')['is_correct'])
        self.assertFalse(compare('schön', 'schoen')['is_correct'])
        self.assertTrue(compare('schön Straße', 'schoen Strasse', transliteration=True)['is_correct'])
        self.assertTrue(compare('Guten Tag', 'Hallo', ['Hallo'])['is_correct'])
        self.assertFalse(compare('Haus', 'Maus')['is_correct'])

    def test_repeated_words(self):
        result = compare('Das ist das Haus', 'Das ist Haus')
        self.assertEqual(len([w for w in result['words'] if w['kind'] == 'missing']), 1)
        self.assertEqual(result['score'], 75)


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class AppTests(TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.temp.name)
        self.override.enable()
        self.addCleanup(self.temp.cleanup)
        self.addCleanup(self.override.disable)
        self.user = get_user_model().objects.create_user('learner', password='test-pass-123')
        self.other = get_user_model().objects.create_user('other', password='test-pass-123')
        self.deck = Deck.objects.create(owner=self.user, title='A2')
        self.cards = [Card.objects.create(deck=self.deck, german_text=w, vietnamese_meaning=m, position=i) for i, (w,m) in enumerate([('Haus','nhà'),('Baum','cây'),('Buch','sách'),('Tisch','bàn')])]
        self.client.force_login(self.user)

    def question(self, mode='flash', **extra):
        response = self.client.post('/api/de/next/', {'mode': mode, 'deck': self.deck.pk, **extra})
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()


    def test_quiz_unique_and_short_deck(self):
        for _ in range(10):
            options = choices(self.cards[0])
            self.assertEqual(len(set(options)), 4)
            self.assertEqual(options.count('nhà'), 1)
        self.cards[3].vietnamese_meaning = ' cây '
        self.cards[3].save()
        with self.assertRaises(ValueError):
            choices(self.cards[0])
        self.assertEqual(self.client.post('/api/de/next/', {'mode':'quiz','deck':self.deck.pk}).status_code, 400)

    def test_quiz_first_answer_only(self):
        question = self.question('quiz')
        url = f"/api/de/submit/{question['token']}/"
        wrong = next(v for v in question['options'] if v != 'nhà')
        self.client.post(url, {'answer': wrong})
        result = self.client.post(url, {'answer': 'nhà'}).json()
        self.assertFalse(result['is_correct'])
        self.assertEqual(StudyProgress.objects.get().incorrect_count, 1)
        self.assertEqual(StudyProgress.objects.get().correct_count, 0)

    def test_spelling_hidden_and_exact(self):
        question = self.question('spell')
        self.assertNotIn('card', question)
        self.assertNotIn('target', question)
        data = self.client.post(f"/api/de/submit/{question['token']}/", {'answer':'  haus! '}).json()
        self.assertTrue(data['is_correct'])
        self.assertEqual(data['target'], 'Haus')
        self.assertEqual(StudyProgress.objects.get().interval_days, 1)

    def test_srs_lapse_and_idempotency(self):
        attempt = StudyAttempt.objects.create(user=self.user, card=self.cards[0], mode='flash')
        finish(attempt, 'remember', {'is_correct':True})
        finish(attempt, 'again', {'is_correct':False})
        p = StudyProgress.objects.get()
        self.assertEqual(p.correct_count, 1)
        self.assertEqual(p.incorrect_count, 0)
        attempt = StudyAttempt.objects.create(user=self.user, card=self.cards[0], mode='flash')
        finish(attempt, 'again', {'is_correct':False})
        p.refresh_from_db()
        self.assertEqual(p.lapse_count, 1)
        self.assertLess(p.due_at, timezone.now()+timedelta(minutes=11))

    def test_new_limit_and_due_priority(self):
        prefs = StudySettings.objects.create(user=self.user, new_cards_per_day=1)
        self.assertEqual(len(queue(self.user, prefs, learn=True)), 1)
        attempt = StudyAttempt.objects.create(user=self.user, card=self.cards[0], mode='flash')
        finish(attempt, '', {'is_correct': True})
        self.assertEqual(queue(self.user, prefs, learn=True), [])
        StudyProgress.objects.filter(user=self.user).update(due_at=timezone.now()-timedelta(days=1))
        self.assertEqual(queue(self.user, prefs, learn=True), [self.cards[0]])

    def test_csrf_required(self):
        client = Client(enforce_csrf_checks=True)
        client.force_login(self.user)
        self.assertEqual(client.post('/api/de/next/').status_code, 403)

    def test_reload_reuses_pending(self):
        self.assertEqual(self.question('quiz')['token'], self.question('quiz')['token'])
        self.assertEqual(StudyProgress.objects.count(), 0)

    def test_resume_completed_without_new_progress(self):
        q = self.question('flash')
        self.client.post(f"/api/de/submit/{q['token']}/", {'answer':'remember'})
        response = self.client.get(f"/api/de/question/{q['token']}/").json()
        self.assertTrue(response['completed'])
        self.assertTrue(response['result']['is_correct'])
        self.assertEqual(StudyProgress.objects.get().correct_count, 1)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f"/api/de/question/{q['token']}/").status_code, 404)

    def test_term_and_example_attempts_are_distinct(self):
        self.cards[0].example_german = 'Das ist ein Haus.'
        self.cards[0].save()
        q1 = self.question('spell')
        q2 = self.question('spell', target='example')
        self.assertNotEqual(q1['token'], q2['token'])
        self.assertEqual(q2['target_type'], 'example')

    def test_question_and_audio_use_same_snapshot_after_edit(self):
        q = self.question('spell')
        self.cards[0].german_text = 'Auto'
        self.cards[0].save()
        self.assertEqual(self.client.post(q['audio_url']).json()['text'], 'Haus')
        self.assertTrue(self.client.post(f"/api/de/submit/{q['token']}/", {'answer':'Haus'}).json()['is_correct'])

    @override_settings(STT_PROVIDER='')
    def test_learn_does_not_require_stt_key(self):
        with patch('api.card_learning.random.choice', side_effect=lambda modes: modes[-1]):
            q = self.question('learn')
        self.assertNotEqual(q['mode'], 'speak')

    def test_shuffle_is_stable_within_session(self):
        ids = [self.question('flash', shuffle='1', seed='session', index=i)['card']['german_text'] for i in range(4)]
        self.assertEqual(len(set(ids)), 4)
        self.assertEqual(self.question('flash', shuffle='1', seed='session', index=0)['card']['german_text'], ids[0])

    def test_speaking_retry_and_abandoned_token(self):
        q = self.question('speak')
        self.client.post(f"/api/de/retry/{q['token']}/")
        self.assertNotEqual(self.question('speak')['token'], q['token'])
        self.assertEqual(self.client.post(f"/api/de/speaking/{q['token']}/", {'audio':wav_file(), 'consent':'yes'}).status_code, 409)
        a = StudyAttempt.objects.get(token=q['token'])
        finish(a, 'Haus', {'is_correct':True})
        self.assertFalse(StudyProgress.objects.exists())


    def speak(self):
        question = self.question('speak')
        return self.client.post(f"/api/de/speaking/{question['token']}/", {'audio': wav_file(), 'consent':'yes'})

    def test_invalid_upload(self):
        question = self.question('speak')
        for upload in [SimpleUploadedFile('a.wav', b'not audio', content_type='audio/wav'), SimpleUploadedFile('a.wav', b'x'*(10*1024*1024+1), content_type='audio/wav'), wav_file(.1), wav_file(61)]:
            response = self.client.post(f"/api/de/speaking/{question['token']}/", {'audio':upload,'consent':'yes'})
            self.assertEqual(response.status_code, 400)
        self.assertFalse(list(Path(self.temp.name).rglob("*.wav")))

    @override_settings(TTS_PROVIDER='openai', SPEECH_API_KEY='test')
    @patch.object(OpenAISpeechProvider, 'synthesize', side_effect=SpeechError('Không tạo được audio'))
    def test_tts_failure_does_not_cache_success(self, mocked):
        from .models import CardAudio
        q = self.question('flash')
        self.assertTrue(self.client.post(q['audio_url']).json()['fallback'])
        self.assertFalse(CardAudio.objects.exists())

    def test_audio_formats_decoded_and_checked(self):
        import av
        from .services.audio_validation import validate_audio
        for fmt, codec, mime in [('webm', 'libopus', 'audio/webm'), ('mp4', 'aac', 'audio/mp4'), ('ogg', 'libopus', 'audio/ogg')]:
            with self.subTest(fmt=fmt):
                output = io.BytesIO()
                with av.open(output, mode='w', format=fmt) as container:
                    stream = container.add_stream(codec, rate=48000)
                    frame = av.AudioFrame(format='fltp', layout='mono', samples=48000)
                    frame.sample_rate = 48000
                    for plane in frame.planes:
                        plane.update(bytes(plane.buffer_size))
                    for packet in stream.encode(frame):
                        container.mux(packet)
                    for packet in stream.encode(None):
                        container.mux(packet)
                data, ext, detected, duration = validate_audio(SimpleUploadedFile('a', output.getvalue(), content_type=mime))
                self.assertGreater(duration, 900)
                self.assertLess(duration, 1200)
                self.assertEqual(detected, mime)

    @patch.object(SpeechToTextService, 'transcribe', return_value={'transcript':'Haus','confidence':.2})
    def test_low_confidence_does_not_grade(self, mocked):
        self.assertEqual(self.speak().json()['status'], 'uncertain')
        self.assertFalse(StudyProgress.objects.exists())

    @override_settings(STT_PROVIDER='')
    def test_missing_key(self):
        self.assertEqual(self.speak().json()['status'], 'error')

    @override_settings(TTS_PROVIDER='')
    def test_browser_fallback(self):
        question = self.question('spell')
        self.assertTrue(self.client.post(question['audio_url']).json()['fallback'])

    @override_settings(TTS_PROVIDER='openai', SPEECH_API_KEY='test')
    @patch.object(OpenAISpeechProvider, 'synthesize', return_value=b'ID3audio')
    def test_tts_cache(self, mocked):
        service = TextToSpeechService()
        first = service.audio(self.cards[0], 'term', 'Haus', 1)
        self.assertEqual(first.pk, service.audio(self.cards[0], 'term', 'Haus', 1).pk)
        self.assertEqual(mocked.call_count, 1)
        service.audio(self.cards[0], 'term', 'Haus', .7)
        self.assertEqual(mocked.call_count, 2)


class ProviderTests(SimpleTestCase):
    @patch('cards.services.speech.request.urlopen')
    def test_http_timeout_and_errors_are_safe(self, mocked):
        from urllib.error import URLError
        from .services.speech import call_api
        for error in (TimeoutError('private network detail'), URLError('secret upstream detail')):
            mocked.side_effect = error
            with self.assertRaises(SpeechError) as captured:
                call_api('transcriptions', b'audio', 'audio/wav')
            self.assertNotIn('private', str(captured.exception))
            self.assertNotIn('secret', str(captured.exception))

    @patch('cards.services.speech.call_api')
    def test_provider_language_empty_and_low_confidence(self, mocked):
        provider = OpenAISpeechProvider()
        for payload in [{'text':'', 'language':'german'}, {'text':'Hello','language':'english'}]:
            mocked.return_value = json.dumps(payload).encode()
            with self.assertRaises(SpeechError):
                provider.transcribe(b'a', 'a.wav', 'audio/wav')
        mocked.return_value = json.dumps({'text':'Hallo','language':'german','segments':[{'avg_logprob':-2}]}).encode()
        self.assertTrue(provider.transcribe(b'a', 'a.wav', 'audio/wav')['uncertain'])

