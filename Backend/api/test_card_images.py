import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from cards.models import Card, Deck
from cards.services.importing import parse_cards
from .content_packages import validate_document

class CardImageTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('images')
        self.client.force_login(self.user)
        self.deck=Deck.objects.create(owner=self.user,language='de',title='Images',visibility='public')
        self.card=Card.objects.create(deck=self.deck,german_text='Bus',vietnamese_meaning='bus')
        self.url=f'/api/de/decks/{self.deck.pk}/cards/{self.card.pk}/'
        self.image={'image_url':'https://upload.wikimedia.org/wikipedia/commons/a/ab/Example.jpg','image_source_url':'https://commons.wikimedia.org/wiki/File:Example.jpg','image_credit':'Test author','image_license':'CC BY 4.0','image_license_url':'https://creativecommons.org/licenses/by/4.0/'}

    def test_link_edit_clear_discovery_and_copy(self):
        response=self.client.patch(self.url,self.image,content_type='application/json')
        self.assertEqual(response.status_code,200,response.content)
        self.card.refresh_from_db();self.assertEqual(self.card.image_url,self.image['image_url'])
        self.assertEqual(self.client.get(f'/api/de/flashcard/discover/{self.deck.pk}/?study=true').json()['cards'][0]['image_credit'],'Test author')
        other=get_user_model().objects.create_user('copy-images');self.client.force_login(other)
        self.assertEqual(self.client.patch(self.url,self.image,content_type='application/json').status_code,404)
        response=self.client.post(f'/api/de/flashcard/discover/{self.deck.pk}/copy/',{},content_type='application/json')
        self.assertEqual(response.status_code,201,response.content)
        self.assertEqual(Card.objects.get(deck__owner=other).image_url,self.image['image_url'])
        self.client.force_login(self.user)
        self.assertEqual(self.client.patch(self.url,{'image_url':''},content_type='application/json').status_code,200)
        self.card.refresh_from_db();self.assertEqual(self.card.image_url,'')

    def test_invalid_links_rejected_and_no_image_files(self):
        for link in ['javascript:alert(1)','data:image/png;base64,AAAA','http://example.com/a.png','https://localhost/a.png','https://127.0.0.1/a.png','https://u:p@example.com/a.png']:
            self.assertEqual(self.client.patch(self.url,{'image_url':link},content_type='application/json').status_code,400)
        self.assertFalse(any(field.get_internal_type() in ('ImageField','FileField','BinaryField') for field in Card._meta.fields))

    def test_atomic_bulk_skips_existing_images_and_checks_ownership(self):
        second=Card.objects.create(deck=self.deck,german_text='Zug',vietnamese_meaning='train',image_url='https://example.com/existing.jpg')
        url=f'/api/de/decks/{self.deck.pk}/images/'
        response=self.client.post(url,{'items':[{'id':self.card.id,**self.image},{'id':second.id,**self.image}]},content_type='application/json')
        self.assertEqual(response.status_code,200,response.content);self.assertEqual(response.json()['skipped'],1)
        second.refresh_from_db();self.assertEqual(second.image_url,'https://example.com/existing.jpg')
        self.card.image_url='';self.card.save()
        response=self.client.post(url,{'items':[{'id':self.card.id,**self.image},{'id':999999,**self.image}]},content_type='application/json')
        self.assertEqual(response.status_code,400);self.card.refresh_from_db();self.assertEqual(self.card.image_url,'')

    def test_personal_and_staff_import_keep_links(self):
        card={'german_text':'Bus','vietnamese_meaning':'bus',**self.image}
        self.assertEqual(parse_cards(json.dumps([card]),'|')[0]['image_url'],self.image['image_url'])
        import uuid
        doc={'format':'wortify-content','version':1,'id':str(uuid.uuid4()),'title':'Images','language':'de','flashcards':[{'kind':'deck','title':'Images','cards':[card]}]}
        normalized,_=validate_document(doc);self.assertEqual(normalized['flashcards'][0]['cards'][0]['image_credit'],'Test author')
        self.assertNotIn('image_url',validate_document({**doc,'flashcards':[{'kind':'deck','title':'Images','cards':[{'german_text':'Bus','vietnamese_meaning':'bus'}]}]})[0]['flashcards'][0]['cards'][0])
        from .content_text import parse_package
        text='WORTIFY: 1\nID: '+doc['id']+'\nTITLE: Images\nLANGUAGE: de\nSECTION: flashcards\nDECK: Images\nTERM: Bus\nMEANING: bus\nIMAGE: '+self.image['image_url']
        self.assertEqual(validate_document(parse_package(text))[0]['flashcards'][0]['cards'][0]['image_url'],self.image['image_url'])
