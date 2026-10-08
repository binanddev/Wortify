"""JSON/file endpoints for card practice, audio and exports. No page rendering."""
import csv
import hashlib
import io
import json
import random
import uuid
from datetime import timedelta
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse, HttpResponse, FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_POST
from cards.models import Deck, Card, StudySettings, StudyProgress, StudyAttempt, CardAudio, Folder, ImportBatch, MatchRound
from cards.services.exercises import sentence_items, create_match, match_payload, submit_match
from cards.services import study
from cards.services.comparison import compare
from cards.services.speech import SpeechError, SpeechToTextService, TextToSpeechService
from cards.services.audio_validation import validate_audio


def preferences(user, language='de'):
    return StudySettings.objects.get_or_create(user=user, language=language)[0]


CSV_FIELDS = ['german_text', 'vietnamese_meaning', 'example_german', 'example_vietnamese', 'part_of_speech', 'article', 'plural_form', 'notes', 'usage', 'accepted_answers', 'accepted_examples', 'position']


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


def resume_question(request, token):
    attempt = get_object_or_404(StudyAttempt.objects.select_related('card'), token=token, user=request.user, abandoned=False)
    return JsonResponse(question_payload(attempt))


@require_POST
def next_question(request):
    mode = request.POST.get('mode', 'flash')
    if mode not in ('flash', 'quiz', 'spell', 'speak', 'learn', 'write', 'order'):
        return JsonResponse({'error': 'Invalid study mode.'}, status=400)
    prefs = preferences(request.user, getattr(request, 'language', 'de'))
    deck_id = request.POST.get('deck')
    if deck_id:
        if not deck_id.isdigit():
            return JsonResponse({'error': 'Invalid deck.'}, status=400)
        get_object_or_404(Deck, pk=deck_id, owner=request.user)
    cards = study.queue(request.user, prefs, deck_id, request.POST.get('filter', 'all'), mode == 'learn', language=getattr(request, 'language', 'de'))
    if mode == 'order':
        cards = [card for card in cards if 2 <= len(card.example_german.split()) <= 40]
    if not cards:
        message = 'No matching questions. Add German example sentences of 2–40 words or change filters.' if mode == 'order' else 'All matching cards are complete. Choose another deck or return when reviews are due.'
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


@require_POST
def submit(request, token):
    attempt = get_object_or_404(StudyAttempt.objects.select_related('card'), token=token, user=request.user)
    if attempt.completed_at:
        return JsonResponse(attempt.result)
    if attempt.abandoned:
        return JsonResponse({'error': 'This study session has ended.'}, status=409)
    answer = request.POST.get('answer', '')
    if len(answer) > 4000 or len(answer.split()) > 500:
        return JsonResponse({'error': 'The answer is too long.'}, status=400)
    if attempt.mode == 'quiz':
        if answer not in attempt.question['options']:
            return JsonResponse({'error': 'Choose an answer.'}, status=400)
        result = {'is_correct': answer == attempt.question['meaning']}
    elif attempt.mode == 'flash':
        if answer not in ('remember', 'again'):
            return JsonResponse({'error': 'Choose a recall rating.'}, status=400)
        result = {'is_correct': answer == 'remember'}
    elif attempt.mode == 'order':
        try:
            ids = json.loads(answer)
            items = {item['id']: item['text'] for item in attempt.question['items']}
            if not isinstance(ids, list) or len(ids) != len(items) or any(not isinstance(i, str) for i in ids) or set(ids) != set(items):
                raise ValueError
            answer = ' '.join(items[i] for i in ids)
        except (ValueError, TypeError):
            return JsonResponse({'error': 'Use all words to form the sentence.'}, status=400)
        result = compare(attempt.question['target'], answer, attempt.question['alternatives'], **attempt.question['grading'])
    elif attempt.mode in ('spell', 'write'):
        result = compare(attempt.question['target'], answer, attempt.question['alternatives'], **attempt.question['grading'])
    else:
        return JsonResponse({'error': 'Submit a recording to check.'}, status=400)
    result['card'] = attempt.question.get('card', card_data(attempt.card))
    result['target'] = attempt.question['target']
    elapsed = min(7200000, max(0, int((timezone.now() - attempt.created_at).total_seconds() * 1000)))
    return JsonResponse(study.finish(attempt, answer, result, elapsed))


@require_POST
def audio(request, token):
    attempt = get_object_or_404(StudyAttempt.objects.select_related('card'), token=token, user=request.user)
    audio_type = request.POST.get('type', attempt.question['target_type'])
    if audio_type not in ('term', 'example'):
        return JsonResponse({'error': 'Invalid listening content.'}, status=400)
    snapshot = attempt.question.get('card', card_data(attempt.card))
    text = snapshot['example_german'] if audio_type == 'example' else snapshot['german_text']
    if not text:
        return JsonResponse({'error': 'This card has no example sentence.'}, status=400)
    speed = .7 if request.POST.get('slow') == '1' else 1
    if not settings.TTS_PROVIDER:
        return JsonResponse({'fallback': True, 'text': text, 'speed': speed, 'message': 'Using the browser voice.'})
    try:
        obj = TextToSpeechService().audio(attempt.card, audio_type, text, speed)
        return JsonResponse({'url': f'/api/{attempt.card.deck.language}/audio-file/{obj.pk}/'})
    except SpeechError as exc:
        return JsonResponse({'fallback': True, 'text': text, 'speed': speed, 'message': str(exc) + ' Using the browser voice.'})


def tts_file(request, pk):
    obj = get_object_or_404(CardAudio, pk=pk, card__deck__owner=request.user)
    return private_file(obj.audio_file, 'audio/mpeg')


@require_POST
def card_audio(request, pk):
    card = get_object_or_404(Card, pk=pk, deck__owner=request.user)
    kind = request.POST.get('type', 'term')
    text = card.example_german if kind == 'example' else card.german_text
    if not text:
        return JsonResponse({'error': 'This card has no example sentence.'}, status=400)
    if settings.TTS_PROVIDER:
        try:
            audio = TextToSpeechService().audio(card, kind, text, 1)
            return JsonResponse({'url': f'/api/{card.deck.language}/audio-file/{audio.pk}/'})
        except SpeechError:
            pass
    return JsonResponse({'fallback': True, 'text': text, 'speed': 1, 'message': 'Using the browser voice.'})


def private_file(field, mime):
    try:
        response = FileResponse(field.open('rb'), content_type=mime)
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
    except FileNotFoundError:
        return JsonResponse({'error':'This recording is no longer stored.'}, status=404)


@require_POST
def speaking_check(request, token):
    attempt = get_object_or_404(StudyAttempt.objects.select_related('card'), token=token, user=request.user, mode='speak')
    if attempt.completed_at:
        return JsonResponse({'status': 'done', 'result': attempt.result, 'ephemeral': True})
    if attempt.abandoned:
        return JsonResponse({'error': 'This session has ended. Record again in a new session.'}, status=409)
    if request.POST.get('consent') != 'yes':
        return JsonResponse({'error': 'Consent to sending temporary audio to the recognition service.'}, status=400)
    upload = request.FILES.get('audio')
    if not upload:
        return JsonResponse({'error': 'No audio yet.'}, status=400)
    claimed = False
    try:
        data, ext, mime, duration = validate_audio(upload)
        now = timezone.now()
        StudyAttempt.objects.filter(pk=attempt.pk, processing_started_at__lt=now-timedelta(seconds=settings.SPEECH_TIMEOUT+60)).update(processing_started_at=None)
        claimed = StudyAttempt.objects.filter(pk=attempt.pk, completed_at__isnull=True, abandoned=False, processing_started_at__isnull=True).update(processing_started_at=now)
        if not claimed:
            return JsonResponse({'error': 'This test is processing or already complete. Reload its status.'}, status=409)
        response = SpeechToTextService().transcribe(data, uuid.uuid4().hex+'.'+ext, mime, language=attempt.card.deck.language)
        transcript = response.get('transcript', '').strip()
        if not transcript:
            raise SpeechError('No speech detected. Record again clearly.')
        if len(transcript) > 4000 or len(transcript.split()) > 500:
            raise SpeechError('Content is too long. Record a shorter segment.')
        confidence = response.get('confidence')
        if confidence is not None and (not isinstance(confidence, (int, float)) or not 0 <= confidence <= 1):
            raise SpeechError('The recognition service returned no valid result.')
        uncertain = response.get('uncertain', False) or (confidence is not None and confidence < .6)
        result = compare(attempt.question['target'], transcript, attempt.question['alternatives'], ignore_case=True, ignore_punctuation=True, transliteration=attempt.question['grading']['transliteration'])
        result.update({'uncertain': uncertain, 'confidence': confidence, 'card': attempt.question.get('card', card_data(attempt.card))})
        if not uncertain:
            study.finish(attempt, '', {'is_correct': result['is_correct'], 'ephemeral': True}, duration)
        response = JsonResponse({'status': 'uncertain' if uncertain else 'done', 'result': result, 'ephemeral': True})
        response['Cache-Control'] = 'no-store'
        return response
    except (SpeechError, TimeoutError) as exc:
        return JsonResponse({'status': 'error', 'error': str(exc) if isinstance(exc, SpeechError) else 'The service timed out. Please try again.'}, status=200 if claimed else 400)
    except Exception:
        return JsonResponse({'status': 'error', 'error': 'Unable to process audio. Please try again.'})
    finally:
        if claimed:
            StudyAttempt.objects.filter(pk=attempt.pk).update(processing_started_at=None)
        upload.close()

@require_POST
def retry(request, token):
    attempt = get_object_or_404(StudyAttempt, token=token, user=request.user, mode='speak')
    attempt.abandoned = True
    attempt.save(update_fields=['abandoned'])
    return JsonResponse({'ok': True})


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
        return JsonResponse({'error': 'At least two cards with distinct terms and meanings are required. If filtering weak words, choose all cards.'}, status=400)


@require_POST
def match_submit(request, token):
    round = get_object_or_404(MatchRound.objects.select_related('deck'), token=token, deck__owner=request.user)
    try:
        mapping = json.loads(request.POST.get('pairs', '{}'))
        return JsonResponse(submit_match(round, mapping))
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Complete all pairs before checking.'}, status=400)

