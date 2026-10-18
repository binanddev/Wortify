"""One validated JSON document for system content and native personal copies."""
import hashlib
import json
import uuid
from copy import deepcopy
from collections import Counter
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from cards.models import Folder, Deck, Card
from practice.models import PracticeNode, ReadingLesson, ReadingFolder, SystemContentPackage, PackageReceipt
from .common import endpoint
from .management import management, audit
from .practice_hub import validate_payload

MAX_BYTES = 50 * 1024 * 1024
CARD_FIELDS = {"german_text":500,"vietnamese_meaning":500,"example_german":2000,"example_vietnamese":2000,"part_of_speech":50}



def validate_document(data):
    if not isinstance(data,dict) or set(data)-{'format','version','id','title','language','flashcards','practice','reading'}:
        raise ValueError('Unknown package fields.')
    if data.get('format')!='wortify-content' or data.get('version')!=1:
        raise ValueError('Use wortify-content version 1.')
    try: data['id']=str(uuid.UUID(data['id']))
    except (ValueError, KeyError, TypeError, AttributeError): raise ValueError('Package id must be a UUID. Keep it unchanged when retrying.')
    def title(value,limit=200):
        if not isinstance(value,str) or not value.strip() or len(value)>limit: raise ValueError(f'Title must contain 1–{limit} characters.')
        return value.strip()
    data=deepcopy(data); data['title']=title(data.get('title'))
    if data.get('language') not in ('de','en'): raise ValueError('Language must be de or en.')
    counts=Counter(); total=0
    def walk(nodes,section,depth=0):
        nonlocal total
        if not isinstance(nodes,list): raise ValueError(f'{section} must be a list.')
        siblings=set()
        for node in nodes:
            total+=1
            if total>5000: raise ValueError('Maximum 5000 content nodes.')
            if not isinstance(node,dict): raise ValueError('Each node must be an object.')
            kind=node.get('kind'); node['title']=title(node.get('title'),100 if section=='flashcards' and kind=='folder' else 150 if kind=='deck' else 200)
            if node['title'].casefold() in siblings: raise ValueError('Duplicate sibling title: '+node['title'])
            siblings.add(node['title'].casefold())
            if kind=='folder':
                if set(node)-{'kind','title','children'}: raise ValueError('Folder only accepts kind, title, children.')
                if depth>=10: raise ValueError('Maximum 10 folder levels.')
                counts[section+'_folders']+=1
                walk(node.get('children',[]),section,depth+1)
            elif section=='flashcards' and kind=='deck':
                if set(node)-{'kind','title','level','topic','description','cards'}: raise ValueError('Unknown deck fields.')
                if node.get('level','A2') not in ('A1','A2','B1','B2','C1','C2'): raise ValueError('Invalid CEFR level.')
                for field,limit in [('topic',100),('description',5000)]:
                    if not isinstance(node.get(field,''),str) or len(node.get(field,''))>limit: raise ValueError('Invalid '+field)
                cards=node.get('cards')
                if not isinstance(cards,list) or not 1<=len(cards)<=2000: raise ValueError('Each deck needs 1–2000 cards.')
                counts['cards']+=len(cards); counts['decks']+=1
                if counts['cards']>100000: raise ValueError('Maximum 100000 cards per package.')
                terms=set()
                for card in cards:
                    if not isinstance(card,dict) or set(card)-set(CARD_FIELDS): raise ValueError('Use the five supported card fields.')
                    for field in CARD_FIELDS: card.setdefault(field,'')
                    for field,limit in CARD_FIELDS.items():
                        if not isinstance(card[field],str) or len(card[field])>limit: raise ValueError('Invalid card field: '+field)
                    if not card['german_text'].strip() or not card['vietnamese_meaning'].strip(): raise ValueError('Term and meaning are required.')
                    term=card['german_text'].strip().casefold()
                    if term in terms: raise ValueError('Duplicate term in deck: '+card['german_text'])
                    terms.add(term)
            elif (section=='practice' and kind in ('exercise','theory')) or (section=='reading' and kind=='reading'):
                if set(node)-({'kind','title','payload','level','topic'} if kind=='reading' else {'kind','title','payload'}): raise ValueError('Unknown lesson fields.')
                if kind=='reading':
                    from .reading import metadata
                    node.update(metadata(node))
                if section=='practice' and kind=='exercise' and depth==0: raise ValueError('Practice exercises require a folder.')
                payload=node.get('payload',{})
                if payload.get('attachments'): raise ValueError('JSON packages do not embed uploaded media. Omit attachments.')
                payload=validate_payload('exercise' if kind=='reading' else kind,payload)
                is_reading=payload.get('presentation',{}).get('interaction')=='reading'
                if (kind=='reading')!=is_reading: raise ValueError('Reading lessons belong in the reading section.')
                node['payload']=payload; counts[kind]+=1
            else: raise ValueError('Invalid kind for '+section)
    for section in ('flashcards','practice','reading'): walk(data.setdefault(section,[]),section)
    if not total: raise ValueError('The package is empty.')
    counts['nodes']=total
    return data,dict(counts)


def materialize(package,user):
    # Caller serializes writes by locking the destination user.
    receipt=PackageReceipt.objects.filter(package=package,user=user).first()
    if receipt: return {'roots':{k:v for k,v in receipt.result.get('roots',{}).items() if k in ('flashcards','practice','reading')},'counts':system_counts(package.counts),'already_imported':True}
    document=package.document; language=package.language
    roots={'flashcards':[],'practice':[],'reading':[]}
    def walk(nodes,section,parent=None,prefix=""):
        for index,node in enumerate(nodes):
            kind=node['kind']
            path=f'{prefix}.{index}' if prefix else str(index)
            if kind=='folder':
                if section=='flashcards':
                    name=node['title']; suffix=1
                    while Folder.objects.filter(owner=user,language=language,parent=parent,name=name).exists():
                        suffix+=1; name=node['title'][:85]+f' ({suffix})'
                    obj=Folder.objects.create(owner=user,language=language,parent=parent,name=name)
                elif section=='practice': obj=PracticeNode.objects.create(owner=user,language=language,parent=parent,kind='folder',title=node['title'],position=index)
                else: obj=ReadingFolder.objects.create(owner=user,language=language,parent=parent,title=node['title'])
                walk(node.get('children',[]),section,obj,path)
            elif kind=='deck':
                obj=Deck.objects.create(owner=user,language=language,folder=parent,title=node['title'],level=node.get('level','A2'),topic=node.get('topic',''),description=node.get('description',''))
                Card.objects.bulk_create([Card(deck=obj,position=i,**c) for i,c in enumerate(node['cards'])])
            elif kind=='reading':
                obj,_=ReadingLesson.objects.get_or_create(owner=user,language=language,source_key=f'system:{package.pk}:{path}',defaults={'folder':parent,'title':node['title'],'payload':node['payload'],'level':node.get('level',''),'topic':node.get('topic','')})
            else: obj=PracticeNode.objects.create(owner=user,language=language,parent=parent,kind=kind,title=node['title'],payload=node['payload'],position=index)
            if parent is None: roots[section].append({'kind':kind,'id':obj.pk,'title':node['title']})
    for section in roots: walk(document.get(section, []),section)
    result={'roots':roots,'counts':system_counts(package.counts)}
    PackageReceipt.objects.create(package=package,user=user,result=result)
    return result


@management('content.import')
@require_http_methods(['POST'])
@transaction.atomic
def upload(request):
    from .content_input import import_input
    document, options = import_input(request)
    return publish_document(request, document, **options)



@transaction.atomic
def publish_document(request, data, *, preview=False, confirm=None, preview_token=None, require_preview=False):
    try: document,counts=validate_document(data)
    except (AttributeError,RecursionError): raise ValueError('Invalid node structure.')
    digest=hashlib.sha256(json.dumps(document,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
    # Serializes identical package IDs across different importing staff.
    from django.db import connection
    if connection.vendor=='postgresql':
        with connection.cursor() as cursor: cursor.execute('SELECT pg_advisory_xact_lock(%s)',[uuid.UUID(document['id']).int % (2**63-1)])
    existing=SystemContentPackage.objects.filter(pk=document['id']).first()
    if existing and existing.digest != digest:
        # Older documents may omit newly optional metadata. Compare normalized
        # content, never require a new ID merely because defaults were added.
        previous, _ = validate_document(existing.document)
        previous_digest = hashlib.sha256(json.dumps(previous,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
        if previous_digest != digest:
            raise ValueError('This package ID already has different content. Use a new UUID for a new package.')
    from django.core import signing
    proof = {'digest': digest, 'id': document['id'], 'user': request.user.pk}
    if preview:
        return JsonResponse({'id':document['id'],'title':document['title'],'language':document['language'],'counts':counts,'already_published':bool(existing),'publisher':'Wortify','visibility':'public','preview_token':signing.dumps(proof,salt='content-preview'),'digest':digest})
    if require_preview and not existing:
        try:
            if signing.loads(preview_token or '',salt='content-preview',max_age=86400) != proof:
                raise ValueError('Preview token does not match this content or account. Preview again.')
        except signing.BadSignature:
            raise ValueError('Preview this exact content first. The preview token is valid for 24 hours.')
    if confirm!='IMPORT': raise ValueError('Preview the package before importing.')
    get_user_model().objects.select_for_update().get(pk=request.user.pk)
    package=existing or SystemContentPackage.objects.create(id=document['id'],title=document['title'],language=document['language'],digest=digest,document=document,counts=counts)
    result=materialize(package,request.user)
    publish_public(package)
    if not existing: audit(request,request.user,f'Published Wortify content package {package.pk}: {package.title}')
    return JsonResponse({'id':str(package.pk),'publisher':'Wortify','visibility':'public','digest':digest,**result},status=200 if existing else 201)


@endpoint
@require_http_methods(['GET'])
def library(request):
    rows=list(SystemContentPackage.objects.filter(language=request.language).order_by('-created_at').values('id','title','counts','created_at'))
    imported=set(PackageReceipt.objects.filter(user=request.user).values_list('package_id',flat=True))
    rows = [row for row in rows if any(row['counts'].get(k,0) for k in ('exercise','theory','reading','practice_folders','reading_folders','flashcards_folders','decks','cards'))]
    for row in rows: row.update(publisher='Wortify',imported=row['id'] in imported,counts=system_counts(row['counts']))
    return JsonResponse({'packages':rows})


@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def copy(request,pk):
    package=get_object_or_404(SystemContentPackage,pk=pk,language=request.language)
    get_user_model().objects.select_for_update().get(pk=request.user.pk)
    return JsonResponse(materialize(package,request.user))


def system_counts(counts):
    return {key: value for key, value in counts.items() if key in ('exercise','theory','reading','practice_folders','reading_folders','flashcards_folders','decks','cards')}


def publish_public(package):
    user,created=get_user_model().objects.get_or_create(username='wortify-publisher',defaults={'is_staff':True,'first_name':'Wortify'})
    if created:
        user.set_unusable_password();user.save(update_fields=['password'])
    if not user.is_staff or user.has_usable_password():raise ValueError('Reserved Wortify publisher account already exists.')
    get_user_model().objects.select_for_update().get(pk=user.pk)
    materialize(package,user)
    PracticeNode.objects.filter(owner=user).update(visibility='public')
    Deck.objects.filter(owner=user).update(visibility='public')
