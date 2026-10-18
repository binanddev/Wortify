from django.test import TestCase
from django.contrib.auth import get_user_model
from cards.models import Deck, Card, StudyAttempt, StudySession

class SessionRecoveryTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('resume-owner')
        self.client.force_login(self.user)
        self.deck=Deck.objects.create(owner=self.user,language='en',title='Travel')
        for term in ['bus','train']:
            Card.objects.create(deck=self.deck,german_text=term,vietnamese_meaning=term)
        response=self.client.post('/api/en/sessions/',{'deck':self.deck.pk,'kind':'flash','count':2},content_type='application/json')
        self.assertEqual(response.status_code,201,response.content)
        self.session=StudySession.objects.get(token=response.json()['token'])
        self.url=f'/api/en/sessions/{self.session.token}/'

    def test_deleted_card_is_skipped_and_remaining_question_can_be_answered(self):
        first=StudyAttempt.objects.get(token=self.session.tokens[0])
        first.card.delete()
        response=self.client.get(self.url)
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['total'],1)
        token=response.json()['question']['token']
        response=self.client.post(self.url+'answer/',{'question':token,'answer':'remember'},content_type='application/json')
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['session']['result']['correct'],1)

    def test_empty_session_does_not_break_or_show_resume(self):
        self.deck.cards.all().delete()
        self.assertIsNone(self.client.get('/api/en/decks/').json()['resume'])
        response=self.client.get(self.url)
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['result']['total'],0)
        self.session.refresh_from_db()
        self.assertIsNotNone(self.session.completed_at)

    def test_saved_answers_survive_recovery(self):
        token=self.session.tokens[0]
        self.client.post(self.url+'answer/',{'question':token,'answer':'remember'},content_type='application/json')
        StudyAttempt.objects.get(token=self.session.tokens[1]).card.delete()
        response=self.client.get(self.url)
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['result']['correct'],1)
        self.assertEqual(response.json()['result']['total'],1)

    def test_resume_skips_broken_newer_session(self):
        StudySession.objects.create(user=self.user,language='en',deck=self.deck,kind='flash',tokens=[])
        self.assertEqual(self.client.get('/api/en/decks/').json()['resume'],str(self.session.token))

    def test_other_owner_cannot_resume(self):
        other=get_user_model().objects.create_user('resume-other')
        self.client.force_login(other)
        self.assertEqual(self.client.get(self.url).status_code,404)
