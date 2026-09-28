from django.test import TestCase
from django.contrib.auth import get_user_model
from practice.models import PracticeNode


class ExploreTests(TestCase):
    def setUp(self):
        self.reader = get_user_model().objects.create_user('reader')
        self.author = get_user_model().objects.create_user('author', first_name='Linh')
        self.client.force_login(self.reader)

    def node(self, title, **overrides):
        values = dict(owner=self.author, language='en', kind='exercise', visibility='public', title=title,
                      payload={'presentation':{'interaction':'short_answer'}, 'instruction':'Ôn ngữ pháp', 'questions':[{'prompt':'Complete this sentence'}]})
        values.update(overrides)
        return PracticeNode.objects.create(**values)

    def search(self, **query):
        return self.client.get('/api/en/practice-hub/explore/', query)

    def test_search_finds_public_topics_without_accents_and_bilingual_aliases(self):
        node = self.node('Thì hiện tại đơn')
        english = self.node('Present Simple practice')
        result = self.search(q='thi hien tai don').json()
        self.assertEqual({n['id'] for n in result['results']}, {node.pk, english.pk})
        self.assertEqual(result['results'][0]['author'], 'Linh')
        self.assertNotIn('payload', result['results'][0])

    def test_search_never_exposes_private_nodes_other_languages_or_retired_modes(self):
        self.node('Private lesson', visibility='private')
        self.node('My private lesson', owner=self.reader, visibility='private')
        self.node('German lesson', language='de')
        self.node('Old lesson', payload={'presentation':{'interaction':'audio_dictation'}})
        node = self.node('Public lesson')
        self.assertEqual([n['id'] for n in self.search().json()['results']], [node.pk])

    def test_filters_pagination_and_prompt_search(self):
        for i in range(20): self.node(f'Lesson {i}')
        self.assertEqual(self.search().json()['total'],20)
        self.assertEqual(len(self.search(page=2).json()['results']),2)
        self.assertEqual(self.search(q='complete sentence').json()['total'],20)
        self.assertEqual(self.search(mode='matching').json()['total'],0)
        self.assertEqual(self.search(kind='folder').json()['total'],0)
        self.assertEqual(self.search(mode='unknown').status_code,400)
        self.assertEqual(self.search(page='invalid').status_code,400)
        self.client.logout()
        self.assertEqual(self.search().status_code,401)
