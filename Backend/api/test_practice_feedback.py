import json
import uuid
from copy import deepcopy
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.exceptions import ValidationError
from practice.models import PracticeNode, PracticeAttempt, AnswerProposal
from cards.models import LearningEvent
from .practice_hub import validate_payload
from .content_text import parse_lesson


class PracticeFeedbackTests(TestCase):
    def setUp(self):
        users = get_user_model().objects
        self.owner = users.create_user('owner')
        self.learner = users.create_user('learner')
        self.other = users.create_user('other')
        self.folder = PracticeNode.objects.create(owner=self.owner, language='en', kind='folder', title='Grammar')
        self.payload = validate_payload('exercise', {'presentation': {'interaction': 'short_answer', 'style': 'sentence_rewrite'},
            'questions': [{'prompt': 'Say hello', 'accepted_answers': ['hello']}, {'prompt': 'Say goodbye', 'accepted_answers': ['bye']}]})
        self.node = PracticeNode.objects.create(owner=self.owner, language='en', kind='exercise', parent=self.folder,
            title='Greetings', payload=self.payload, visibility='public')
        self.url = f'/api/en/practice-hub/feedback/{self.node.pk}/'
        self.client.force_login(self.learner)

    def post(self, url, data):
        return self.client.post(url, json.dumps(data), content_type='application/json')

    def propose(self, **overrides):
        return self.post(self.url, {'revision': self.node.updated_at.isoformat(), 'question_id': '1', 'answer': 'hi', **overrides})

    def result(self, **overrides):
        payload = {'node': self.node.pk, 'revision': self.node.updated_at.isoformat(), 'mode': 'self_check',
            'answers': {'1': 'hello', '2': 'wrong'}, 'records': {'1': {'attempts': 1, 'firstCorrect': True}}}
        payload.update(overrides)
        event = {'token': str(uuid.uuid4()), 'kind': 'practice_result', 'payload': payload}
        return event, self.post('/api/en/learning/sync/', {'events': [event]})

    def test_proposal_requires_review_and_retry_does_not_duplicate(self):
        response = self.propose()
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(self.propose().status_code, 200)
        self.assertEqual(AnswerProposal.objects.count(), 1)
        self.node.refresh_from_db()
        self.assertEqual(self.node.payload['questions'][0]['accepted_answers'], ['hello'])
        proposal_id = response.json()['proposal']['id']
        self.assertEqual(self.post(self.url+proposal_id+'/', {'decision': 'approve', 'revision': self.node.updated_at.isoformat()}).status_code, 403)
        self.client.force_login(self.owner)
        response = self.post(self.url+proposal_id+'/', {'decision': 'approve', 'revision': self.node.updated_at.isoformat()})
        self.assertEqual(response.status_code, 200, response.content)
        self.node.refresh_from_db()
        self.assertEqual(self.node.payload['questions'][0]['accepted_answers'], ['hello', 'hi'])
        self.assertEqual(AnswerProposal.objects.get().reviewed_by_id, self.owner.pk)
        self.assertEqual(self.post(self.url+proposal_id+'/', {'decision': 'approve'}).status_code, 200)

    def test_proposals_are_private_to_author_and_content_owner(self):
        self.propose()
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(self.url).json()['proposals'], [])
        self.client.force_login(self.owner)
        self.assertEqual(len(self.client.get(self.url).json()['proposals']), 1)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code, 401)

    def test_private_content_other_language_and_reading_cannot_be_proposed(self):
        self.assertEqual(self.client.get(self.url.replace('/en/', '/de/')).status_code, 404)
        self.node.visibility = 'private'; self.node.save()
        self.assertEqual(self.propose().status_code, 404)
        self.node.visibility = 'public'
        self.node.payload['presentation']['interaction'] = 'reading'; self.node.save()
        self.assertEqual(self.propose().status_code, 400)

    def test_stale_proposal_cannot_change_modified_question_but_can_be_rejected(self):
        proposal_id = self.propose().json()['proposal']['id']
        self.node.payload['questions'][0]['prompt'] = 'Changed question'; self.node.save()
        self.client.force_login(self.owner)
        response = self.post(self.url+proposal_id+'/', {'decision': 'approve', 'revision': self.node.updated_at.isoformat()})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.post(self.url+proposal_id+'/', {'decision': 'reject'}).status_code, 200)
        self.assertEqual(AnswerProposal.objects.get().status, 'rejected')

    def test_unrelated_staff_cannot_review_personal_content(self):
        proposal_id = self.propose().json()['proposal']['id']
        staff = get_user_model().objects.create_user('editor', is_staff=True)
        self.client.force_login(staff)
        self.assertFalse(self.client.get(self.url).json()['can_review'])
        self.assertEqual(self.post(self.url+proposal_id+'/', {'decision': 'approve'}).status_code, 403)

    def test_shared_editors_can_review_shared_content(self):
        from .content_merge import publisher
        shared = publisher(create=True)
        self.folder.owner = shared; self.folder.save()
        self.node.owner = shared; self.node.save()
        proposal_id = self.propose().json()['proposal']['id']
        staff = get_user_model().objects.create_user('editor', is_staff=True)
        self.client.force_login(staff)
        self.assertTrue(self.client.get(self.url).json()['can_review'])
        self.assertEqual(self.post(self.url+proposal_id+'/', {'decision': 'approve', 'revision': self.node.updated_at.isoformat()}).status_code, 200)

    def test_invalid_proposal_and_already_accepted_answer_are_rejected(self):
        for values in ({'answer': ''}, {'answer': 'hello'}, {'question_id': '999'}, {'reason': 3}):
            self.assertEqual(self.propose(**values).status_code, 400)
        self.assertEqual(self.propose(revision='old').status_code, 409)
        self.assertFalse(AnswerProposal.objects.exists())

    def test_results_are_server_graded_and_idempotent(self):
        event, response = self.result(score=100, records={'1': {'attempts': 1, 'firstCorrect': True}, '2': {'attempts': 1, 'firstCorrect': True}})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(response.json()['errors'])
        result = response.json()['accepted'][0]['result']
        self.assertEqual((result['score'], result['total'], result['summary']['first_correct']), (1, 2, 1))
        self.assertEqual(self.post('/api/en/learning/sync/', {'events': [event]}).json()['accepted'][0]['result'], result)
        self.assertEqual(PracticeAttempt.objects.count(), 1)

    def test_revealed_answer_is_not_scored_and_hint_is_not_first_correct(self):
        _, response = self.result(answers={'1': 'hello', '2': 'bye'}, records={
            '1': {'attempts': 1, 'firstCorrect': True, 'hinted': True},
            '2': {'attempts': 2, 'firstCorrect': False, 'revealed': True}})
        result = response.json()['accepted'][0]['result']
        self.assertEqual((result['score'], result['summary']['first_correct'], result['summary']['hinted'], result['summary']['revealed']), (1, 0, 1, 1))

    def test_subset_and_unanswered_results(self):
        _, response = self.result(question_ids=['2'], answers={}, records={})
        result = response.json()['accepted'][0]['result']
        self.assertEqual((result['score'], result['total'], result['summary']['answered']), (0, 1, 0))
        _, response = self.result(question_ids=['2'])
        self.assertTrue(response.json()['errors'])
        self.assertEqual(PracticeAttempt.objects.count(), 1)

    def test_bad_result_records_roll_back_event_and_attempt(self):
        for record in ({'attempts': -1}, {'attempts': True}, {'hinted': 'yes'}, {'wrong': True}):
            _, response = self.result(records={'1': record})
            self.assertTrue(response.json()['errors'])
        self.assertFalse(PracticeAttempt.objects.exists())
        self.assertFalse(LearningEvent.objects.exists())

    def test_stale_result_does_not_save_attempt(self):
        _, response = self.result(revision='old')
        self.assertTrue(response.json()['accepted'][0]['result']['outdated'])
        self.assertFalse(PracticeAttempt.objects.exists())

    def test_hint_schema_and_text_import(self):
        lines = ['EXERCISE: Hint example', 'TYPE: short_answer', 'STYLE: sentence_rewrite',
            'QUESTION: Say hello', 'ANSWER: hello', 'HINT: Use a greeting.', '> Keep it short.',
            'DISTRACTOR_EXPLANATION: Goodbye ends a conversation.']
        parsed = parse_lesson(list(enumerate(lines, 1)))
        self.assertEqual(parsed['questions'][0]['presentation']['hint'], 'Use a greeting.\nKeep it short.')
        self.assertIn('Goodbye', parsed['questions'][0]['presentation']['distractor_explanation'])
        for field, value in [('hint', []), ('hint', 'a' * 4001), ('distractor_explanation', 'a' * 12001)]:
            payload = deepcopy(self.payload)
            payload['questions'][0]['presentation'][field] = value
            with self.assertRaises(ValidationError):
                validate_payload('exercise', payload)


    def test_revealed_whitespace_or_invalid_partial_answer_does_not_block_session(self):
        for value in ('   ', '', None):
            _, response = self.result(answers={'1': value, '2': 'bye'}, records={'1': {'revealed': True}})
            self.assertFalse(response.json()['errors'], response.content)
            result = response.json()['accepted'][0]['result']
            self.assertEqual((result['score'], result['total'], result['summary']['revealed']), (1, 2, 1))
            self.assertTrue(result['answers'][0]['revealed'])
        self.assertEqual(PracticeAttempt.objects.count(), 3)

    def test_partial_input_requires_prefix_and_reachable_answers_in_json(self):
        for prefix, accepted in [('', ['hello']), (None, ['hello']), ('He has', ['hello'])]:
            payload = deepcopy(self.payload)
            payload['presentation']['style'] = 'partial_input'
            payload['questions'] = [dict(payload['questions'][0], accepted_answers=accepted,
                                         presentation={'prefix': prefix})]
            with self.assertRaises(ValidationError):
                validate_payload('exercise', payload)
        payload['questions'][0].update(accepted_answers=['He has a book'], presentation={'prefix': 'He has'})
        self.assertEqual(validate_payload('exercise', payload)['questions'][0]['accepted_answers'], ['He has a book'])

    def test_approval_cannot_add_an_answer_unreachable_with_locked_prefix(self):
        self.node.payload = validate_payload('exercise', {
            'presentation': {'interaction': 'short_answer', 'style': 'partial_input'},
            'questions': [{'prompt': 'Complete sentence', 'accepted_answers': ['He has a book'],
                           'presentation': {'prefix': 'He has'}}]})
        self.node.save()
        proposal_id = self.propose(answer='hello').json()['proposal']['id']
        self.client.force_login(self.owner)
        response = self.post(self.url+proposal_id+'/', {'decision': 'approve', 'revision': self.node.updated_at.isoformat()})
        self.assertEqual(response.status_code, 400, response.content)
        self.assertIn('PREFIX', response.json()['error'])
        self.node.refresh_from_db()
        self.assertEqual(self.node.payload['questions'][0]['accepted_answers'], ['He has a book'])
        self.assertEqual(AnswerProposal.objects.get().status, 'pending')
