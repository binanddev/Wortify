from django.test import SimpleTestCase
from django.urls import resolve

class RetiredNotebookTests(SimpleTestCase):
    def test_notebook_is_no_longer_an_api_route(self):
        match = resolve('/api/de/decks/1/notebook/')
        self.assertNotEqual(match.func.__module__, 'api.vocabulary_notebook')
