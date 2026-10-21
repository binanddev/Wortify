import json
import uuid
from copy import deepcopy
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from cards.models import Deck, Card, Folder
from practice.models import PracticeNode, ReadingLesson, SystemContentPackage
from .content_packages import validate_document


class ContentMergeTests(TestCase):
    def setUp(self):
        self.staff=get_user_model().objects.create_user('editor',is_staff=True)
        self.client.force_login(self.staff)
        self.url='/api/manage/content-packages/?section=flashcards&language=de'

    def document(self, title='Transport', term='Bus', mode='append'):
        return {'format':'wortify-content','version':1,'id':str(uuid.uuid4()),'title':'Batch','language':'de','mode':mode,'flashcards':[{'kind':'folder','title':'A1','children':[{'kind':'deck','title':title,'cards':[{'german_text':term,'vietnamese_meaning':'meaning'}]}]}]}

    def send(self,doc,**options):
        return self.client.post(self.url,{'text':json.dumps(doc),**options},content_type='application/json')

    def publish(self,doc):
        preview=self.send(doc,preview=True)
        self.assertEqual(preview.status_code,200,preview.content)
        response=self.send(doc,confirm='IMPORT',preview_token=preview.json()['preview_token'])
        self.assertEqual(response.status_code,201,response.content)
        return response.json()

    def test_batches_reuse_folder_and_retry_never_duplicates(self):
        first=self.document();self.publish(first);self.publish(self.document('Food','Brot'))
        self.assertEqual(Folder.objects.count(),1);self.assertEqual(Deck.objects.count(),2)
        self.assertTrue(self.send(first,confirm='IMPORT').json()['already_imported'])
        self.assertEqual(Deck.objects.filter(owner=self.staff).count(),0)
        self.assertEqual(set(Deck.objects.values_list('visibility',flat=True)),{'public'})

    def test_upsert_preserves_ids_omitted_terms_and_personal_copies(self):
        self.publish(self.document());original=Card.objects.get();deck=original.deck
        personal=Deck.objects.create(owner=self.staff,language='de',title='Copy')
        Card.objects.create(deck=personal,german_text='Bus',vietnamese_meaning='personal')
        doc=self.document(term='Zug',mode='upsert');self.publish(doc)
        self.assertEqual(Card.objects.filter(deck=deck).count(),2)
        update=self.document(mode='update');update['flashcards'][0]['children'][0]['cards'][0]['vietnamese_meaning']='updated'
        self.publish(update);original.refresh_from_db();self.assertEqual(original.vietnamese_meaning,'updated')
        self.assertEqual(Card.objects.get(deck=personal).vietnamese_meaning,'personal')
        self.assertTrue(self.send(doc,confirm='IMPORT').json()['already_imported'])
        original.refresh_from_db();self.assertEqual(original.vietnamese_meaning,'updated')

    def test_skip_missing_updates_and_changed_uuid_rejected(self):
        doc=self.document();self.publish(doc)
        self.publish(self.document(term='Zug'))
        self.assertEqual(Card.objects.count(),1)
        self.assertEqual(self.send(self.document('Missing',mode='update'),preview=True).status_code,400)
        doc['title']='different';self.assertEqual(self.send(doc,preview=True).status_code,400)

    def test_stale_preview_rejected_atomically(self):
        self.publish(self.document());doc=self.document('New')
        token=self.send(doc,preview=True).json()['preview_token']
        self.publish(self.document('Other'))
        response=self.send(doc,confirm='IMPORT',preview_token=token)
        self.assertEqual(response.status_code,400,response.content)
        self.assertFalse(Deck.objects.filter(title='New').exists())

    def test_catalog_export_and_management(self):
        self.publish(self.document());catalog=self.client.get(self.url).json()
        deck=next(r for r in catalog['items'] if r['kind']=='deck')
        exported=self.client.get(self.url+f'&item={deck["id"]}&kind=deck').json()['document']
        validate_document(exported)
        payload={'language':'de','section':'flashcards','revision':catalog['revision'],'items':[deck],'action':'rename','title':'Travel'}
        self.assertEqual(self.client.patch(self.url,json.dumps(payload),content_type='application/json').status_code,200)
        self.assertEqual(Deck.objects.get().title,'Travel')
        self.assertEqual(self.client.patch(self.url,json.dumps(payload),content_type='application/json').status_code,400)
        catalog=self.client.get(self.url).json();folder=next(r for r in catalog['items'] if r['kind']=='folder')
        payload.update(revision=catalog['revision'],items=[folder],action='delete')
        self.assertEqual(self.client.patch(self.url,json.dumps(payload),content_type='application/json').status_code,200)
        self.assertEqual(Card.objects.count(),0);self.assertEqual(Folder.objects.count(),0)

    def test_key_catalog_and_scope(self):
        self.publish(self.document());key=self.client.post('/api/manage/import-api/',{},content_type='application/json').json()['key']
        client=Client();headers={'HTTP_AUTHORIZATION':'Bearer '+key}
        response=client.get('/api/import/content/?section=flashcards&language=de',**headers)
        self.assertEqual(response.status_code,200,response.content)
        self.assertEqual(client.get(self.url,**headers).status_code,401)
        self.assertEqual(client.patch('/api/import/content/',{},content_type='application/json',**headers).status_code,405)
        self.client.force_login(get_user_model().objects.create_user('learner'))
        self.assertEqual(self.client.get(self.url).status_code,403)

    def test_practice_and_reading_batches(self):
        for section,kind in [('practice','theory'),('reading','reading')]:
            self.url=f'/api/manage/content-packages/?section={section}&language=de'
            payload={'format':'markdown','content':'Original'} if kind=='theory' else {'kind':'choice','presentation':{'interaction':'reading','style':'split_reading'},'context':'A bus.','questions':[{'prompt':'What?','options':['Bus','Car'],'accepted_answers':['Bus']}]}
            doc={'format':'wortify-content','version':1,'id':str(uuid.uuid4()),'title':'Batch','language':'de','mode':'upsert',section:[{'kind':'folder','title':'A1','children':[{'kind':kind,'title':'Lesson','payload':payload}]}]}
            self.publish(doc);doc['id']=str(uuid.uuid4());doc[section][0]['children'].append({'kind':kind,'title':'Second','payload':deepcopy(payload)})
            self.publish(doc)
            model=PracticeNode if section=='practice' else ReadingLesson
            self.assertEqual(model.objects.filter(kind='theory').count() if section=='practice' else model.objects.count(),2)

    def test_language_and_invalid_last_item_roll_back(self):
        doc=self.document();doc['language']='en'
        self.assertEqual(self.send(doc,preview=True).status_code,400)
        doc=self.document();doc['flashcards'][0]['children'].append({'kind':'deck','title':'Bad','cards':[]})
        self.assertEqual(self.send(doc,preview=True).status_code,400)
        self.assertEqual(SystemContentPackage.objects.count(),0)

    def test_move_folder_conflicts_and_catalog_modes(self):
        self.publish(self.document())
        user=Deck.objects.get().owner
        other=Folder.objects.create(owner=user,language='de',name='A2')
        catalog=self.client.get(self.url).json()
        folder=next(r for r in catalog['items'] if r['kind']=='folder' and r['path']==['A1'])
        data={'section':'flashcards','language':'de','revision':catalog['revision'],'items':[folder],'action':'move','destination':folder['id']}
        self.assertEqual(self.client.patch(self.url,json.dumps(data),content_type='application/json').status_code,400)
        data['destination']=other.id
        self.assertEqual(self.client.patch(self.url,json.dumps(data),content_type='application/json').status_code,200)
        catalog=self.client.get(self.url).json()
        self.assertTrue(any(r['path']==['A2','A1','Transport'] for r in catalog['items']))
        self.assertEqual(catalog['batches'][0]['mode'],'append')

    def test_text_mode_and_duplicate_path_rejected(self):
        from .content_text import parse_package
        text='WORTIFY: 1\nID: '+str(uuid.uuid4())+'\nTITLE: Batch\nLANGUAGE: de\nMODE: upsert\nSECTION: flashcards\nFOLDER: A1\nDECK: Transport\nTERM: Bus\nMEANING: bus'
        doc=parse_package(text);self.assertEqual(doc['mode'],'upsert');self.publish(doc)
        owner=Deck.objects.get().owner
        Deck.objects.create(owner=owner,language='de',folder=Folder.objects.get(owner=owner,name='A1'),title='Transport')
        self.assertEqual(self.send(self.document(),preview=True).status_code,400)

    def test_legacy_reading_updates_and_deletion_use_live_content(self):
        from pathlib import Path
        doc=json.loads((Path(__file__).resolve().parents[1]/'sample_data/content-package.json').read_text(encoding='utf-8'))
        self.url='/api/manage/content-packages/'
        self.publish(doc)
        source=ReadingLesson.objects.get(owner__username='wortify-publisher')
        key=source.source_key
        self.url='/api/manage/content-packages/?section=reading&language='+source.language
        exported=self.client.get(self.url+f'&item={source.id}&kind=reading').json()['document']
        def change(nodes):
            for node in nodes:
                if node['kind']=='reading': node['payload']['instruction']='Updated instruction'
                else: change(node['children'])
        change(exported['reading']);self.publish(exported)
        route='/api/'+source.language+'/reading/discover/'
        self.assertEqual(self.client.get(route).json()['total'],1)
        self.assertEqual(self.client.get(route+'open/',{'key':key}).json()['payload']['instruction'],'Updated instruction')
        catalog=self.client.get(self.url).json()
        item=next(r for r in catalog['items'] if r['kind']=='reading')
        data={'section':'reading','language':source.language,'revision':catalog['revision'],'items':[item],'action':'delete'}
        self.assertEqual(self.client.patch(self.url,json.dumps(data),content_type='application/json').status_code,200)
        self.assertEqual(self.client.get(route).json()['total'],0)
        self.assertEqual(self.client.get(route+'open/',{'key':key}).status_code,404)

    def test_create_first_folder_and_reuse_it_in_import(self):
        catalog=self.client.get(self.url).json()
        data={'language':'de','section':'flashcards','revision':catalog['revision'],'action':'create-folder','title':'A1','destination':None}
        response=self.client.patch(self.url,json.dumps(data),content_type='application/json')
        self.assertEqual(response.status_code,201,response.content)
        self.publish(self.document())
        self.assertEqual(Folder.objects.count(),1)
