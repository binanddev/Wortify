"""All authoring entry points reject exercises impossible to complete in the UI."""
import json
from copy import deepcopy
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase
from practice.models import PracticeNode
from .practice_hub import validate_payload


def matching():
    return {'presentation': {'interaction': 'matching', 'style': 'tap_match'}, 'questions': [
        {'prompt': 'cat', 'accepted_answers': ['animal'], 'options': ['animal', 'plant']},
        {'prompt': 'tree', 'accepted_answers': ['plant'], 'options': ['animal', 'plant']},
    ]}


class PracticeContractAuditTests(SimpleTestCase):
    def test_matching_requires_exactly_one_unique_non_example_partner(self):
        payload = matching()
        payload['questions'][1]['accepted_answers'] = ['animal']
        with self.assertRaisesMessage(ValueError, 'Matching partners must be unique'):
            validate_payload('exercise', payload)
        payload = matching()
        payload['questions'][0]['accepted_answers'] = ['animal', 'plant']
        with self.assertRaisesMessage(ValidationError, 'exactly one answer'):
            validate_payload('exercise', payload)

    def test_example_can_share_partner_with_interactive_question(self):
        payload = matching()
        payload['questions'].append({**deepcopy(payload['questions'][0]), 'example': True})
        result = validate_payload('exercise', payload)
        self.assertEqual(len(result['questions']), 3)
        self.assertTrue(result['questions'][2]['example'])

    def test_text_matching_example_may_share_partner_and_options_are_deduplicated(self):
        from .content_text import parse_lesson
        lines = ['EXERCISE: Match words', 'TYPE: matching', 'STYLE: tap_match',
                 'QUESTION: example cat', 'ANSWER: animal', 'EXAMPLE: yes',
                 'QUESTION: cat', 'ANSWER: animal', 'QUESTION: tree', 'ANSWER: plant']
        payload = parse_lesson(list(enumerate(lines, 1)))
        self.assertTrue(payload['questions'][0]['example'])
        for question in payload['questions']:
            self.assertEqual(question['options'], ['animal', 'plant'])
        lines[-1] = 'ANSWER: animal'
        with self.assertRaisesMessage(ValueError, 'Matching partners must be unique'):
            parse_lesson(list(enumerate(lines, 1)))

    def test_gaps_require_blanks_even_when_an_answer_list_is_present(self):
        for mode in ('cloze_drag_drop', 'inline_selection'):
            with self.subTest(mode=mode):
                payload = {'presentation': {'interaction': mode}, 'questions': [
                    {'prompt': 'Say hello', 'accepted_answers': ['hello'], 'blanks': []},
                ]}
                with self.assertRaisesMessage(ValidationError, 'at least one blank'):
                    validate_payload('exercise', payload)

    def test_valid_gap_payloads_remain_supported(self):
        for mode in ('cloze_drag_drop', 'inline_selection'):
            with self.subTest(mode=mode):
                payload = {'presentation': {'interaction': mode}, 'questions': [
                    {'prompt': 'Say {{1}}', 'blanks': [{'answers': ['hello'], 'options': ['hello', 'bye']}],
                     'presentation': {'word_bank': ['hello']}},
                ]}
                result = validate_payload('exercise', payload)
                self.assertEqual(result['questions'][0]['blank_count'], 1)


class PracticeContractEntryPointTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user('contract-owner')
        self.client.force_login(self.user)
        self.folder = PracticeNode.objects.create(owner=self.user, language='en', kind='folder', title='Practice')

    def post(self, path, data):
        return self.client.post(path, json.dumps(data), content_type='application/json')

    def test_json_create_and_import_reject_impossible_matching(self):
        payload = matching()
        payload['questions'][1]['accepted_answers'] = ['animal']
        data = {'kind': 'exercise', 'title': 'Impossible pairs', 'parent': self.folder.pk, 'payload': payload}
        response = self.post('/api/en/practice-hub/nodes/', data)
        self.assertEqual(response.status_code, 400, response.content)
        response = self.post('/api/en/practice-hub/import/', {'parent': self.folder.pk, 'nodes': [data]})
        self.assertEqual(response.status_code, 400, response.content)
        self.assertFalse(PracticeNode.objects.filter(kind='exercise').exists())

    def test_patch_rejects_removing_all_blanks_without_overwriting_existing_content(self):
        payload = {'presentation': {'interaction': 'inline_selection'}, 'questions': [
            {'prompt': 'Say {{1}}', 'blanks': [{'answers': ['hello'], 'options': ['hello', 'bye']}]},
        ]}
        data = {'kind': 'exercise', 'title': 'Gap', 'parent': self.folder.pk, 'payload': payload}
        response = self.post('/api/en/practice-hub/nodes/', data)
        self.assertEqual(response.status_code, 201, response.content)
        node = PracticeNode.objects.get(kind='exercise')
        broken = deepcopy(node.payload)
        broken['questions'][0].update(prompt='Say hello', accepted_answers=['hello'], blanks=[])
        response = self.client.patch(f'/api/en/practice-hub/nodes/{node.pk}/', json.dumps({'payload': broken}), content_type='application/json')
        self.assertEqual(response.status_code, 400, response.content)
        node.refresh_from_db()
        self.assertEqual(len(node.payload['questions'][0]['blanks']), 1)
