import io
import json
import uuid
import zipfile
from datetime import timedelta
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import Client, TestCase
from django.utils import timezone
from cards.models import Card, Deck, DeckLearningState, DeckOperation, Folder, StudyProgress
from content.models import ContentPolicy


class DeckManagementTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = get_user_model().objects.create_user('library-owner')
        cls.other = get_user_model().objects.create_user('library-other')
        cls.a = Folder.objects.create(owner=cls.user, language='en', name='Lektion 2')
        cls.b = Folder.objects.create(owner=cls.user, language='en', name='Lektion 3')
        cls.deck = Deck.objects.create(owner=cls.user, language='en', title='Travel', folder=cls.a)
        cls.second = Deck.objects.create(owner=cls.user, language='en', title='Food')
        cls.foreign = Deck.objects.create(owner=cls.other, language='en', title='Private')
        cls.german = Deck.objects.create(owner=cls.user, language='de', title='Deutsch')
        cls.card = Card.objects.create(deck=cls.deck, german_text='=1+1', vietnamese_meaning='nhà ga',
            example_german='We meet at the station.', accepted_answers=['station'], notes='Note',
            image_url='https://example.com/station.jpg', image_credit='Photographer')
        StudyProgress.objects.create(user=cls.user, card=cls.card, correct_count=5)
        DeckLearningState.objects.create(user=cls.user, deck=cls.deck, progress={str(cls.card.pk):{'hits':5}})

    def setUp(self):
        self.client.force_login(self.user)

    def manage(self, action, ids=None, **values):
        payload = {'action': action, 'request_id': str(uuid.uuid4()), **values}
        if ids is not None:
            payload['ids'] = ids
        return self.client.post('/api/en/decks/manage/', json.dumps(payload), content_type='application/json')

    def test_move_and_undo_preserve_ids_cards_and_progress(self):
        result = self.manage('move', [self.deck.pk,self.second.pk], folder=self.b.pk)
        self.assertEqual(result.status_code,200,result.content)
        self.assertEqual(result.json()['count'],2)
        self.deck.refresh_from_db();self.second.refresh_from_db()
        self.assertEqual(self.deck.folder_id,self.b.pk);self.assertEqual(self.second.folder_id,self.b.pk)
        self.assertEqual(StudyProgress.objects.get(card=self.card).correct_count,5)
        response=self.manage('undo',operation_id=result.json()['operation_id'])
        self.assertEqual(response.status_code,200,response.content)
        self.deck.refresh_from_db();self.second.refresh_from_db()
        self.assertEqual(self.deck.folder_id,self.a.pk);self.assertIsNone(self.second.folder_id)
        self.assertEqual(DeckLearningState.objects.get(deck=self.deck).progress[str(self.card.pk)]['hits'],5)
        self.assertEqual(self.manage('undo',operation_id=result.json()['operation_id']).status_code,400)

    def test_stale_and_expired_moves_cannot_overwrite_later_changes(self):
        moved=self.manage('move',[self.deck.pk],folder=self.b.pk).json()
        self.client.patch(f'/api/en/decks/{self.deck.pk}/',json.dumps({'title':'Updated'}),content_type='application/json')
        self.assertEqual(self.manage('undo',operation_id=moved['operation_id']).status_code,400)
        self.deck.refresh_from_db();self.assertEqual(self.deck.folder_id,self.b.pk)
        second=self.manage('move',[self.second.pk],folder=self.b.pk).json()
        DeckOperation.objects.filter(token=second['operation_id']).update(created_at=timezone.now()-timedelta(minutes=16))
        self.assertEqual(self.manage('undo',operation_id=second['operation_id']).status_code,400)

    def test_invalid_member_makes_the_whole_move_fail(self):
        response=self.manage('move',[self.deck.pk,self.foreign.pk],folder=self.b.pk)
        self.assertEqual(response.status_code,404)
        self.deck.refresh_from_db();self.assertEqual(self.deck.folder_id,self.a.pk)
        self.assertEqual(DeckOperation.objects.count(),0)
        self.assertEqual(self.manage('move',[self.deck.pk,self.german.pk],folder=None).status_code,404)

    def test_invalid_or_hidden_destination_makes_no_changes(self):
        hidden=Folder.objects.create(owner=self.user,language='en',name='Hidden',archived=True)
        child=Folder.objects.create(owner=self.user,language='en',name='Child',parent=hidden)
        foreign=Folder.objects.create(owner=self.other,language='en',name='Other')
        german=Folder.objects.create(owner=self.user,language='de',name='German')
        for folder,status in [(child.pk,400),(foreign.pk,404),(german.pk,404),('bad',400)]:
            with self.subTest(folder=folder):self.assertEqual(self.manage('move',[self.deck.pk],folder=folder).status_code,status)
        self.deck.refresh_from_db();self.assertEqual(self.deck.folder_id,self.a.pk)

    def test_copy_has_independent_cards_and_no_learning_progress(self):
        response=self.manage('copy',[self.deck.pk],folder=self.b.pk,names={str(self.deck.pk):'Travel copy'})
        self.assertEqual(response.status_code,200,response.content)
        copy=Deck.objects.get(pk=response.json()['ids'][0])
        self.assertEqual(copy.title,'Travel copy');self.assertEqual(copy.folder_id,self.b.pk)
        self.assertEqual(copy.visibility,'private');self.assertIsNone(copy.source_deck_id)
        card=copy.cards.get()
        self.assertNotEqual(card.pk,self.card.pk)
        for field in ['german_text','vietnamese_meaning','example_german','accepted_answers','notes','image_url','image_credit']:
            self.assertEqual(getattr(card,field),getattr(self.card,field))
        self.assertFalse(StudyProgress.objects.filter(card__deck=copy).exists())
        self.assertFalse(DeckLearningState.objects.filter(deck=copy).exists())

    def test_copy_respects_current_publication_policy(self):
        ContentPolicy.objects.update_or_create(pk=1,defaults={'mode':'new_public'})
        response=self.manage('copy',[self.deck.pk],folder=None)
        self.assertEqual(Deck.objects.get(pk=response.json()['ids'][0]).visibility,'public')

    def test_copy_retry_is_idempotent_and_changed_request_is_rejected(self):
        payload={'request_id':str(uuid.uuid4()),'action':'copy','ids':[self.deck.pk],'folder':None}
        first=self.client.post('/api/en/decks/manage/',json.dumps(payload),content_type='application/json')
        second=self.client.post('/api/en/decks/manage/',json.dumps(payload),content_type='application/json')
        self.assertEqual(first.json(),second.json());self.assertEqual(DeckOperation.objects.count(),1)
        payload['folder']=self.b.pk
        self.assertEqual(self.client.post('/api/en/decks/manage/',json.dumps(payload),content_type='application/json').status_code,400)

    def test_copy_failure_rolls_back_created_decks_and_receipt(self):
        count=Deck.objects.count()
        with patch('api.deck_management.Card.objects.bulk_create',side_effect=ValueError('Copy failed')):
            self.assertEqual(self.manage('copy',[self.deck.pk,self.second.pk],folder=None).status_code,400)
        self.assertEqual(Deck.objects.count(),count);self.assertEqual(DeckOperation.objects.count(),0)

    def test_deletion_is_atomic_and_retry_safe(self):
        self.assertEqual(self.manage('delete',[self.deck.pk,self.foreign.pk]).status_code,404)
        self.assertTrue(Deck.objects.filter(pk=self.deck.pk).exists())
        payload={'request_id':str(uuid.uuid4()),'action':'delete','ids':[self.deck.pk,self.second.pk]}
        first=self.client.post('/api/en/decks/manage/',json.dumps(payload),content_type='application/json')
        self.assertEqual(first.status_code,200)
        self.assertEqual(self.client.post('/api/en/decks/manage/',json.dumps(payload),content_type='application/json').json(),first.json())
        self.assertFalse(Card.objects.filter(pk=self.card.pk).exists());self.assertFalse(StudyProgress.objects.filter(card_id=self.card.pk).exists())
        self.assertTrue(Deck.objects.filter(pk=self.foreign.pk).exists())

    def test_ids_request_token_and_batch_limits_are_validated(self):
        for ids in [[],[True],[self.deck.pk,self.deck.pk],list(range(1,102))]:
            with self.subTest(ids=ids):self.assertEqual(self.manage('move',ids,folder=None).status_code,400)
        self.assertEqual(self.manage('move',[self.deck.pk]).status_code,400)
        self.assertEqual(self.manage('move',[self.deck.pk],folder=None,unexpected=True).status_code,400)
        with patch('api.deck_management.MAX_CARDS',0):
            self.assertEqual(self.manage('copy',[self.deck.pk],folder=None).status_code,400)
        self.assertEqual(self.manage('copy',[self.deck.pk],folder=None,names={str(self.deck.pk):' '}).status_code,400)

    def test_export_is_owner_scoped_and_preserves_files_and_csv_safety(self):
        response=self.client.get(f'/api/en/decks/export/?ids={self.deck.pk},{self.second.pk}&format=json')
        self.assertEqual(response.status_code,200)
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            manifest=json.loads(archive.read('manifest.json'))
            self.assertEqual(len(manifest['decks']),2)
            cards=json.loads(archive.read(f'deck-{self.deck.pk}.json'))
            self.assertEqual(cards[0]['image_url'],self.card.image_url)
        csv_response=self.client.get(f'/api/en/decks/export/?ids={self.deck.pk}&format=csv')
        with zipfile.ZipFile(io.BytesIO(csv_response.content)) as archive:
            self.assertIn("'=1+1",archive.read(f'deck-{self.deck.pk}.csv').decode('utf-8-sig'))
        self.assertEqual(self.client.get(f'/api/en/decks/export/?ids={self.deck.pk},{self.foreign.pk}').status_code,404)
        self.assertEqual(DeckOperation.objects.count(),0)

    def test_folder_delete_keeps_decks_and_children_and_handles_name_conflicts(self):
        child=Folder.objects.create(owner=self.user,language='en',name='Nested',parent=self.a)
        self.assertEqual(self.client.delete(f'/api/en/folders/{self.a.pk}/').status_code,200)
        child.refresh_from_db();self.deck.refresh_from_db()
        self.assertIsNone(child.parent_id);self.assertIsNone(self.deck.folder_id)
        root=Folder.objects.create(owner=self.user,language='en',name='Existing')
        Folder.objects.create(owner=self.user,language='en',name='Existing',parent=self.b)
        self.assertEqual(self.client.delete(f'/api/en/folders/{self.b.pk}/').status_code,400)
        self.assertTrue(Folder.objects.filter(pk=root.pk).exists());self.assertTrue(Folder.objects.filter(pk=self.b.pk).exists())

    def test_authentication_csrf_and_receipt_ownership(self):
        response=self.manage('copy',[self.deck.pk],folder=None)
        self.client.force_login(self.other)
        self.assertEqual(self.manage('undo',operation_id=response.json()['operation_id']).status_code,400)
        csrf=Client(enforce_csrf_checks=True);csrf.force_login(self.user)
        self.assertEqual(csrf.post('/api/en/decks/manage/',json.dumps({'action':'delete','ids':[self.deck.pk],'request_id':str(uuid.uuid4())}),content_type='application/json').status_code,403)
        self.client.logout()
        self.assertEqual(self.manage('delete',[self.deck.pk]).status_code,401)
        self.assertEqual(self.client.get(f'/api/en/decks/export/?ids={self.deck.pk}').status_code,401)
