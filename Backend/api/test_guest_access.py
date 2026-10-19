import tempfile
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from cards.models import Deck, Card, StudyProgress
from practice.models import PracticeNode, ReadingLesson, PracticeProgress, PracticeAttempt, PracticeMedia

class GuestAccessTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('public-author')
        self.deck=Deck.objects.create(owner=self.user,language='de',title='Public',visibility='public')
        Card.objects.bulk_create([Card(deck=self.deck,german_text=str(i),vietnamese_meaning=str(i),position=i) for i in range(35)])
        self.private=Deck.objects.create(owner=self.user,language='de',title='Private')
        self.folder=PracticeNode.objects.create(owner=self.user,language='de',kind='folder',title='Public',visibility='public')
        self.theory=PracticeNode.objects.create(owner=self.user,language='de',parent=self.folder,kind='theory',title='Theory',visibility='public',payload={'format':'markdown','content':'Hello'})
        self.private_node=PracticeNode.objects.create(owner=self.user,language='de',parent=self.folder,kind='theory',title='Secret',payload={'content':'secret'})
        self.reading=ReadingLesson.objects.create(owner=self.user,language='de',title='Public reading',visibility='public',payload={'context':'Public text'})
        self.private_reading=ReadingLesson.objects.create(owner=self.user,language='de',title='Private reading',payload={'context':'secret'})

    def test_guest_catalogues_and_full_deck_study(self):
        response=self.client.get('/api/de/flashcard/discover/')
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual([r['id'] for r in response.json()['results']],[self.deck.pk])
        self.assertIsNone(response.json()['results'][0]['saved_id'])
        response=self.client.get(f'/api/de/flashcard/discover/{self.deck.pk}/?study=true&page=2')
        self.assertEqual(response.status_code,200)
        self.assertEqual(len(response.json()['cards']),5)
        self.assertEqual(response.json()['cards'][0]['german_text'],'30')
        response=self.client.get('/api/de/reading/discover/')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response.json()['total'],1)
        response=self.client.get('/api/de/practice-hub/explore/?browse=1')
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(response.json()['total'],1)
        self.assertFalse(response.json()['results'][0]['can_edit'])
        response=self.client.get(f'/api/de/practice-hub/public/{self.folder.pk}/')
        self.assertEqual([c['id'] for c in response.json()['children']],[self.theory.pk])
        self.assertEqual(StudyProgress.objects.count(),0)
        self.assertEqual(PracticeProgress.objects.count(),0)
        self.assertEqual(PracticeAttempt.objects.count(),0)

    def test_private_language_and_disabled_owner_stay_inaccessible(self):
        paths=[f'/api/de/flashcard/discover/{self.private.pk}/',f'/api/de/practice-hub/public/{self.private_node.pk}/',f'/api/de/reading/discover/open/?key=community:{self.private_reading.pk}',f'/api/en/practice-hub/public/{self.theory.pk}/']
        for path in paths:self.assertEqual(self.client.get(path).status_code,404,path)
        self.user.is_active=False;self.user.save()
        for path in [f'/api/de/flashcard/discover/{self.deck.pk}/',f'/api/de/practice-hub/public/{self.theory.pk}/',f'/api/de/reading/discover/open/?key=community:{self.reading.pk}']:
            self.assertEqual(self.client.get(path).status_code,404,path)
        self.assertEqual(self.client.get('/api/de/practice-hub/explore/?browse=1').json()['total'],0)

    def test_writes_personal_data_and_management_still_require_login(self):
        for path in [f'/api/de/flashcard/discover/{self.deck.pk}/copy/','/api/de/reading/discover/save/','/api/de/learning/sync/','/api/de/decks/','/api/de/practice-hub/nodes/','/api/manage/content-policy/']:
            response=self.client.post(path,{},content_type='application/json')
            self.assertEqual(response.status_code,401,path)
        for path in ['/api/de/decks/','/api/de/reading/','/api/manage/users/','/api/me/backup/']:
            self.assertEqual(self.client.get(path).status_code,401,path)
        self.assertEqual(Deck.objects.count(),2)

    def test_only_attached_public_media_can_be_read_by_guests(self):
        with tempfile.TemporaryDirectory() as directory, override_settings(MEDIA_ROOT=directory):
            media=PracticeMedia.objects.create(owner=self.user,language='de',file=SimpleUploadedFile('test.png',b'hello'),name='test.png',size=5,content_type='image/png')
            url=f'/api/de/practice-hub/media/{media.pk}/'
            self.assertEqual(self.client.get(url).status_code,404)
            self.theory.attachments.add(media)
            response=self.client.get(url)
            self.assertEqual(response.status_code,200)
            self.assertEqual(b''.join(response.streaming_content),b'hello')
            self.theory.visibility='private';self.theory.save()
            self.assertEqual(self.client.get(url).status_code,404)
