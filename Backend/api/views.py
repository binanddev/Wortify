import uuid
from datetime import timedelta
from django.db import transaction
from django.db.models import Count, Q
from django.forms.models import model_to_dict
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from cards.models import Deck, Card, Folder, StudySettings, StudyProgress, StudyAttempt, ImportBatch, StudySession
from cards.forms import DeckForm, CardForm, FolderForm, SettingsForm
from cards.services.importing import parse_cards
from .common import body, endpoint

def form_save(form, **fields):
    if not form.is_valid():
        raise ValueError(form.errors.as_text())
    obj = form.save(commit=False)
    for key, value in fields.items():
        setattr(obj, key, value)
    obj.save()
    return obj

@endpoint
@require_http_methods(['GET', 'POST'])
def decks(request):
    if request.method == 'POST':
        if body(request).get('language', request.language) != request.language:
            raise ValueError('Language must match the current workspace.')
        deck = form_save(DeckForm({**body(request), 'language': request.language, 'visibility': body(request).get('visibility','private'), 'level': body(request).get('level','A1')}, user=request.user, language=request.language), owner=request.user)
        return JsonResponse({'id': deck.pk}, status=201)
    qs = Deck.objects.filter(owner=request.user, language=request.language)
    folders = list(Folder.objects.filter(owner=request.user, language=request.language).values('id','name','parent_id','archived'))
    hidden = {f['id'] for f in folders if f['archived']}
    while True:
        expanded = hidden | {f['id'] for f in folders if f['parent_id'] in hidden}
        if expanded == hidden:
            break
        hidden = expanded
    if request.GET.get('include_archived') != 'true':
        qs = qs.filter(archived=False).exclude(folder_id__in=hidden)
        folders = [f for f in folders if f['id'] not in hidden]
    if request.GET.get('language') in ['de', 'en']:
        qs = qs.filter(language=request.GET['language'])
    if request.GET.get('q'):
        qs = qs.filter(title__icontains=request.GET['q'][:100])
    rows = list(qs.annotate(count=Count('cards')).order_by('-updated_at').values('id','title','description','level','language','folder_id','count','archived','visibility','topic'))
    progress = StudyProgress.objects.filter(user=request.user, card__deck__language=request.language)
    per_deck = {p['card__deck_id']: p for p in progress.values('card__deck_id').annotate(mastered=Count('id', filter=Q(state='mastered')), due=Count('id', filter=Q(due_at__lte=timezone.now())|Q(state='weak')))}
    for row in rows:
        counts = per_deck.get(row['id'], {})
        row.update(mastered=counts.get('mastered',0), due=counts.get('due',0))
    candidates = list(StudySession.objects.filter(user=request.user,language=request.language,completed_at__isnull=True).order_by('-created_at'))
    visible_decks = Deck.objects.filter(owner=request.user, language=request.language, archived=False).exclude(folder_id__in=hidden)
    pending_tokens = set(str(token) for token in StudyAttempt.objects.filter(user=request.user, card__deck__in=visible_decks, completed_at__isnull=True, token__in=[token for session in candidates for token in session.tokens]).values_list('token', flat=True))
    recent = next((session for session in candidates if any(token in pending_tokens for token in session.tokens)), None)
    return JsonResponse({'decks':rows, 'folders':folders, 'due':progress.filter(due_at__lte=timezone.now()).count(), 'resume':str(recent.token) if recent else None})

@endpoint
@require_http_methods(['GET', 'PATCH', 'DELETE'])
@transaction.atomic
def deck(request, pk):
    if request.method != 'GET':
        from django.contrib.auth import get_user_model
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
    item = get_object_or_404(Deck, pk=pk, owner=request.user, language=request.language)
    if request.method == 'DELETE':
        item.delete()
        return JsonResponse({'ok': True})
    if request.method == 'PATCH':
        archived = body(request).get('archived', item.archived)
        if not isinstance(archived, bool):
            raise ValueError('archived must be a boolean.')
        if body(request).get('language', request.language) != request.language:
            raise ValueError('A deck cannot be moved to another language workspace.')
        item = form_save(DeckForm({**model_to_dict(item), **body(request), 'language': request.language}, instance=item, user=request.user, language=request.language))
        if item.archived != archived:
            item.archived = archived
            item.save(update_fields=['archived', 'updated_at'])
    from cards.models import DeckLearningState, LearningEvent
    from .learning_sync import state_payload
    state,_=DeckLearningState.objects.get_or_create(user=request.user,deck=item)
    preferences,_=StudySettings.objects.get_or_create(user=request.user,language=request.language)
    return JsonResponse({'difficult_cards':list(StudyProgress.objects.filter(user=request.user,card__deck=item).filter(Q(state='weak')|Q(memory__rating=2)).values_list('card_id',flat=True)), 'study_defaults':model_to_dict(preferences,exclude=['id','user','language']), 'learning':{**state_payload(state),'applied':[str(t) for t in LearningEvent.objects.filter(user=request.user,language=request.language,payload__deck=pk).order_by('-id').values_list('token',flat=True)[:100]]}, 'deck': model_to_dict(item, exclude=['owner']), 'cards': [model_to_dict(c) for c in item.cards.all()], 'folders': list(Folder.objects.filter(owner=request.user, language=request.language).values('id', 'name', 'parent_id'))})

@endpoint
@require_http_methods(['POST', 'PATCH', 'DELETE'])
def card(request, deck_id, pk=None):
    parent = get_object_or_404(Deck, pk=deck_id, owner=request.user, language=request.language)
    item = get_object_or_404(Card, pk=pk, deck=parent) if pk else None
    if request.method == 'DELETE':
        if item is None:
            raise ValueError('Not selected cards.')
        item.delete()
        return JsonResponse({'ok': True})
    data = model_to_dict(item) if item else {'position': parent.cards.count()}
    for key in ['accepted_answers', 'accepted_examples']:
        data[key] = '\n'.join(data.get(key, []))
    data.update(body(request))
    item = form_save(CardForm(data, instance=item), deck=parent)
    return JsonResponse({'id': item.pk})

@endpoint
@require_http_methods(['POST', 'PATCH', 'DELETE'])
@transaction.atomic
def folder(request, pk=None):
    # Serialize tree mutations for one owner to prevent concurrent cyclic moves.
    from django.contrib.auth import get_user_model
    get_user_model().objects.select_for_update().get(pk=request.user.pk)
    item = get_object_or_404(Folder, pk=pk, owner=request.user, language=request.language) if pk else None
    if request.method == 'DELETE':
        if not item:
            raise ValueError('No folder selected.')
        if request.GET.get('delete_contents') == 'true':
            tree = list(Folder.objects.filter(owner=request.user, language=request.language).values('id', 'parent_id'))
            ids = {item.pk}
            while True:
                expanded = ids | {f['id'] for f in tree if f['parent_id'] in ids}
                if expanded == ids:
                    break
                ids = expanded
            Deck.objects.filter(owner=request.user, language=request.language, folder_id__in=ids).delete()
            Folder.objects.filter(owner=request.user, language=request.language, pk__in=ids).delete()
        else:
            child_names = Folder.objects.filter(parent=item).values_list('name', flat=True)
            if Folder.objects.filter(owner=request.user, language=request.language, parent__isnull=True, name__in=child_names).exists():
                raise ValueError('A subfolder name already exists at the root. Rename it before deleting this folder.')
            item.delete()
        return JsonResponse({'ok': True})
    data = {**(model_to_dict(item) if item else {}), **body(request)}
    archived = data.get('archived', False)
    if not isinstance(archived, bool):
        raise ValueError('archived must be a boolean.')
    if Folder.objects.filter(owner=request.user, language=request.language, parent_id=data.get('parent') or None, name=data.get('name')).exclude(pk=pk).exists():
        raise ValueError('This folder already exists.')
    item = form_save(FolderForm(data, instance=item, user=request.user, language=request.language), owner=request.user, language=request.language, archived=archived)
    return JsonResponse({'id': item.pk})

@endpoint
@require_http_methods(['GET', 'PATCH'])
def preferences(request):
    item, _ = StudySettings.objects.get_or_create(user=request.user, language=request.language)
    if request.method == 'PATCH':
        item = form_save(SettingsForm({**model_to_dict(item), **body(request)}, instance=item))
    return JsonResponse(model_to_dict(item, exclude=['id', 'user']))

@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def import_cards(request, pk):
    parent = get_object_or_404(Deck, pk=pk, owner=request.user, language=request.language)
    data = body(request)
    if data.get('token'):
        batch = get_object_or_404(ImportBatch, token=uuid.UUID(data['token']), deck=parent)
        if batch.confirmed_at:
            return JsonResponse({'imported': len(batch.rows)})
        if batch.created_at < timezone.now() - timedelta(minutes=30):
            raise ValueError('The preview has expired. Import again.')
        claimed = ImportBatch.objects.filter(pk=batch.pk, confirmed_at__isnull=True).update(confirmed_at=timezone.now())
        if claimed:
            start = parent.cards.count()
            Card.objects.bulk_create([Card(deck=parent, position=start+i, **row) for i, row in enumerate(batch.rows)])
        return JsonResponse({'imported': len(batch.rows)})
    text = data.get('text', '')
    if not isinstance(text, str) or len(text) > 500000:
        raise ValueError('Content is too long.')
    rows = parse_cards(text, data.get('separator', ','))
    batch = ImportBatch.objects.create(deck=parent, rows=rows)
    return JsonResponse({'token': str(batch.token), 'count': len(rows), 'preview': rows[:10]})

@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def reorder_cards(request,pk):
    parent=get_object_or_404(Deck,pk=pk,owner=request.user,language=request.language)
    ids=body(request).get('ids')
    cards=list(parent.cards.select_for_update())
    if not isinstance(ids,list) or any(type(i) is not int for i in ids) or len(ids)!=len(cards) or set(ids)!={c.pk for c in cards}:
        raise ValueError('The order list must contain every card in the deck exactly once.')
    positions={pk:i for i,pk in enumerate(ids)}
    for card in cards:card.position=positions[card.pk]
    Card.objects.bulk_update(cards,['position'])
    return JsonResponse({'ok':True})

@endpoint
@require_http_methods(['GET'])
def study_pack(request):
    from cards.services.study import queue
    prefs, _ = StudySettings.objects.get_or_create(user=request.user, language=request.language)
    deck_id = request.GET.get('deck') or None
    if deck_id: get_object_or_404(Deck,pk=deck_id,owner=request.user,language=request.language)
    cards = queue(request.user,prefs,deck_id,request.GET.get('filter','all'),language=request.language)
    return JsonResponse({'cards':[model_to_dict(c) for c in cards], 'grading':{'ignore_case':prefs.ignore_case,'ignore_punctuation':prefs.ignore_punctuation,'transliteration':prefs.transliteration and request.language=='de'}})


@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def card_images(request, pk):
    from cards.image_links import IMAGE_FIELDS, validate_image_fields
    parent=get_object_or_404(Deck.objects.select_for_update(),pk=pk,owner=request.user,language=request.language)
    items=body(request).get('items')
    if not isinstance(items,list) or not 1<=len(items)<=50: raise ValueError('Select 1–50 card images.')
    cards={c.pk:c for c in parent.cards.select_for_update()}
    seen=set();updated=[]
    for item in items:
        if not isinstance(item,dict) or set(item)-({'id'}|set(IMAGE_FIELDS)) or type(item.get('id')) is not int or item['id'] in seen: raise ValueError('Invalid card image selection.')
        seen.add(item['id']);card=cards.get(item['id'])
        if not card: raise ValueError('Card not found in this deck.')
        if card.image_url: continue
        validate_image_fields(item)
        if not item.get('image_url'): raise ValueError('Choose an image link.')
        for field in IMAGE_FIELDS: setattr(card,field,item.get(field,''))
        card.save(update_fields=[*IMAGE_FIELDS,'updated_at']);updated.append(model_to_dict(card))
    return JsonResponse({'cards':updated,'skipped':len(items)-len(updated)})
