from django.test import TestCase
from django.contrib.auth import get_user_model
from cards.models import Deck,Card


class RelatedFlashcardSearchTests(TestCase):
    def setUp(self):
        owner=get_user_model().objects.create_user('related-search-author')
        self.transport=Deck.objects.create(owner=owner,language='de',title='Transport',topic='Travel',description='Railway and public transport',level='B1',visibility='public')
        Card.objects.create(deck=self.transport,german_text='Bahnhof',vietnamese_meaning='nhà ga')
        self.food=Deck.objects.create(owner=owner,language='de',title='Food',description='Meals and groceries',visibility='public')
        Card.objects.create(deck=self.food,german_text='Apfel',vietnamese_meaning='quả táo')
        self.noise=Deck.objects.create(owner=owner,language='de',title='Tôi muốn tìm học giúp mình tài liệu từ vựng nâng cao',description='General study instructions',visibility='public')
        self.url='/api/de/flashcard/discover/'

    def first(self,query):
        response=self.client.get(self.url,{'q':query})
        self.assertEqual(response.status_code,200,response.content)
        return response.json()['results'][0]['id']

    def test_long_query_with_only_two_specific_words(self):
        self.assertEqual(self.first('Tôi muốn tìm học từ vựng về nhà ga'),self.transport.pk)

    def test_one_specific_word_outweighs_many_generic_words(self):
        self.assertEqual(self.first('Tìm giúp mình tài liệu về railway nâng cao'),self.transport.pk)

    def test_related_phrases_without_literal_words(self):
        self.assertEqual(self.first('đi lại bằng phương tiện công cộng'),self.transport.pk)
        self.assertEqual(self.first('ăn uống hằng ngày'),self.food.pk)

    def test_cross_language_related_query(self):
        self.assertEqual(self.first('Ich suche Vokabeln zum Verkehr'),self.transport.pk)
        self.assertEqual(self.first('I want to learn words about eating'),self.food.pk)


    def test_context_words_alone_do_not_enter_topic_results(self):
        for query in ['Tìm giúp mình tài liệu về railway nâng cao','ăn uống hằng ngày']:
            with self.subTest(query=query):
                result=self.client.get(self.url,{'q':query}).json()
                self.assertNotIn(self.noise.pk,[row['id'] for row in result['results']])

    def test_concept_search_keeps_literal_prefix_support(self):
        deck=Deck.objects.create(owner=self.transport.owner,language='de',title='Grammarworkshop',visibility='public')
        self.assertEqual(self.first('grammar'),deck.pk)
