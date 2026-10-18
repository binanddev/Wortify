import json
import uuid
from datetime import date
from unittest.mock import patch
from django.test import TestCase
from django.contrib.auth import get_user_model
from cards.models import Deck, Card, DeckLearningState


class VocabularyNotebookTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('notebook-user')
        self.client.force_login(self.user)
        self.deck=Deck.objects.create(owner=self.user,language='de',title='Vocabulary')
        self.cards=[Card.objects.create(deck=self.deck,german_text=f'Wort {i}',vietnamese_meaning=f'Nghĩa {i}',example_german='Ich lerne.',example_vietnamese='Tôi học.') for i in range(3)]
        self.url=f'/api/de/decks/{self.deck.pk}/notebook/'
        self.revision=0

    def send(self,action,**extra):
        data={'token':str(uuid.uuid4()),'revision':self.revision,'action':action,**extra}
        response=self.client.post(self.url,json.dumps(data),content_type='application/json')
        if response.status_code==200:self.revision=response.json()['notebook']['revision']
        return response

    def finish(self, difficult=False, selection='ready'):
        self.assertEqual(self.send('start',size=3,selection=selection).status_code,200)
        for phase in ('prepare','recall','sentence','variation','check'):
            for i in range(3):
                result=self.send('step',answer=self.cards[i].german_text if phase in ('recall','check') else 'Meine eigene Antwort.',correction='Korrigiert.',remembered=not(difficult and phase=='sentence' and i==0))
                self.assertEqual(result.status_code,200,result.content)
        return result.json()

    def test_phase_order_resume_and_no_automatic_sentence_grading(self):
        result=self.send('start',size=3).json()
        self.assertEqual(result['notebook']['session']['phase'],'prepare')
        for _ in range(3):self.send('step')
        fresh=self.client.get(self.url).json()
        self.assertEqual(fresh['notebook']['session']['phase'],'recall')
        self.send('step',answer='ein anderes Wort',remembered=True)
        fresh=self.client.get(self.url).json()
        self.assertEqual(fresh['notebook']['session']['index'],1)
        self.assertEqual(fresh['notebook']['session']['answers'][str(self.cards[0].pk)]['recall']['answer'],'ein anderes Wort')
        self.assertEqual(fresh['notebook']['records'],{})
        self.assertFalse(fresh['notebook']['session']['answers'][str(self.cards[0].pk)]['recall']['correct'])
        self.assertFalse(fresh['notebook']['session']['answers'][str(self.cards[0].pk)]['recall']['remembered'])

    def test_schedule_and_difficult_sentence_counts_as_needs_practice(self):
        with patch('api.vocabulary_notebook.timezone.localdate',return_value=date(2026,10,17)):
            result=self.finish(difficult=True)
        records=result['notebook']['records']
        self.assertTrue(records[str(self.cards[0].pk)]['needs_practice'])
        self.assertTrue(records[str(self.cards[0].pk)]['recall'])
        self.assertFalse(records[str(self.cards[0].pk)]['sentence'])
        self.assertEqual({r['next_date'] for r in records.values()},{'2026-10-18'})
        with patch('api.vocabulary_notebook.timezone.localdate',return_value=date(2026,10,18)):
            result=self.finish()
        self.assertEqual(result['notebook']['records'][str(self.cards[0].pk)]['next_date'],'2026-10-19')
        self.assertEqual(result['notebook']['records'][str(self.cards[1].pk)]['next_date'],'2026-10-21')

    def test_early_practice_does_not_accelerate_schedule(self):
        with patch('api.vocabulary_notebook.timezone.localdate',return_value=date(2026,10,17)):
            first=self.finish()
            self.assertEqual(self.send('start',size=3).status_code,400)
            second=self.finish(selection='all')
        self.assertEqual(first['notebook']['records'],second['notebook']['records'])

    def test_duplicate_request_and_stale_tab(self):
        token=str(uuid.uuid4())
        first=self.send('start',token=token,size=3)
        duplicate=self.send('start',token=token,revision=0,size=3)
        self.assertEqual(first.json(),duplicate.json())
        self.assertEqual(self.send('step',revision=0).status_code,409)
        self.assertEqual(self.client.get(self.url).json()['notebook']['session']['index'],0)

    def test_invalid_inputs_do_not_advance(self):
        for size in (True,2,9,'5'):
            self.assertEqual(self.send('start',size=size).status_code,400)
        self.send('start',size=3)
        for _ in range(3):self.send('step')
        for values in ({'remembered':True,'answer':''},{'remembered':'yes','answer':'x'},{'remembered':False,'answer':'x'*2001}):
            self.assertEqual(self.send('step',**values).status_code,400)
        self.assertEqual(self.client.get(self.url).json()['notebook']['session']['index'],0)

    def test_discard_and_deleted_cards(self):
        self.send('start',size=3)
        self.cards[0].delete()
        self.assertEqual(self.send('step').status_code,400)
        self.assertEqual(self.send('discard').status_code,200)
        self.assertEqual(self.send('start',size=3).status_code,200)
        self.assertEqual(len(self.client.get(self.url).json()['notebook']['session']['cards']),2)

    def test_owner_language_and_retired_review_route(self):
        self.assertEqual(self.client.get(self.url.replace('/de/','/en/')).status_code,404)
        self.assertEqual(self.client.get(self.url.replace('/notebook/','/review/')).status_code,404)
        other=get_user_model().objects.create_user('other-notebook')
        self.client.force_login(other)
        self.assertEqual(self.client.get(self.url).status_code,404)
        self.client.logout()
        self.assertEqual(self.client.get(self.url).status_code,401)

    def test_backup_remaps_saved_notebook_ids(self):
        from .backups import export_archive, read_archive, restore_archive
        from django.core.files.uploadedfile import SimpleUploadedFile
        self.finish()
        target=get_user_model().objects.create_user('notebook-restored')
        stream=export_archive(self.user)
        raw=stream.read();stream.close()
        archive,records=read_archive(SimpleUploadedFile('backup.zip',raw))
        try:restore_archive(target,archive,records)
        finally:archive.close()
        restored=DeckLearningState.objects.get(user=target).notebook
        ids=set(Card.objects.filter(deck__owner=target).values_list('pk',flat=True))
        self.assertEqual(set(restored['session']['cards']),ids)
        self.assertEqual(set(restored['records']),{str(cid) for cid in ids})
        self.assertEqual(set(restored['session']['answers']),{str(cid) for cid in ids})
        self.assertNotIn('last_token',restored)

    def test_intervals_progress_through_seven_and_fourteen_days(self):
        for day, expected in [(date(2026,10,1),'2026-10-02'),(date(2026,10,2),'2026-10-05'),(date(2026,10,5),'2026-10-12'),(date(2026,10,12),'2026-10-26')]:
            with patch('api.vocabulary_notebook.timezone.localdate',return_value=day):
                result=self.finish()
            self.assertEqual({r['next_date'] for r in result['notebook']['records'].values()},{expected})

    def test_edit_card_in_session_and_grade_updated_aliases(self):
        self.send('start', size=3)
        for _ in range(3): self.send('step')
        card = self.cards[0]
        response = self.client.patch(f'/api/de/decks/{self.deck.pk}/cards/{card.pk}/',
            json.dumps({'german_text': 'Fähre', 'article': 'die', 'accepted_answers': 'Fährschiff'}), content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)
        fresh = self.client.get(self.url).json()
        self.assertEqual(fresh['notebook']['session']['phase'], 'recall')
        self.assertEqual(fresh['notebook']['session']['index'], 0)
        self.assertEqual(fresh['cards'][0]['accepted_answers'], ['Fährschiff'])
        result = self.send('step', answer='  FÄHRSCHIFF! ', remembered=True).json()
        self.assertTrue(result['notebook']['session']['answers'][str(card.pk)]['recall']['correct'])
