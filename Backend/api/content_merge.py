"""Incremental imports into the shared Wortify library; personal copies are untouched."""
import hashlib
import json
import uuid
from collections import Counter
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from cards.models import Folder, Deck, Card
from practice.models import PracticeNode, ReadingFolder, ReadingLesson, SystemContentPackage

MODES = ('append', 'upsert', 'update')
SECTIONS = ('flashcards', 'practice', 'reading')


def publisher(create=False):
    users = get_user_model().objects
    user = users.filter(username='wortify-publisher').first()
    if not user and create:
        user, _ = users.get_or_create(username='wortify-publisher', defaults={'is_staff':True,'first_name':'Wortify','password':'!'})
    if user and (not user.is_staff or user.has_usable_password()):
        raise ValueError('Reserved Wortify publisher account already exists.')
    return user


def inventory(language, section):
    user = publisher()
    if not user:
        return [], hashlib.sha256(b'[]').hexdigest()
    scope = dict(owner=user, language=language)
    if section == 'flashcards':
        folders = list(Folder.objects.filter(**scope).values('id', 'parent_id', 'name'))
        leaves = list(Deck.objects.filter(**scope).values('id', 'folder_id', 'title', 'level', 'topic', 'description'))
        grouped = {}
        for card in Card.objects.filter(deck__owner=user, deck__language=language).order_by('position','id').values('id','deck_id','german_text','vietnamese_meaning','example_german','example_vietnamese','part_of_speech','image_url','image_source_url','image_credit','image_license','image_license_url'):
            grouped.setdefault(card['deck_id'], []).append(card)
        for leaf in leaves:
            leaf.update(kind='deck', cards=grouped.get(leaf['id'], []))
    elif section == 'practice':
        nodes = list(PracticeNode.objects.filter(**scope).values('id','parent_id','title','kind','payload'))
        folders = [n for n in nodes if n['kind']=='folder']
        leaves = [n for n in nodes if n['kind']!='folder']
    else:
        folders = list(ReadingFolder.objects.filter(**scope).values('id','parent_id','title'))
        leaves = list(ReadingLesson.objects.filter(**scope).values('id','folder_id','title','payload','level','topic'))
        for leaf in leaves:
            leaf['kind']='reading'
    by_id = {f['id']: f for f in folders}
    def folder_path(pk, seen=None):
        if pk is None: return []
        seen = set() if seen is None else seen
        if pk in seen or pk not in by_id: raise ValueError('Invalid existing folder tree.')
        seen.add(pk)
        node = by_id[pk]
        return folder_path(node['parent_id'], seen)+[node.get('title',node.get('name'))]
    rows=[]
    for folder in folders:
        rows.append(dict(id=folder['id'],kind='folder',path=folder_path(folder['id'])))
    for leaf in leaves:
        rows.append({**leaf,'path':folder_path(leaf.get('folder_id',leaf.get('parent_id')))+[leaf['title']]})
    rows.sort(key=lambda row:(row['path'],row['kind'],row['id']))
    revision=hashlib.sha256(json.dumps(rows,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    return rows, revision


def catalog(request):
    language=request.GET.get('language','de'); section=request.GET.get('section','practice')
    if language not in ('en','de') or section not in SECTIONS: raise ValueError('Invalid language or section.')
    rows, revision=inventory(language,section)
    if request.GET.get('item'):
        selected=[r for r in rows if str(r['id'])==request.GET['item'] and r['kind']==request.GET.get('kind')]
        if not selected: raise ValueError('Content not found.')
        return JsonResponse({'document':export_document(rows,selected[0],language,section)})
    items=[{'id':r['id'],'kind':r['kind'],'path':r['path'], 'count':len(r.get('cards',r.get('payload',{}).get('questions',[])))} for r in rows]
    history=list(SystemContentPackage.objects.filter(language=language).order_by('-created_at').values('id','title','created_at','counts','document')[:100])
    batches=[{k:v for k,v in r.items() if k!='document'} | {'mode':r['document'].get('mode','legacy')} for r in history if r['document'].get(section)]
    response=JsonResponse({'items':items,'revision':revision,'language':language,'section':section,'batches':batches})
    response['Cache-Control']='no-store'
    return response


def plan(document):
    changes=[]; revisions={}
    for section in SECTIONS:
        if not document.get(section): continue
        rows,revisions[section]=inventory(document['language'],section)
        index={}
        for row in rows: index.setdefault(tuple(row['path']),[]).append(row)
        def walk(nodes,parent=()):
            for node in nodes:
                path=parent+(node['title'],)
                matches=index.get(path,[])
                if len(matches)>1: raise ValueError('Ambiguous existing path: '+ '/'.join(path)+'. Resolve duplicate names before importing.')
                old=matches[0] if matches else None
                if old and old['kind']!=node['kind']: raise ValueError('Content type conflict: '+ '/'.join(path))
                if node['kind']=='folder':
                    action='reuse' if old else 'create'
                    if not old and document['mode']=='update': raise ValueError('Update target not found: '+ '/'.join(path))
                elif old:
                    action='skip' if document['mode']=='append' else 'update'
                    if action=='update' and all(old.get(k)==v for k,v in node.items() if k not in ('kind','cards')) and ('cards' not in node or all(any(all(c.get(k)==v for k,v in card.items()) for c in old['cards']) for card in node['cards'])):
                        action='unchanged'
                else:
                    if document['mode']=='update': raise ValueError('Update target not found: '+ '/'.join(path))
                    action='create'
                card_changes={}
                if node['kind']=='deck' and action not in ('skip','unchanged'):
                    old_cards={}
                    for card in old.get('cards',[]) if old else []:
                        key=card['german_text'].strip().casefold()
                        if key in old_cards: raise ValueError('Duplicate existing term in deck: '+ '/'.join(path))
                        old_cards[key]=card
                    card_changes=dict(Counter('update' if card['german_text'].strip().casefold() in old_cards else 'create' for card in node['cards']))
                changes.append({'section':section,'path':list(path),'kind':node['kind'],'action':action,'id':old['id'] if old else None,'cards':card_changes})
                if node['kind']=='folder': walk(node.get('children',[]),path)
        walk(document[section])
    return changes,revisions


def apply(document, user, changes):
    actions={(c['section'],tuple(c['path'])):c for c in changes}
    def walk(nodes,section,parent=None,path=()):
        for node in nodes:
            current=path+(node['title'],); change=actions[section,current]; kind=node['kind']
            if section=='practice': model=PracticeNode; parent_field='parent'
            elif kind=='folder': model=Folder if section=='flashcards' else ReadingFolder; parent_field='parent'
            else: model=Deck if section=='flashcards' else ReadingLesson; parent_field='folder'
            obj=model.objects.get(pk=change['id'],owner=user) if change['id'] else None
            if change['action'] in ('create','update'):
                fields={'owner':user,'language':document['language'],parent_field:parent}
                fields['name' if model==Folder else 'title']=node['title']
                if model==PracticeNode: fields.update(kind=kind,payload=node.get('payload',{}),visibility='public')
                elif model==Deck: fields.update(level=node.get('level','A2'),topic=node.get('topic',''),description=node.get('description',''),visibility='public')
                elif model==ReadingLesson: fields.update(payload=node['payload'],level=node.get('level',''),topic=node.get('topic',''),visibility='public')
                if obj:
                    for key,value in fields.items(): setattr(obj,key,value)
                    obj.save()
                else: obj=model.objects.create(**fields)
                if kind=='deck':
                    existing={}
                    for card in obj.cards.all():
                        key=card.german_text.strip().casefold()
                        if key in existing: raise ValueError('Duplicate existing term in deck: '+node['title'])
                        existing[key]=card
                    position=max([c.position for c in existing.values()],default=-1)+1
                    for values in node['cards']:
                        card=existing.get(values['german_text'].strip().casefold())
                        if card:
                            for key,value in values.items(): setattr(card,key,value)
                            card.save()
                        else:
                            Card.objects.create(deck=obj,position=position,**values);position+=1
            if kind=='folder': walk(node.get('children',[]),section,obj,current)
    for section in SECTIONS: walk(document.get(section,[]),section)
    return dict(Counter(c['action'] for c in changes))


def export_document(rows, selected, language, section):
    from .content_packages import CARD_FIELDS
    def node(row):
        result={'kind':row['kind'],'title':row['path'][-1]}
        if row['kind']=='folder':
            result['children']=[node(r) for r in rows if r['path'][:-1]==row['path']]
        elif row['kind']=='deck':
            result.update({k:row[k] for k in ('level','topic','description')})
            result['cards']=[{k:c[k] for k in CARD_FIELDS} for c in row['cards']]
        else:
            result['payload']=row['payload']
            if row['kind']=='reading': result.update(level=row['level'],topic=row['topic'])
        return result
    root=node(selected)
    for title in reversed(selected['path'][:-1]): root={'kind':'folder','title':title,'children':[root]}
    return {'format':'wortify-content','version':1,'id':str(uuid.uuid4()),'title':selected['path'][-1],'language':language,'mode':'update',section:[root]}


def manage(request):
    from .common import body
    from .management import audit
    data=body(request);language=data.get('language');section=data.get('section')
    if language not in ('en','de') or section not in SECTIONS: raise ValueError('Invalid language or section.')
    user=publisher(create=data.get('action')=='create-folder')
    if not user: raise ValueError('Library is empty.')
    get_user_model().objects.select_for_update().get(pk=user.pk)
    rows,revision=inventory(language,section)
    if data.get('revision')!=revision: raise ValueError('Library changed. Refresh and try again.')
    if data.get('action')=='create-folder':
        title=data.get('title')
        limit=100 if section=='flashcards' else 200
        if not isinstance(title,str) or not title.strip() or len(title.strip())>limit or '/' in title or title.strip() in ('.','..'): raise ValueError('Invalid folder title.')
        parent=next((r for r in rows if r['kind']=='folder' and r['id']==data.get('destination')),None)
        if data.get('destination') is not None and not parent: raise ValueError('Destination folder not found.')
        path=(parent['path'] if parent else [])+[title.strip()]
        if len(path)>10 or any(r['path']==path for r in rows): raise ValueError('Folder path already exists or is too deep.')
        model={'flashcards':Folder,'practice':PracticeNode,'reading':ReadingFolder}[section]
        fields={'owner':user,'language':language,'parent_id':parent['id'] if parent else None,'name' if section=='flashcards' else 'title':title.strip()}
        if section=='practice': fields.update(kind='folder',visibility='public')
        folder=model.objects.create(**fields)
        audit(request,request.user,f'Created Wortify folder {section}/{language}: {"/".join(path)}')
        return JsonResponse({'id':folder.pk,'changed':1},status=201)
    keys={(str(i.get('id')),i.get('kind')) for i in data.get('items',[]) if isinstance(i,dict)}
    selected=[r for r in rows if (str(r['id']),r['kind']) in keys]
    if not selected or len(selected)!=len(keys) or len(keys)>500: raise ValueError('Select 1–500 valid items.')
    action=data.get('action')
    if action not in ('rename','move','delete'): raise ValueError('Invalid library action.')
    if action=='rename' and not isinstance(data.get('title'),str): raise ValueError('Invalid title.')
    if action=='rename' and len(selected)!=1: raise ValueError('Rename one item at a time.')
    if action in ('move','delete') and any(r['kind']=='folder' and sum(other['kind']=='folder' and other['path']==r['path'] for other in rows)>1 for r in selected):
        raise ValueError('Rename duplicate folders before moving or deleting them.')
    selected=[r for r in selected if not any(f['kind']=='folder' and r['path'][:len(f['path'])]==f['path'] and r!=f for f in selected)]
    destination=None; target=[]
    if action=='move' and data.get('destination') is not None:
        destination=next((r for r in rows if r['kind']=='folder' and r['id']==data['destination']),None)
        if not destination: raise ValueError('Destination folder not found.')
        target=destination['path']
    proposals=set()
    for row in selected:
        if action=='delete': continue
        title=data.get('title','').strip() if action=='rename' else row['path'][-1]
        limit=100 if section=='flashcards' and row['kind']=='folder' else 150 if row['kind']=='deck' else 200
        if not title or len(title)>limit or '/' in title or title in ('.','..'): raise ValueError('Invalid title.')
        parent=row['path'][:-1] if action=='rename' else target
        new_path=parent+[title]
        if action=='move' and row['kind']=='folder' and target[:len(row['path'])]==row['path']: raise ValueError('Cannot move a folder inside itself.')
        if section=='practice' and row['kind']=='exercise' and not parent: raise ValueError('Practice exercises require a folder.')
        descendant_depth=max((len(r['path'])-len(row['path']) for r in rows if r['path'][:len(row['path'])]==row['path']),default=0)
        if len(new_path)+descendant_depth>11 or (row['kind']=='folder' and len(new_path)>10): raise ValueError('Maximum 10 folder levels.')
        if tuple(new_path) in proposals or any(r['path']==new_path and r!=row for r in rows): raise ValueError('Destination already contains this title.')
        proposals.add(tuple(new_path))
    for row in selected:
        model=PracticeNode if section=='practice' else (Folder if section=='flashcards' else ReadingFolder) if row['kind']=='folder' else Deck if section=='flashcards' else ReadingLesson
        obj=model.objects.get(pk=row['id'],owner=user)
        if action=='delete':
            # Folder models use SET_NULL in some sections; explicitly delete the selected subtree.
            descendants=[r for r in rows if r['path'][:len(row['path'])]==row['path']] if row['kind']=='folder' else [row]
            for child in sorted(descendants,key=lambda r:len(r['path']),reverse=True):
                child_model=PracticeNode if section=='practice' else (Folder if section=='flashcards' else ReadingFolder) if child['kind']=='folder' else Deck if section=='flashcards' else ReadingLesson
                child_model.objects.filter(pk=child['id'],owner=user).delete()
        else:
            if action=='rename': setattr(obj,'name' if model==Folder else 'title',data['title'].strip())
            else: setattr(obj,'parent_id' if row['kind']=='folder' or section=='practice' else 'folder_id',destination['id'] if destination else None)
            obj.save()
    audit(request,request.user,f'Wortify library {action}: {section}/{language}, {len(selected)} items')
    return JsonResponse({'changed':len(selected)})
