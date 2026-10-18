from django.test import TestCase
from django.contrib.auth import get_user_model
from cards.models import Deck
from practice.models import SystemContentPackage

TEXT = """WORTIFY: 1
ID: 99999999-1111-4111-8111-111111111111
TITLE: A2 transport
LANGUAGE: de
SECTION: flashcards
FOLDER: A2/Travel
LEVEL: A2
TOPIC: Travel
DECK: Transport
TERM: Bus
MEANING: bus
EXAMPLE: Ich fahre Bus.
> Jeden Tag.
POS: noun
TERM: Zug
MEANING: train
"""

class ImportSectionsTests(TestCase):
    def setUp(self):
        self.staff=get_user_model().objects.create_user('section-staff',is_staff=True)
        self.client.force_login(self.staff)
        self.key=self.client.post('/api/manage/import-api/',{},content_type='application/json').json()['key']

    def send(self,section,**data):
        return self.client.post('/api/import/content/?section='+section,{'text':TEXT,**data},content_type='application/json',HTTP_AUTHORIZATION='Bearer '+self.key)

    def test_flashcard_preview_publish_and_public_discovery(self):
        preview=self.send('flashcards',preview=True)
        self.assertEqual(preview.status_code,200,preview.content)
        self.assertEqual(preview.json()['counts']['cards'],2)
        self.assertEqual(Deck.objects.count(),0)
        result=self.send('flashcards',confirm='IMPORT',preview_token=preview.json()['preview_token'])
        self.assertEqual(result.status_code,201,result.content)
        public=Deck.objects.get(visibility='public')
        self.assertEqual(public.owner.username,'wortify-publisher')
        self.assertEqual(public.cards.first().example_german,'Ich fahre Bus.\nJeden Tag.')
        self.assertEqual(self.client.get('/api/de/flashcard/discover/').json()['total'],1)
        retry=self.send('flashcards',confirm='IMPORT',preview_token=preview.json()['preview_token'])
        self.assertEqual(retry.status_code,200,retry.content)
        self.assertEqual(Deck.objects.count(),2)

    def test_wrong_sections_rejected_before_publication(self):
        for section in ['practice','reading','unknown']:
            result=self.send(section,preview=True)
            self.assertEqual(result.status_code,400,result.content)
        result=self.client.post('/api/manage/content-packages/?section=practice',{'text':TEXT,'preview':True},content_type='application/json')
        self.assertEqual(result.status_code,400,result.content)
        self.assertEqual(SystemContentPackage.objects.count(),0)
