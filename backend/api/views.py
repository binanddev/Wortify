import uuid
from datetime import timedelta
from django.db import transaction
from django.db.models import Count, Q
from django.forms.models import model_to_dict
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from cards.models import Deck, Card, Folder, StudySettings, StudyProgress, StudyAttempt, ImportBatch, StudySession
from cards.forms import DeckForm, CardForm, FolderForm, SettingsForm
from cards.services.importing import parse_cards
from content.models import Book
from practice.models import Chapter, Exercise, Attempt, Notification
from learning.grading import grade
from .common import body, endpoint

@ensure_csrf_cookie
@require_http_methods(['GET'])
def shell(request, *args, **kwargs):
    from django.conf import settings
    from django.templatetags.static import static
    import json
    manifest_path=settings.REACT_DIST / '.vite' / 'manifest.json'
    if manifest_path.exists():
        manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
        entry=manifest['index.html']
        return render(request,'react.html',{'script':static('react/'+entry['file']),'styles':[static('react/'+p) for p in entry.get('css',[])]})
    return render(request, 'react_unbuilt.html', status=503)

def form_save(form, **fields):
    if not form.is_valid():
        raise ValueError(form.errors.as_text())
    obj = form.save(commit=False)
    for key, value in fields.items():
        setattr(obj, key, value)
    obj.save()
    return obj

@endpoint
@require_http_methods(['GET'])
def dashboard(request):
    progress = StudyProgress.objects.filter(user=request.user, card__deck__language=request.language)
    history = Attempt.objects.filter(user=request.user, exercise__chapter__book__language=request.language).select_related('exercise').order_by('-created_at')[:20]
    notifications = Notification.objects.filter(attempt__user=request.user, attempt__exercise__chapter__book__language=request.language).order_by('-created_at')[:20]
    return JsonResponse({'decks': Deck.objects.filter(owner=request.user, language=request.language).count(), 'cards': Card.objects.filter(deck__owner=request.user, deck__language=request.language).count(), 'due': progress.filter(due_at__lte=timezone.now()).count(), 'mastered': progress.filter(state='mastered').count(), 'reviews': StudyAttempt.objects.filter(user=request.user, card__deck__language=request.language, completed_at__isnull=False).count(), 'history': [{'id': a.pk, 'exercise': a.exercise.title, 'score': a.score, 'total': a.total, 'status': a.status, 'feedback': a.teacher_feedback} for a in history], 'notifications': [{'text': n.text, 'attempt': n.attempt_id} for n in notifications]})

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
    return JsonResponse({'deck': model_to_dict(item, exclude=['owner']), 'cards': [model_to_dict(c) for c in item.cards.all()], 'folders': list(Folder.objects.filter(owner=request.user, language=request.language).values('id', 'name'))})

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

def published():
    return Exercise.objects.filter(reviewed=True).exclude(decision='SKIP')

@endpoint
@require_http_methods(['GET'])
def books(request):
    return JsonResponse({'books': list(Book.objects.filter(language=request.language, chapters__isnull=False).distinct().values('id','slug','title','author','description'))})

@endpoint
@require_http_methods(['GET'])
def book(request, slug):
    item = get_object_or_404(Book, slug=slug, language=request.language)
    from django.db.models import Count
    from practice.models import ChapterProgress
    checked=set(ChapterProgress.objects.filter(user=request.user,chapter__book=item,completed=True).values_list('chapter_id',flat=True))
    counts=dict(published().filter(chapter__book=item).values('chapter_id').annotate(n=Count('id')).values_list('chapter_id','n'))
    return JsonResponse({'book': model_to_dict(item,exclude=['source_directory']), 'chapters': [{'id':c.pk,'number':c.number,'title':c.title,'count':counts.get(c.pk,0),'completed':c.pk in checked} for c in item.chapters.all()]})

@endpoint
@require_http_methods(['GET'])
def lesson(request, slug, pk):
    chapter = get_object_or_404(Chapter, pk=pk, book__slug=slug, book__language=request.language)
    latest={}
    for attempt in Attempt.objects.filter(user=request.user,exercise__chapter=chapter).order_by('-created_at').values('exercise_id','score','total','status'):
        latest.setdefault(attempt['exercise_id'],attempt)
    return JsonResponse({'chapter':model_to_dict(chapter,exclude=['source_document']), 'book':{'slug':chapter.book.slug,'title':chapter.book.title},'assets':asset_map(chapter.book),'exercises':[{**e,'type':e.pop('presentation',{}).get('type','text'),'attempt':latest.get(e['id'])} for e in published().filter(chapter=chapter).values('id','number','title','kind','check_mode','objective','presentation')]})

@endpoint
@require_http_methods(['POST'])
def chapter_progress(request,slug,pk):
    from practice.models import ChapterProgress
    chapter=get_object_or_404(Chapter,pk=pk,book__slug=slug,book__language=request.language)
    completed=body(request).get('completed')
    if type(completed) is not bool:raise ValueError('completed phải là true hoặc false.')
    ChapterProgress.objects.update_or_create(user=request.user,chapter=chapter,defaults={'completed':completed})
    return JsonResponse({'completed':completed})

@endpoint
@require_http_methods(['GET', 'POST'])
def exercise(request, slug, pk):
    item = get_object_or_404(published().select_related('chapter__book'), pk=pk, chapter__book__slug=slug, chapter__book__language=request.language)
    if request.method == 'GET':
        questions = [{'id': q.pk, 'position': q.position, 'kind': q.kind, 'prompt': q.prompt, 'options': q.options, 'blank_count': len(q.blanks), 'example': q.example, 'presentation': q.presentation, 'sample': q.accepted_answers if q.example else []} for q in item.questions.all()]
        return JsonResponse({'exercise': {**model_to_dict(item, exclude=['reviewed','source_document','import_warnings']), 'language': item.chapter.book.language, 'resources': public_resources(item)}, 'questions': questions, 'token': str(uuid.uuid4()), 'assets': asset_map(item.chapter.book), 'next':published().filter(chapter=item.chapter,id__gt=item.id).values('id','title').first()})
    data = body(request)
    token = uuid.UUID(data.get('token', ''))
    existing = Attempt.objects.filter(token=token).first()
    if existing:
        if existing.user_id != request.user.pk or existing.exercise_id != pk:
            raise ValueError('Lượt nộp không hợp lệ.')
        return JsonResponse({'id': existing.pk})
    answers = grade(item, data.get('answers', {}))
    auto = item.check_mode == 'auto_check'
    # Unique token makes retries idempotent, including concurrent submissions.
    attempt, created = Attempt.objects.get_or_create(token=token, defaults={'user': request.user, 'exercise': item, 'session_key': request.session.session_key or '', 'answers': answers, 'score': sum(a['correct'] for a in answers) if auto else None, 'total': len(answers), 'status': 'graded' if auto else 'pending_manual'})
    if attempt.user_id != request.user.pk or attempt.exercise_id != pk:
        raise ValueError('Lượt nộp không hợp lệ.')
    return JsonResponse({'id': attempt.pk}, status=201 if created else 200)

@endpoint
@require_http_methods(['GET', 'POST'])
def result(request, pk):
    item = get_object_or_404(Attempt, pk=pk, user=request.user, exercise__chapter__book__language=request.language)
    if request.method == 'POST':
        from django.conf import settings
        if not settings.COMMUNITY_ENABLED:return JsonResponse({'error':'Gửi bài chấm đang tạm ngắt.'},status=503)
        if not item.exercise.allow_review:
            raise ValueError('Bài này không hỗ trợ yêu cầu xem lại.')
        if item.status == 'graded':
            item.status = 'pending_manual'
            item.save(update_fields=['status'])
    return JsonResponse({'id': item.pk, 'title': item.exercise.title, 'status': item.status, 'score': item.score, 'total': item.total, 'answers': item.answers, 'feedback': item.teacher_feedback, 'manual': item.exercise.check_mode != 'auto_check', 'review': {'id':item.peer_review.pk,'reviewer':item.peer_review.reviewer.username,'score':str(item.peer_review.score) if item.peer_review.score is not None else None} if hasattr(item,'peer_review') else None, 'allow_review': item.exercise.allow_review, 'book': item.exercise.chapter.book.slug, 'chapter': item.exercise.chapter_id})


def public_resources(item):
    from content.importing import resources
    return resources(item.source_document)

def asset_map(book):
    return {a.key: {'url': f'/api/{book.language}/book-assets/{a.pk}/', 'description': a.description} for a in book.assets.all()}

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
