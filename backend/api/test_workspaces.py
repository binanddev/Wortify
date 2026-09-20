import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from cards.models import Deck,Card,Folder,StudyProgress,StudySettings,StudyAttempt,StudySession
from content.models import Book
from practice.models import Chapter

class WorkspaceTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user=get_user_model().objects.create_user('owner',password='test-pass')
        cls.other=get_user_model().objects.create_user('other',password='test-pass')
        cls.de=Deck.objects.create(owner=cls.user,title='Deutsch',language='de')
        cls.en=Deck.objects.create(owner=cls.user,title='English',language='en')
        for deck in [cls.de,cls.en]:
            for i,(term,meaning) in enumerate([('house','nhà'),('book','sách'),('water','nước'),('friend','bạn')]):
                Card.objects.create(deck=deck,german_text=term,vietnamese_meaning=meaning,position=i)
        cls.folder=Folder.objects.create(owner=cls.user,language='de',name='Private')
    def setUp(self):self.client.force_login(self.user)
    def post(self,path,data):return self.client.post(path,json.dumps(data),content_type='application/json')
    def start(self,kind='learn',**extra):
        response=self.post('/api/en/sessions/',{'deck':self.en.pk,'kind':kind,**extra})
        self.assertEqual(response.status_code,201,response.content)
        return response.json()
    def test_languages_isolate_content_even_for_same_owner(self):
        self.assertEqual([d['id'] for d in self.client.get('/api/en/decks/').json()['decks']],[self.en.pk])
        self.assertEqual(self.client.get('/api/en/decks/').json()['folders'],[])
        self.assertEqual(self.client.get(f'/api/en/decks/{self.de.pk}/').status_code,404)
        self.assertEqual(self.post('/api/en/next/',{'deck':self.de.pk}).status_code,404)
        self.assertEqual(self.post('/api/en/sessions/',{'deck':self.de.pk}).status_code,404)
        q=self.post('/api/de/next/',{'deck':self.de.pk,'mode':'flash'}).json()
        self.assertEqual(self.post(f'/api/en/submit/{q["token"]}/',{'answer':'remember'}).status_code,404)
        self.assertEqual(self.client.get('/api/decks/').status_code,404)
    def test_settings_and_folder_names_are_independent(self):
        self.client.patch('/api/en/settings/',json.dumps({'new_cards_per_day':3}),content_type='application/json')
        self.assertEqual(self.client.get('/api/de/settings/').json()['new_cards_per_day'],20)
        self.assertEqual(self.client.get('/api/en/settings/').json()['new_cards_per_day'],3)
        self.assertEqual(self.post('/api/en/folders/',{'name':'Private'}).status_code,200)
    def test_finite_flashcards_and_retry_do_not_double_grade(self):
        data=self.start('flash',count=2);url=f'/api/en/sessions/{data["token"]}/answer/'
        payload={'question':data['question']['token'],'answer':'remember'}
        first=self.post(url,payload).json()
        self.assertEqual(first['session']['completed'],1)
        self.assertEqual(self.post(url,payload).json()['session']['completed'],1)
        second=self.post(url,{'question':first['session']['question']['token'],'answer':'again'}).json()
        self.assertEqual(second['session']['result']['correct'],1)
        self.assertEqual(second['session']['result']['total'],2)
        review=self.start('learn',review_session=data['token'])
        self.assertEqual(review['total'],1)
    def test_test_hides_results_until_atomic_final_submission(self):
        data=self.start('test');token=data['token']
        self.assertEqual(data['completed'],0)
        self.assertIsNone(data['result'])
        values={}
        for q in data['questions']:
            self.assertNotIn('card',q);self.assertNotIn('target',q);self.assertNotIn('result',q)
            attempt=StudyAttempt.objects.get(token=q['token'])
            values[q['token']]=attempt.question['meaning'] if q['mode']=='quiz' else attempt.question['target']
            self.assertEqual(self.client.get(f'/api/en/question/{q["token"]}/').status_code,400)
        self.assertFalse(StudyProgress.objects.exists())
        self.assertEqual(self.post(f'/api/en/sessions/{token}/finish/',{'answers':{}}).status_code,400)
        self.assertFalse(StudyProgress.objects.exists())
        result=self.post(f'/api/en/sessions/{token}/finish/',{'answers':values}).json()
        self.assertEqual(result['result']['correct'],4)
        self.post(f'/api/en/sessions/{token}/finish/',{'answers':values})
        self.assertTrue(all(p.correct_count==1 for p in StudyProgress.objects.all()))
        self.assertEqual(self.client.get(f'/api/de/sessions/{token}/').status_code,404)
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(f'/api/en/sessions/{token}/').status_code,404)
    def test_book_library_shows_actual_books_not_empty_levels(self):
        book=Book.objects.get(slug='english-a1')
        Chapter.objects.create(book=book,number=1,title='Chapter one',page_start=1)
        books=self.client.get('/api/en/books/').json()['books']
        self.assertEqual([b['slug'] for b in books],['english-a1'])
        self.assertNotIn('level',books[0])
        self.assertEqual(self.client.get('/api/de/books/english-a1/').status_code,404)

    def test_session_rejects_out_of_order_and_invalid_answer_without_progress(self):
        data=self.start('flash',count=2)
        session=StudySession.objects.get(token=data['token'])
        url=f'/api/en/sessions/{session.token}/answer/'
        self.assertEqual(self.post(url,{'question':session.tokens[1],'answer':'remember'}).status_code,400)
        self.assertEqual(self.post(url,{'question':session.tokens[0],'answer':'bad'}).status_code,400)
        self.assertFalse(StudyProgress.objects.exists())
        self.assertEqual(self.client.get(f'/api/en/sessions/{session.token}/').json()['question']['token'],session.tokens[0])
