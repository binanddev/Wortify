from django.test import TestCase
from cards.services.importing import parse_cards

class QuizletImportTests(TestCase):
    def test_two_columns_auto_tab_and_optional_fields(self):
        rows = parse_cards('\ufeffHaus\tngôi nhà\r\ngehen\tđi, đi bộ\r\n', '|')
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['german_text'], 'Haus')
        self.assertEqual(rows[1]['vietnamese_meaning'], 'đi, đi bộ')
        self.assertEqual(rows[0]['example_german'], '')
    def test_two_columns_explicit_delimiters(self):
        for sep in ['|', ';', ',', '\t']:
            rows = parse_cards('hello'+sep+'xin chào', sep)
            self.assertEqual(rows[0]['vietnamese_meaning'], 'xin chào')

    def test_readable_json_import(self):
        import json
        rows = parse_cards(json.dumps([{'german_text': 'Haus', 'vietnamese_meaning': 'ngôi nhà', 'notes': 'First line\nSecond line'}], ensure_ascii=False, indent=2), '|')
        self.assertEqual(rows[0]['german_text'], 'Haus')
        self.assertEqual(rows[0]['notes'], 'First line\nSecond line')

    def test_json_rejects_invalid_cards(self):
        from django.core.exceptions import ValidationError
        for text in ['[]', '[null]', '[{"german_text": 3}]', '[{"german_text": "Haus"}]', '[invalid]']:
            with self.subTest(text=text), self.assertRaises(ValidationError):
                parse_cards(text, '|')
