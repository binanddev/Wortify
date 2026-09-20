import csv
import hashlib
import io
import json
import random
import uuid
from datetime import timedelta
from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import UserCreationForm
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Q
from django.http import JsonResponse, HttpResponse, FileResponse, Http404
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST
from .models import Deck, Card, StudySettings, StudyProgress, StudyAttempt, CardAudio, Folder, ImportBatch, MatchRound
from .services.exercises import sentence_items, create_match, match_payload, submit_match
from .forms import DeckForm, CardForm, SettingsForm, FolderForm, TextImportForm
from .services import study
from .services.comparison import compare
from .services.speech import SpeechError, SpeechToTextService, TextToSpeechService
from .services.audio_validation import validate_audio


def preferences(user, language='de'):
    return StudySettings.objects.get_or_create(user=user, language=language)[0]


def signup(request):
    form = UserCreationForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        login(request, form.save())
        return redirect('home')
    return render(request, 'cards/form.html', {'form': form, 'title': 'Tạo tài khoản'})


@login_required
def home(request):
    progress = StudyProgress.objects.filter(user=request.user)
    stats = {'Đến hạn': progress.filter(due_at__lte=timezone.now()).count(),
             'Đã học hôm nay': StudyAttempt.objects.filter(user=request.user, completed_at__date=timezone.localdate()).values('card_id').distinct().count(),
             'Đang học': progress.filter(state='learning').count(), 'Đã nhớ': progress.filter(state='mastered').count(),
             'Thẻ khó': progress.filter(state='weak').count()}
    decks = Deck.objects.filter(owner=request.user).select_related('folder').annotate(card_count=Count('cards')).order_by('-updated_at')
    query = request.GET.get('q', '').strip()[:200]
    if query:
        decks = decks.filter(Q(title__icontains=query) | Q(topic__icontains=query) | Q(description__icontains=query))
    folder = None
    selected = request.GET.get('folder', '')
    if selected == 'none':
        decks = decks.filter(folder__isnull=True)
    elif selected:
        if not selected.isdigit():
            raise Http404
        folder = get_object_or_404(Folder, pk=selected, owner=request.user)
        decks = decks.filter(folder=folder)
    return render(request, 'cards/home.html', {'decks': decks, 'stats': stats, 'folder': folder, 'selected_folder': selected, 'query': query,
        'folders': Folder.objects.filter(owner=request.user).annotate(deck_count=Count('decks'))})


@login_required
def folder_edit(request, pk=None):
    folder = get_object_or_404(Folder, pk=pk, owner=request.user) if pk else Folder(owner=request.user)
    form = FolderForm(request.POST or None, instance=folder)
    if request.method == 'POST' and form.is_valid():
        if Folder.objects.filter(owner=request.user, name=form.cleaned_data['name']).exclude(pk=folder.pk).exists():
            form.add_error('name', 'Bạn đã có thư mục cùng tên.')
        else:
            form.save()
            return redirect('/?folder=' + str(folder.pk))
    return render(request, 'cards/form.html', {'form': form, 'title': 'Sửa thư mục' if pk else 'Tạo thư mục'})


@login_required
@require_POST
def folder_delete(request, pk):
    get_object_or_404(Folder, pk=pk, owner=request.user).delete()
    messages.success(request, 'Đã xóa thư mục. Các bộ thẻ vẫn được giữ trong thư viện.')
    return redirect('home')


@login_required
def statistics(request):
    from django.db.models.functions import TruncDate
    today = timezone.localdate()
    attempts = StudyAttempt.objects.filter(user=request.user, completed_at__isnull=False)
    grouped = {row['day']: row['total'] for row in attempts.filter(completed_at__date__gte=today-timedelta(days=6)).annotate(day=TruncDate('completed_at')).values('day').annotate(total=Count('id'))}
    days = [{'day': today-timedelta(days=n), 'count': grouped.get(today-timedelta(days=n), 0)} for n in range(6, -1, -1)]
    peak = max([day['count'] for day in days] + [1])
    for day in days:
        day['height'] = round(100 * day['count'] / peak)
    progress = StudyProgress.objects.filter(user=request.user)
    total, correct = attempts.count(), attempts.filter(is_correct=True).count()
    return render(request, 'cards/statistics.html', {
        'days': days, 'total': total, 'correct': correct, 'accuracy': round(100*correct/total) if total else 0,
        'due': progress.filter(due_at__lte=timezone.now()).count(),
        'learning': progress.filter(state='learning').count(), 'mastered': progress.filter(state='mastered').count(),
        'weak': progress.filter(state='weak').select_related('card', 'card__deck').order_by('-incorrect_count')[:20],
    })


@login_required
def deck_edit(request, pk=None):
    deck = get_object_or_404(Deck, pk=pk, owner=request.user) if pk else Deck(owner=request.user)
    form = DeckForm(request.POST or None, instance=deck, user=request.user)
    if request.method == 'POST' and form.is_valid():
        form.save()
        return redirect('deck', pk=deck.pk)
    return render(request, 'cards/form.html', {'form': form, 'title': 'Sửa bộ thẻ' if pk else 'Tạo bộ thẻ'})


@login_required
def deck_detail(request, pk):
    deck = get_object_or_404(Deck, pk=pk, owner=request.user)
    review_cards = study.queue(request.user, preferences(request.user, getattr(request, 'language', 'de')), deck.pk, 'review')
    return render(request, 'cards/deck.html', {'deck': deck, 'review_count': len(review_cards),
        'folders': Folder.objects.filter(owner=request.user)})


@login_required
def deck_review(request, pk):
    deck = get_object_or_404(Deck, pk=pk, owner=request.user)
    cards = study.queue(request.user, preferences(request.user, getattr(request, 'language', 'de')), deck.pk, 'review')
    return render(request, 'cards/review.html', {'deck': deck, 'cards': cards})


@login_required
@require_POST
def deck_move(request, pk):
    deck = get_object_or_404(Deck, pk=pk, owner=request.user)
    destination = request.POST.get('folder', '')
    if destination and not destination.isdigit():
        raise Http404
    deck.folder = get_object_or_404(Folder, pk=destination, owner=request.user) if destination else None
    deck.save(update_fields=['folder', 'updated_at'])
    messages.success(request, f'Đã chuyển “{deck.title}” vào {deck.folder.name}.' if deck.folder else f'Đã đưa “{deck.title}” ra ngoài thư mục.')
    return redirect('home' if request.POST.get('source') == 'home' else 'deck', **({} if request.POST.get('source') == 'home' else {'pk': deck.pk}))


@login_required
def card_edit(request, deck_id, pk=None):
    deck = get_object_or_404(Deck, pk=deck_id, owner=request.user)
    card = get_object_or_404(Card, pk=pk, deck=deck) if pk else Card(deck=deck, position=deck.cards.count())
    form = CardForm(request.POST or None, instance=card)
    if request.method == 'POST' and form.is_valid():
        form.save()
        return redirect('deck', pk=deck.pk)
    return render(request, 'cards/form.html', {'form': form, 'title': 'Sửa thẻ' if pk else 'Thêm thẻ'})


@login_required
@require_POST
def delete(request, kind, pk):
    if kind == 'deck':
        get_object_or_404(Deck, pk=pk, owner=request.user).delete()
        return redirect('home')
    card = get_object_or_404(Card, pk=pk, deck__owner=request.user)
    deck_id = card.deck_id
    card.delete()
    return redirect('deck', pk=deck_id)


@login_required
@require_POST
def reorder(request, pk):
    card = get_object_or_404(Card, pk=pk, deck__owner=request.user)
    cards = list(card.deck.cards.all())
    index = cards.index(card)
    dest = max(0, min(len(cards)-1, index + (-1 if request.POST.get('direction') == 'up' else 1)))
    cards[index], cards[dest] = cards[dest], cards[index]
    with transaction.atomic():
        for pos, item in enumerate(cards):
            item.position = pos
        Card.objects.bulk_update(cards, ['position'])
    return redirect('deck', pk=card.deck_id)


CSV_FIELDS = ['german_text', 'vietnamese_meaning', 'example_german', 'example_vietnamese', 'part_of_speech', 'article', 'plural_form', 'notes', 'usage', 'accepted_answers', 'accepted_examples', 'position']


@login_required
def export_deck(request, pk, fmt):
    if fmt not in ('json', 'csv'):
        raise Http404
    deck = get_object_or_404(Deck, pk=pk, owner=request.user)
    rows = list(deck.cards.values(*CSV_FIELDS))
    if fmt == 'json':
        response = HttpResponse(json.dumps(rows, ensure_ascii=False, indent=2), content_type='application/json')
    else:
        stream = io.StringIO()
        writer = csv.DictWriter(stream, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            for key in ('accepted_answers', 'accepted_examples'):
                row[key] = json.dumps(row[key], ensure_ascii=False)
            # Prevent spreadsheet formula execution when opening an export.
            row = {k: "'" + v if isinstance(v, str) and v.lstrip().startswith(('=', '+', '-', '@')) else v for k, v in row.items()}
            writer.writerow(row)
        response = HttpResponse('\ufeff' + stream.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="deck-{pk}.{fmt}"'
    return response


@login_required
def import_deck(request, pk):
    deck = get_object_or_404(Deck, pk=pk, owner=request.user)
    form = TextImportForm(request.POST or None)
    batch = None
    if request.method == 'POST' and request.POST.get('token'):
        try:
            token = uuid.UUID(request.POST['token'])
        except ValueError:
            raise Http404
        with transaction.atomic():
            batch = get_object_or_404(ImportBatch.objects.select_for_update(), token=token, deck=deck)
            if batch.confirmed_at:
                messages.info(request, 'Lần nhập này đã được lưu trước đó.')
            elif batch.created_at < timezone.now() - timedelta(minutes=30):
                messages.error(request, 'Bản xem trước đã hết hạn. Hãy dán nội dung và xem trước lại.')
            else:
                now = timezone.now()
                claimed = ImportBatch.objects.filter(pk=batch.pk, confirmed_at__isnull=True).update(confirmed_at=now)
                if claimed:
                    from django.db.models import Max
                    position = (deck.cards.aggregate(last=Max('position'))['last'] or 0) + 1
                    Card.objects.bulk_create([Card(deck=deck, position=position+i, **row) for i, row in enumerate(batch.rows)])
                    messages.success(request, f'Đã thêm {len(batch.rows)} thẻ.')
                    ImportBatch.objects.filter(pk=batch.pk).update(rows=[])
        return redirect('deck', pk=pk)
    if request.method == 'POST' and form.is_valid():
        ImportBatch.objects.filter(deck__owner=request.user, created_at__lt=timezone.now()-timedelta(minutes=30)).delete()
        batch = ImportBatch.objects.create(deck=deck, rows=form.cleaned_data['rows'])
    return render(request, 'cards/import.html', {'deck': deck, 'form': form, 'batch': batch})

@login_required
def study_settings(request):
    form = SettingsForm(request.POST or None, instance=preferences(request.user, getattr(request, 'language', 'de')))
    if request.method == 'POST' and form.is_valid():
        form.save()
        messages.success(request, 'Đã lưu cài đặt học.')
        return redirect('home')
    return render(request, 'cards/form.html', {'form': form, 'title': 'Cài đặt học tập'})


@login_required
def study_page(request):
    prefs = preferences(request.user, getattr(request, 'language', 'de'))
    stt_ready = bool(settings.STT_PROVIDER and (settings.STT_PROVIDER != 'openai' or settings.SPEECH_API_KEY))
    return render(request, 'cards/study.html', {'config': {'autoplay': prefs.autoplay, 'session_minutes': prefs.session_minutes, 'max_seconds': settings.RECORDING_MAX_SECONDS, 'max_bytes': settings.RECORDING_MAX_BYTES, 'stt_ready': stt_ready}})


def card_data(card):
    return {key: getattr(card, key) for key in CSV_FIELDS if key not in ('accepted_answers', 'accepted_examples', 'position')}


def question_payload(attempt, total=None):
    payload = {'token': str(attempt.token), 'mode': attempt.mode, 'total': total,
               'options': attempt.question['options'], 'target_type': attempt.question['target_type'], 'language': attempt.card.deck.language,
               'audio_url': f'/api/{attempt.card.deck.language}/audio/{attempt.token}/', 'completed': bool(attempt.completed_at)}
    if attempt.mode not in ('spell', 'write', 'order'):
        payload['card'] = attempt.question.get('card', card_data(attempt.card))
        payload['target'] = attempt.question['target']
    if attempt.mode == 'write':
        payload['prompt'] = attempt.question['meaning']
    if attempt.mode == 'order':
        payload['prompt'] = attempt.question.get('hint', '')
        payload['items'] = attempt.question['items']
    if attempt.completed_at:
        payload['result'] = attempt.result
    payload['stt_ready'] = bool(settings.STT_PROVIDER and (settings.STT_PROVIDER != 'openai' or settings.SPEECH_API_KEY))
    payload['processing'] = bool(attempt.processing_started_at and not attempt.completed_at)
    return payload


@login_required
def resume_question(request, token):
    attempt = get_object_or_404(StudyAttempt.objects.select_related('card'), token=token, user=request.user, abandoned=False)
    return JsonResponse(question_payload(attempt))


@login_required
@require_POST
def next_question(request):
    mode = request.POST.get('mode', 'flash')
    if mode not in ('flash', 'quiz', 'spell', 'speak', 'learn', 'write', 'order'):
        return JsonResponse({'error': 'Chế độ học không hợp lệ.'}, status=400)
    prefs = preferences(request.user, getattr(request, 'language', 'de'))
    deck_id = request.POST.get('deck')
    if deck_id:
        if not deck_id.isdigit():
            return JsonResponse({'error': 'Bộ thẻ không hợp lệ.'}, status=400)
        get_object_or_404(Deck, pk=deck_id, owner=request.user)
    cards = study.queue(request.user, prefs, deck_id, request.POST.get('filter', 'all'), mode == 'learn', language=getattr(request, 'language', 'de'))
    if mode == 'order':
        cards = [card for card in cards if 2 <= len(card.example_german.split()) <= 40]
    if not cards:
        message = 'Chưa có câu phù hợp. Hãy thêm ví dụ tiếng Đức dài từ 2 đến 40 từ, hoặc đổi bộ lọc.' if mode == 'order' else 'Đã hoàn thành các thẻ phù hợp. Bạn có thể chọn bộ thẻ khác hoặc quay lại khi đến hạn ôn.'
        return JsonResponse({'done': True, 'message': message})
    if request.POST.get('shuffle') == '1' and mode != 'learn':
        seed = request.POST.get('seed', '')[:100]
        cards.sort(key=lambda card: hashlib.sha256(f'{seed}:{card.pk}'.encode()).digest())
    try:
        index = max(0, int(request.POST.get('index', 0)))
    except ValueError:
        index = 0
    card = cards[0] if mode == 'learn' else cards[index % len(cards)]
    learn_modes = ['flash', 'quiz', 'spell', 'write']
    if 2 <= len(card.example_german.split()) <= 40:
        learn_modes.append('order')
    if settings.STT_PROVIDER and (settings.STT_PROVIDER != 'openai' or settings.SPEECH_API_KEY):
        learn_modes.append('speak')
    actual_mode = random.choice(learn_modes) if mode == 'learn' else mode
    target_type = 'example' if request.POST.get('target') == 'example' and card.example_german else 'term'
    if actual_mode == 'order':
        target_type = 'example'
    if actual_mode in ('flash', 'quiz', 'write'):
        target_type = 'term'
    # Reuse the unanswered server-issued question after reload.
    attempt = StudyAttempt.objects.filter(user=request.user, card=card, abandoned=False, completed_at__isnull=True,
                                         mode=actual_mode, question__target_type=target_type).order_by('-created_at').first()
    if not attempt:
        target = card.example_german if target_type == 'example' else card.german_text
        options = []
        if actual_mode == 'quiz':
            try:
                options = study.choices(card)
            except ValueError as exc:
                if mode != 'learn':
                    return JsonResponse({'error': str(exc)}, status=400)
                actual_mode = 'flash'
        question = {'target': target, 'target_type': target_type, 'alternatives': card.accepted_examples if target_type == 'example' else card.accepted_answers,
                    'options': options, 'meaning': card.vietnamese_meaning, 'card': card_data(card),
                    'grading': {'ignore_case': prefs.ignore_case, 'ignore_punctuation': prefs.ignore_punctuation, 'transliteration': prefs.transliteration and card.deck.language == 'de'}}
        if actual_mode == 'order':
            question.update(items=sentence_items(target), hint=card.example_vietnamese or card.vietnamese_meaning)
        attempt = StudyAttempt.objects.create(user=request.user, card=card, mode=actual_mode, question=question)
    return JsonResponse(question_payload(attempt, len(cards)))


@login_required
@require_POST
def submit(request, token):
    attempt = get_object_or_404(StudyAttempt.objects.select_related('card'), token=token, user=request.user)
    if attempt.completed_at:
        return JsonResponse(attempt.result)
    if attempt.abandoned:
        return JsonResponse({'error': 'Lượt học đã kết thúc.'}, status=409)
    answer = request.POST.get('answer', '')
    if len(answer) > 4000 or len(answer.split()) > 500:
        return JsonResponse({'error': 'Câu trả lời quá dài.'}, status=400)
    if attempt.mode == 'quiz':
        if answer not in attempt.question['options']:
            return JsonResponse({'error': 'Hãy chọn một đáp án.'}, status=400)
        result = {'is_correct': answer == attempt.question['meaning']}
    elif attempt.mode == 'flash':
        if answer not in ('remember', 'again'):
            return JsonResponse({'error': 'Hãy chọn mức độ nhớ.'}, status=400)
        result = {'is_correct': answer == 'remember'}
    elif attempt.mode == 'order':
        try:
            ids = json.loads(answer)
            items = {item['id']: item['text'] for item in attempt.question['items']}
            if not isinstance(ids, list) or len(ids) != len(items) or any(not isinstance(i, str) for i in ids) or set(ids) != set(items):
                raise ValueError
            answer = ' '.join(items[i] for i in ids)
        except (ValueError, TypeError):
            return JsonResponse({'error': 'Hãy sử dụng đủ các từ để tạo thành câu.'}, status=400)
        result = compare(attempt.question['target'], answer, attempt.question['alternatives'], **attempt.question['grading'])
    elif attempt.mode in ('spell', 'write'):
        result = compare(attempt.question['target'], answer, attempt.question['alternatives'], **attempt.question['grading'])
    else:
        return JsonResponse({'error': 'Hãy gửi bản thu để kiểm tra.'}, status=400)
    result['card'] = attempt.question.get('card', card_data(attempt.card))
    result['target'] = attempt.question['target']
    elapsed = min(7200000, max(0, int((timezone.now() - attempt.created_at).total_seconds() * 1000)))
    return JsonResponse(study.finish(attempt, answer, result, elapsed))


@login_required
@require_POST
def audio(request, token):
    attempt = get_object_or_404(StudyAttempt.objects.select_related('card'), token=token, user=request.user)
    audio_type = request.POST.get('type', attempt.question['target_type'])
    if audio_type not in ('term', 'example'):
        return JsonResponse({'error': 'Nội dung nghe không hợp lệ.'}, status=400)
    snapshot = attempt.question.get('card', card_data(attempt.card))
    text = snapshot['example_german'] if audio_type == 'example' else snapshot['german_text']
    if not text:
        return JsonResponse({'error': 'Thẻ chưa có câu ví dụ.'}, status=400)
    speed = .7 if request.POST.get('slow') == '1' else 1
    if not settings.TTS_PROVIDER:
        return JsonResponse({'fallback': True, 'text': text, 'speed': speed, 'message': 'Đang dùng giọng máy của trình duyệt.'})
    try:
        obj = TextToSpeechService().audio(attempt.card, audio_type, text, speed)
        return JsonResponse({'url': f'/api/{attempt.card.deck.language}/audio-file/{obj.pk}/'})
    except SpeechError as exc:
        return JsonResponse({'fallback': True, 'text': text, 'speed': speed, 'message': str(exc) + ' Đang dùng giọng trình duyệt.'})


@login_required
def tts_file(request, pk):
    obj = get_object_or_404(CardAudio, pk=pk, card__deck__owner=request.user)
    return private_file(obj.audio_file, 'audio/mpeg')


@login_required
@require_POST
def card_audio(request, pk):
    card = get_object_or_404(Card, pk=pk, deck__owner=request.user)
    kind = request.POST.get('type', 'term')
    text = card.example_german if kind == 'example' else card.german_text
    if not text:
        return JsonResponse({'error': 'Thẻ chưa có câu ví dụ.'}, status=400)
    if settings.TTS_PROVIDER:
        try:
            audio = TextToSpeechService().audio(card, kind, text, 1)
            return JsonResponse({'url': f'/api/{card.deck.language}/audio-file/{audio.pk}/'})
        except SpeechError:
            pass
    return JsonResponse({'fallback': True, 'text': text, 'speed': 1, 'message': 'Đang dùng giọng máy của trình duyệt.'})


def private_file(field, mime):
    try:
        response = FileResponse(field.open('rb'), content_type=mime)
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
    except FileNotFoundError:
        return HttpResponse('Bản thu không còn được lưu.', status=404)


@login_required
@require_POST
def speaking_check(request, token):
    attempt = get_object_or_404(StudyAttempt.objects.select_related('card'), token=token, user=request.user, mode='speak')
    if attempt.completed_at:
        return JsonResponse({'status': 'done', 'result': attempt.result, 'ephemeral': True})
    if attempt.abandoned:
        return JsonResponse({'error': 'Lượt học đã kết thúc. Hãy thu lại trong lượt mới.'}, status=409)
    if request.POST.get('consent') != 'yes':
        return JsonResponse({'error': 'Hãy đồng ý gửi âm thanh tạm thời đến dịch vụ nhận dạng.'}, status=400)
    upload = request.FILES.get('audio')
    if not upload:
        return JsonResponse({'error': 'Chưa có âm thanh.'}, status=400)
    claimed = False
    try:
        data, ext, mime, duration = validate_audio(upload)
        now = timezone.now()
        StudyAttempt.objects.filter(pk=attempt.pk, processing_started_at__lt=now-timedelta(seconds=settings.SPEECH_TIMEOUT+60)).update(processing_started_at=None)
        claimed = StudyAttempt.objects.filter(pk=attempt.pk, completed_at__isnull=True, abandoned=False, processing_started_at__isnull=True).update(processing_started_at=now)
        if not claimed:
            return JsonResponse({'error': 'Lượt kiểm tra đang được xử lý hoặc đã hoàn thành. Hãy tải lại trạng thái.'}, status=409)
        response = SpeechToTextService().transcribe(data, uuid.uuid4().hex+'.'+ext, mime, language=attempt.card.deck.language)
        transcript = response.get('transcript', '').strip()
        if not transcript:
            raise SpeechError('Không phát hiện giọng nói. Hãy thu lại rõ hơn.')
        if len(transcript) > 4000 or len(transcript.split()) > 500:
            raise SpeechError('Nội dung quá dài. Hãy thu một đoạn ngắn hơn.')
        confidence = response.get('confidence')
        if confidence is not None and (not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1):
            raise SpeechError('Dịch vụ nhận dạng chưa trả về kết quả hợp lệ.')
        uncertain = response.get('uncertain', False) or (confidence is not None and confidence < .6)
        result = compare(attempt.question['target'], transcript, attempt.question['alternatives'], ignore_case=True, ignore_punctuation=True, transliteration=attempt.question['grading']['transliteration'])
        result.update({'uncertain': uncertain, 'confidence': confidence, 'card': attempt.question.get('card', card_data(attempt.card))})
        if not uncertain:
            study.finish(attempt, '', {'is_correct': result['is_correct'], 'ephemeral': True}, duration)
        response = JsonResponse({'status': 'uncertain' if uncertain else 'done', 'result': result, 'ephemeral': True})
        response['Cache-Control'] = 'no-store'
        return response
    except (SpeechError, TimeoutError) as exc:
        return JsonResponse({'status': 'error', 'error': str(exc) if isinstance(exc, SpeechError) else 'Dịch vụ mất quá nhiều thời gian. Hãy thử lại.'}, status=200 if claimed else 400)
    except Exception:
        return JsonResponse({'status': 'error', 'error': 'Không xử lý được âm thanh. Vui lòng thử lại.'})
    finally:
        if claimed:
            StudyAttempt.objects.filter(pk=attempt.pk).update(processing_started_at=None)
        upload.close()

@login_required
@require_POST
def retry(request, token):
    attempt = get_object_or_404(StudyAttempt, token=token, user=request.user, mode='speak')
    attempt.abandoned = True
    attempt.save(update_fields=['abandoned'])
    return JsonResponse({'ok': True})


@login_required
def match_page(request, pk):
    return render(request, 'cards/match.html', {'deck': get_object_or_404(Deck, pk=pk, owner=request.user)})


@login_required
@require_POST
def match_new(request, pk):
    deck = get_object_or_404(Deck, pk=pk, owner=request.user)
    try:
        if request.POST.get('resume'):
            round = get_object_or_404(MatchRound, token=request.POST['resume'], deck=deck)
        else:
            round = create_match(deck, request.POST.get('weak') == '1')
        return JsonResponse(match_payload(round))
    except (ValueError, ValidationError):
        return JsonResponse({'error': 'Cần ít nhất hai thẻ có từ và nghĩa khác nhau. Nếu đang lọc từ yếu, hãy chọn tất cả thẻ.'}, status=400)


@login_required
@require_POST
def match_submit(request, token):
    round = get_object_or_404(MatchRound.objects.select_related('deck'), token=token, deck__owner=request.user)
    try:
        mapping = json.loads(request.POST.get('pairs', '{}'))
        return JsonResponse(submit_match(round, mapping))
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Hãy ghép đủ các cặp trước khi kiểm tra.'}, status=400)

