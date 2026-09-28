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
            raise ValueError('Ngôn ngữ phải khớp không gian hiện tại.')
        deck = form_save(DeckForm({**body(request), 'language': request.language, 'level': body(request).get('level','A1')}, user=request.user, language=request.language), owner=request.user)
        return JsonResponse({'id': deck.pk}, status=201)
    qs = Deck.objects.filter(owner=request.user, language=request.language)
    if request.GET.get('language') in ['de', 'en']:
        qs = qs.filter(language=request.GET['language'])
    if request.GET.get('q'):
        qs = qs.filter(title__icontains=request.GET['q'][:100])
    rows = list(qs.annotate(count=Count('cards')).order_by('-updated_at').values('id','title','description','level','language','folder_id','count'))
    progress = StudyProgress.objects.filter(user=request.user, card__deck__language=request.language)
    per_deck = {p['card__deck_id']: p for p in progress.values('card__deck_id').annotate(mastered=Count('id', filter=Q(state='mastered')), due=Count('id', filter=Q(due_at__lte=timezone.now())|Q(state='weak')))}
    for row in rows:
        counts = per_deck.get(row['id'], {})
        row.update(mastered=counts.get('mastered',0), due=counts.get('due',0))
    recent = StudySession.objects.filter(user=request.user,language=request.language,completed_at__isnull=True).order_by('-created_at').first()
    return JsonResponse({'decks':rows, 'folders':list(Folder.objects.filter(owner=request.user,language=request.language).values('id','name')), 'due':progress.filter(due_at__lte=timezone.now()).count(), 'resume':str(recent.token) if recent else None})

@endpoint
@require_http_methods(['GET', 'PATCH', 'DELETE'])
def deck(request, pk):
    item = get_object_or_404(Deck, pk=pk, owner=request.user, language=request.language)
    if request.method == 'DELETE':
        item.delete()
        return JsonResponse({'ok': True})
    if request.method == 'PATCH':
        if body(request).get('language', request.language) != request.language:
            raise ValueError('Không thể chuyển bộ thẻ sang không gian ngôn ngữ khác.')
        item = form_save(DeckForm({**model_to_dict(item), **body(request), 'language': request.language}, instance=item, user=request.user, language=request.language))
    from cards.models import DeckLearningState, LearningEvent
    from .learning_sync import state_payload
    state,_=DeckLearningState.objects.get_or_create(user=request.user,deck=item)
    preferences,_=StudySettings.objects.get_or_create(user=request.user,language=request.language)
    return JsonResponse({'study_defaults':model_to_dict(preferences,exclude=['id','user','language']), 'learning':{**state_payload(state),'applied':[str(t) for t in LearningEvent.objects.filter(user=request.user,language=request.language,payload__deck=pk).order_by('-id').values_list('token',flat=True)[:100]]}, 'deck': model_to_dict(item, exclude=['owner']), 'cards': [model_to_dict(c) for c in item.cards.all()], 'folders': list(Folder.objects.filter(owner=request.user, language=request.language).values('id', 'name'))})

@endpoint
@require_http_methods(['POST', 'PATCH', 'DELETE'])
def card(request, deck_id, pk=None):
    parent = get_object_or_404(Deck, pk=deck_id, owner=request.user, language=request.language)
    item = get_object_or_404(Card, pk=pk, deck=parent) if pk else None
    if request.method == 'DELETE':
        if item is None:
            raise ValueError('Chưa chọn thẻ.')
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
def folder(request, pk=None):
    item = get_object_or_404(Folder, pk=pk, owner=request.user, language=request.language) if pk else None
    if request.method == 'DELETE':
        if not item:
            raise ValueError('Chưa chọn thư mục.')
        item.delete()
        return JsonResponse({'ok': True})
    data = body(request)
    if Folder.objects.filter(owner=request.user, language=request.language, name=data.get('name')).exclude(pk=pk).exists():
        raise ValueError('Thư mục đã tồn tại.')
    item = form_save(FolderForm(data, instance=item), owner=request.user, language=request.language)
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
            raise ValueError('Bản xem trước hết hạn. Hãy nhập lại.')
        claimed = ImportBatch.objects.filter(pk=batch.pk, confirmed_at__isnull=True).update(confirmed_at=timezone.now())
        if claimed:
            start = parent.cards.count()
            Card.objects.bulk_create([Card(deck=parent, position=start+i, **row) for i, row in enumerate(batch.rows)])
        return JsonResponse({'imported': len(batch.rows)})
    text = data.get('text', '')
    if not isinstance(text, str) or len(text) > 500000:
        raise ValueError('Nội dung quá dài.')
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
        raise ValueError('Danh sách thứ tự phải chứa mỗi thẻ trong bộ đúng một lần.')
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
