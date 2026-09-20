import json
from pathlib import Path
from unittest.mock import patch
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from . import tests as legacy
from .tests import wav_file
from django.test import TestCase, override_settings
from .models import Folder, Deck, Card, StudyAttempt, StudyProgress, ImportBatch, MatchRound
from .forms import DeckForm
from .services.importing import parse_cards
from .services.exercises import create_match, submit_match
from .services.speech import SpeechToTextService, SpeechError


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class FeatureTests(TestCase):
    setUp = legacy.AppTests.setUp
    question = legacy.AppTests.question









    def test_write_hides_target_until_submission(self):
        q=self.question('write')
        self.assertEqual(q['prompt'],'nhà')
        self.assertNotIn('target',q)
        self.assertNotIn('card',q)
        result=self.client.post(f"/api/de/submit/{q['token']}/",{'answer':'Haus'}).json()
        self.assertTrue(result['is_correct'])

    def test_order_grades_ids_and_repeated_words(self):
        card=self.cards[0]
        card.example_german='Das ist das Haus.'
        card.example_vietnamese='Đây là ngôi nhà.'
        card.save()
        q=self.question('order')
        self.assertEqual(q['prompt'],'Đây là ngôi nhà.')
        self.assertNotIn('target',q)
        url=f"/api/de/submit/{q['token']}/"
        self.assertEqual(self.client.post(url,{'answer':'["0", "0"]'}).status_code,400)
        self.assertFalse(StudyProgress.objects.exists())
        correct=self.client.post(url,{'answer':json.dumps(['0','1','2','3'])}).json()
        self.assertTrue(correct['is_correct'])
        self.assertTrue(self.client.post(url,{'answer':json.dumps(['3','2','1','0'])}).json()['is_correct'])
        self.assertEqual(StudyProgress.objects.get().correct_count,1)

    def test_match_individual_progress_and_replay(self):
        round=create_match(self.deck)
        mapping={pair['id']:str(i) for i,pair in enumerate(round.pairs)}
        mapping[round.pairs[0]['id']],mapping[round.pairs[1]['id']]=mapping[round.pairs[1]['id']],mapping[round.pairs[0]['id']]
        result=submit_match(round,mapping)
        self.assertEqual(result['correct'],2)
        self.assertEqual(StudyProgress.objects.filter(state='weak').count(),2)
        self.assertEqual(StudyProgress.objects.count(),4)
        submit_match(round,mapping)
        self.assertEqual(sum(p.correct_count+p.incorrect_count for p in StudyProgress.objects.all()),4)

    def test_match_incomplete_duplicate_and_owner(self):
        round=create_match(self.deck)
        with self.assertRaises(ValueError):
            submit_match(round,{})
        self.assertFalse(StudyProgress.objects.exists())
        self.client.force_login(self.other)
        self.assertEqual(self.client.post(f'/api/de/match/{round.token}/submit/',{'pairs':'{}'}).status_code,404)
        self.assertEqual(self.client.get(f'/decks/{self.deck.pk}/match/').status_code,404)

    @patch.object(SpeechToTextService,'transcribe',return_value={'transcript':'Haus','confidence':.9})
    def test_speech_never_persists_audio_or_transcript(self, mock):
        q=self.question('speak')
        url=f"/api/de/speaking/{q['token']}/"
        result=self.client.post(url,{'audio':wav_file(),'consent':'yes'}).json()
        self.assertEqual(result['status'],'done')
        self.assertEqual(result['result']['transcript'],'Haus')
        attempt=StudyAttempt.objects.get(token=q['token'])
        self.assertEqual(attempt.submitted_answer,'')
        self.assertEqual(attempt.normalized_answer,'')
        self.assertEqual(attempt.result,{'is_correct':True,'ephemeral':True})
        self.assertFalse(list(Path(self.temp.name).rglob('*')))
        self.client.post(url,{'audio':wav_file(),'consent':'yes'})
        self.assertEqual(mock.call_count,1)
        self.assertEqual(StudyProgress.objects.get().correct_count,1)
        self.assertEqual(self.client.get('/recordings/').status_code,404)

    @patch.object(SpeechToTextService,'transcribe')
    def test_speech_errors_and_uncertainty_release_claim(self,mock):
        q=self.question('speak')
        url=f"/api/de/speaking/{q['token']}/"
        for failure in [TimeoutError(),SpeechError('Dịch vụ lỗi'),RuntimeError('secret')]:
            mock.side_effect=failure
            response=self.client.post(url,{'audio':wav_file(),'consent':'yes'}).json()
            self.assertEqual(response['status'],'error')
            self.assertNotIn('secret',response['error'])
            self.assertIsNone(StudyAttempt.objects.get(token=q['token']).processing_started_at)
        mock.side_effect=None
        mock.return_value={'transcript':'Haus','confidence':.1}
        self.assertEqual(self.client.post(url,{'audio':wav_file(),'consent':'yes'}).json()['status'],'uncertain')
        self.assertFalse(StudyProgress.objects.exists())
        self.assertFalse(list(Path(self.temp.name).rglob('*')))

    def test_card_example_audio_ownership_and_usage(self):
        card=self.cards[0]
        card.example_german='Das ist ein Haus.'
        card.usage='Dùng với mạo từ das.'
        card.save()
        self.assertEqual(self.client.post(f'/api/de/cards/{card.pk}/audio/',{'type':'example'}).json()['text'],card.example_german)
        self.assertEqual(self.client.get(f'/api/de/decks/{self.deck.pk}/').json()['cards'][0]['usage'], card.usage)
        self.client.force_login(self.other)
        self.assertEqual(self.client.post(f'/api/de/cards/{card.pk}/audio/',{'type':'example'}).status_code,404)
