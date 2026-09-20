import random
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from cards.models import Deck, Card, StudySettings, StudyAttempt, StudySession, StudyProgress
from cards.services.study import queue, choices, finish
from cards.services.comparison import compare
from cards.views import card_data
from .common import endpoint, body

def owned(request, token):
    return get_object_or_404(StudySession, token=token, user=request.user, language=request.language)

def attempts(session):
    rows = {str(a.token): a for a in StudyAttempt.objects.filter(token__in=session.tokens).select_related('card')}
    if any(token not in rows for token in session.tokens): raise ValueError('Nội dung buổi học đã thay đổi. Hãy tạo buổi học mới.')
    return [rows[token] for token in session.tokens]

def public_question(attempt):
    q = attempt.question
    data = {'token': str(attempt.token), 'mode': attempt.mode, 'prompt': q['target'] if attempt.mode in ['flash','quiz'] else q['meaning'], 'options': q['options']}
    if attempt.mode == 'flash': data.update(target=q['target'], card=q['card'])
    return data

def payload(session):
    if session.result: return {'token':str(session.token),'kind':session.kind,'deck':session.deck_id,'total':session.result['total'],'completed':session.result['total'],'result':session.result}
    rows = attempts(session)
    completed = sum(a.completed_at is not None for a in rows)
    data = {'token': str(session.token), 'kind': session.kind, 'deck': session.deck_id, 'total': len(rows), 'completed': completed, 'result': session.result or None}
    if session.result: return data
    if session.kind == 'test': data['questions'] = [public_question(a) for a in rows]
    else:
        pending = next((a for a in rows if not a.completed_at), None)
        data['question'] = public_question(pending) if pending else None
    return data

def calculate(attempt, value):
    if not isinstance(value, str) or not value.strip() or len(value) > 4000:
        raise ValueError('Hãy nhập câu trả lời hợp lệ.')
    q = attempt.question
    if attempt.mode == 'flash':
        if value not in ['remember','again']: raise ValueError('Chọn mức độ ghi nhớ.')
        correct = value == 'remember'
    elif attempt.mode == 'quiz':
        if value not in q['options']: raise ValueError('Hãy chọn một đáp án.')
        correct = value == q['meaning']
    else:
        correct = compare(q['target'], value, q['alternatives'], **q['grading'])['is_correct']
    return {'is_correct': correct, 'target': q['target'], 'card': q['card'], 'answer': value}

def summarize(session):
    rows = attempts(session)
    result = {'correct': sum(a.is_correct is True for a in rows), 'total': len(rows), 'rows': [{'card_id': a.card_id, **a.result} for a in rows]}
    session.result = result; session.completed_at = timezone.now(); session.save(update_fields=['result','completed_at'])
    return result

@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def create(request):
    data = body(request); kind = data.get('kind', 'learn')
    if kind not in ['flash','learn','test']: raise ValueError('Cách học không hợp lệ.')
    prefs, _ = StudySettings.objects.get_or_create(user=request.user, language=request.language)
    deck = get_object_or_404(Deck, pk=data['deck'], owner=request.user, language=request.language) if data.get('deck') else None
    count = int(data.get('count', 20))
    if not 1 <= count <= 100: raise ValueError('Chọn từ 1 đến 100 câu.')
    pool = queue(request.user, prefs, deck.pk if deck else None, data.get('filter','all'), learn=data.get('today',False) is True, language=request.language)
    if data.get('review_session'):
        previous = owned(request, data['review_session'])
        ids = {row['card_id'] for row in previous.result.get('rows',[]) if not row['is_correct']}
        pool = [card for card in pool if card.pk in ids]
    if kind == 'learn':
        progress = {p.card_id: p for p in StudyProgress.objects.filter(user=request.user, card__deck__language=request.language)}
        pool.sort(key=lambda c: (0 if c.pk in progress and (progress[c.pk].state=='weak' or progress[c.pk].due_at<=timezone.now()) else 1, -(progress[c.pk].incorrect_count if c.pk in progress else 0)))
    elif kind == 'test': random.shuffle(pool)
    pool = pool[:count]
    if not pool: raise ValueError('Chưa có thẻ phù hợp để học. Hãy thêm thẻ hoặc chọn bộ lọc khác.')
    session = StudySession.objects.create(user=request.user, language=request.language, deck=deck, kind=kind)
    for i, card in enumerate(pool):
        mode = 'flash' if kind == 'flash' else ('quiz' if i % 2 == 0 else 'write')
        options = []
        if mode == 'quiz':
            try: options = choices(card)
            except ValueError: mode = 'write'
        q = {'target': card.german_text, 'meaning': card.vietnamese_meaning, 'options': options, 'alternatives': card.accepted_answers, 'card': card_data(card), 'target_type': 'term', 'grading': {'ignore_case': prefs.ignore_case, 'ignore_punctuation': prefs.ignore_punctuation, 'transliteration': prefs.transliteration and request.language=='de'}}
        a = StudyAttempt.objects.create(user=request.user, card=card, mode=mode, question=q)
        session.tokens.append(str(a.token))
    session.save(update_fields=['tokens'])
    return JsonResponse(payload(session), status=201)

@endpoint
@require_http_methods(['GET'])
def detail(request, token):
    return JsonResponse(payload(owned(request, token)))

@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def answer(request, token):
    session = owned(request, token)
    if session.kind == 'test': raise ValueError('Bài kiểm tra chỉ chấm khi nộp toàn bài.')
    data = body(request)
    if data.get('question') not in session.tokens: raise ValueError('Câu hỏi không thuộc buổi học.')
    a = get_object_or_404(StudyAttempt, token=data['question'], user=request.user)
    pending = next((row for row in attempts(session) if not row.completed_at), None)
    if not a.completed_at and (pending is None or pending.pk != a.pk): raise ValueError('Hãy trả lời câu hiện tại trước.')
    result = a.result if a.completed_at else finish(a, data.get('answer',''), calculate(a, data.get('answer','')))
    if not StudyAttempt.objects.filter(token__in=session.tokens, completed_at__isnull=True).exists(): summarize(session)
    return JsonResponse({'feedback': result, 'session': payload(session)})

@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def finish_test(request, token):
    session = owned(request, token)
    if session.kind != 'test': raise ValueError('Đây không phải bài kiểm tra.')
    if session.result: return JsonResponse(payload(session))
    values = body(request).get('answers', {})
    if not isinstance(values, dict) or set(values) != set(session.tokens): raise ValueError('Hãy trả lời đủ các câu trước khi nộp.')
    graded = [(a, calculate(a, values[str(a.token)])) for a in attempts(session)]
    for a, result in graded: finish(a, values[str(a.token)], result)
    summarize(session)
    return JsonResponse(payload(session))
