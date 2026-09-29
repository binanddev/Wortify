"""Profile dashboard, aggregated from persisted learning activity in one response."""
from collections import defaultdict
from datetime import timedelta
from django.db.models import Count, Q, Sum, IntegerField, Max
from django.db.models.functions import TruncDate, Cast, Coalesce
from django.utils import timezone
from cards.models import Card, Deck, StudyProgress, StudyAttempt, StudySession, LearningEvent
from practice.models import PracticeAttempt


def streaks(days, today):
    current = 0
    cursor = today if today in days else today - timedelta(days=1)
    while cursor in days:
        current += 1
        cursor -= timedelta(days=1)
    longest = run = 0
    previous = None
    for day in sorted(days):
        run = run + 1 if previous == day - timedelta(days=1) else 1
        longest = max(longest, run)
        previous = day
    return current, longest


def profile_data(request, profile):
    user, lang = request.user, request.language
    now, today = timezone.now(), timezone.localdate()
    events = LearningEvent.objects.filter(user=user, language=lang)
    attempts = PracticeAttempt.objects.filter(user=user, node__language=lang)
    legacy = StudyAttempt.objects.filter(user=user, card__deck__language=lang, completed_at__isnull=False, abandoned=False)
    sessions = StudySession.objects.filter(user=user, language=lang)
    days = defaultdict(lambda: {'total': 0, 'correct': 0, 'completed': 0})

    def collect(query, date_field, total, correct, completed=None):
        annotations = {'total': total, 'correct': correct}
        if completed is not None:
            annotations['completed'] = completed
        for row in query.annotate(day=TruncDate(date_field)).values('day').annotate(**annotations).order_by():
            if row['day'] is None or row['day'] > today:
                continue
            for key in ('total', 'correct', 'completed'):
                days[row['day']][key] += row.get(key, 0) or 0

    json_sum = lambda field: Coalesce(Sum(Cast(field, IntegerField())), 0)
    collect(events.filter(kind='review').filter(Q(payload__source__isnull=True)|~Q(payload__source='test')), 'created_at', Count('id'), Count('id', filter=Q(payload__correct=True)))
    collect(events.filter(kind='test'), 'created_at', json_sum('result__total'), json_sum('result__correct'), Count('id'))
    # Practice events are receipts; only the corresponding attempt is counted.
    collect(attempts, 'created_at', json_sum('result__total'), json_sum('result__score'), Count('id'))
    collect(legacy, 'completed_at', Count('id'), Count('id', filter=Q(is_correct=True)))
    collect(sessions.filter(completed_at__isnull=False), 'completed_at', Count('id', filter=Q(pk__isnull=True)), Count('id', filter=Q(pk__isnull=True)), Count('id'))
    active = {day for day, values in days.items() if values['total'] or values['completed']}
    current, longest = streaks(active, today)
    periods = {}
    for length in (7, 30, 90):
        selected = [v for day, v in days.items() if today - timedelta(days=length - 1) <= day <= today]
        total = sum(v['total'] for v in selected)
        correct = sum(v['correct'] for v in selected)
        periods[str(length)] = {'questions': total, 'correct': correct, 'accuracy': round(100 * correct / total) if total else None,
                                'active_days': sum(bool(v['total'] or v['completed']) for v in selected), 'completed': sum(v['completed'] for v in selected)}
    start = today - timedelta(days=today.weekday() + 21)
    calendar = [{'date': (day := start + timedelta(days=i)).isoformat(), **days.get(day, {'total': 0, 'correct': 0, 'completed': 0}), 'future': day > today} for i in range(28)]
    progress = StudyProgress.objects.filter(user=user, card__deck__language=lang)
    counts = progress.aggregate(studied=Count('id'), mastered=Count('id', filter=Q(state='mastered')), due=Count('id', filter=Q(due_at__lte=now)))
    total_cards = Card.objects.filter(deck__owner=user, deck__language=lang).count()
    deck_rows = Deck.objects.filter(owner=user, language=lang).annotate(
        total=Count('cards', distinct=True),
        mastered_count=Count('cards', filter=Q(cards__studyprogress__user=user, cards__studyprogress__state='mastered'), distinct=True),
        due_count=Count('cards', filter=Q(cards__studyprogress__user=user, cards__studyprogress__due_at__lte=now), distinct=True),
        last_studied=Max('cards__studyprogress__last_reviewed_at', filter=Q(cards__studyprogress__user=user)),
    ).filter(total__gt=0).order_by('-due_count', '-last_studied', '-updated_at')
    decks = [{'id': d.pk, 'title': d.title, 'total': d.total, 'mastered': d.mastered_count, 'due': d.due_count} for d in deck_rows[:3]]
    practice_history = [{'id': a.pk, 'node': a.node_id, 'title': a.node.title, 'score': a.result.get('score', 0), 'total': a.result.get('total', 0), 'date': a.created_at.isoformat()} for a in attempts.select_related('node').order_by('-created_at')[:30]]
    study_history = [{'token': str(e.token), 'kind': e.kind, 'result': e.result, 'date': e.created_at.isoformat()} for e in events.filter(kind='test').order_by('-created_at')[:30]]
    history = [{'id': f'practice-{h["id"]}', 'kind': 'practice', 'title': h['title'], 'score': h['score'], 'total': h['total'], 'date': h['date'], 'path': f'/{lang}/practice/{h["node"]}'} for h in practice_history]
    test_decks = {int(h['result']['deck']) for h in study_history if h['result'].get('deck')}
    available = set(Deck.objects.filter(pk__in=test_decks, owner=user, language=lang).values_list('pk', flat=True))
    history += [{'id': h['token'], 'kind': 'test', 'title': h['result'].get('title', 'Flashcard'), 'score': h['result'].get('correct', 0), 'total': h['result'].get('total', 0), 'date': h['date'], 'path': f'/{lang}/flashcard/deck/{h["result"]["deck"]}' if h['result'].get('deck') in available else None} for h in study_history]
    for session in sessions.filter(completed_at__isnull=False).select_related('deck').order_by('-completed_at')[:30]:
        history.append({'id': str(session.token), 'kind': 'session', 'title': session.deck.title if session.deck else 'Ôn tập', 'score': session.result.get('correct', 0), 'total': session.result.get('total', 0), 'date': session.completed_at.isoformat(), 'path': f'/{lang}/flashcard/session/{session.token}'})
    history.sort(key=lambda h: h['date'], reverse=True)
    resume = sessions.filter(completed_at__isnull=True).exclude(tokens=[]).order_by('-created_at').values_list('token', flat=True).first()
    all_questions = sum(v['total'] for v in days.values())
    return {'username': user.username, 'display_name': profile.display_name, 'bio': profile.bio, 'language': lang,
            'today': today.isoformat(), 'daily_goal': profile.preferences.get('dailyGoals', {}).get(lang, 20), 'today_questions': days[today]['total'],
            'streak': current, 'longest_streak': longest, 'calendar': calendar, 'periods': periods,
            'cards': {'total': total_cards, 'new': max(0, total_cards - counts['studied']), 'familiar': counts['studied'] - counts['mastered'], 'mastered': counts['mastered'], 'due': counts['due']},
            'decks': decks, 'resume': f'/{lang}/flashcard/session/{resume}' if resume else None,
            'timeline': history[:60], 'history': practice_history, 'study_history': study_history,
            'reviews': events.filter(kind='review').count() + legacy.count(), 'mastered': counts['mastered'], 'sessions': sum(v['completed'] for v in days.values()),
            'milestones': [{'label': 'Buổi học đầu tiên', 'earned': bool(all_questions)}, {'label': '7 ngày liên tiếp', 'earned': longest >= 7}, {'label': '50 thẻ thành thạo', 'earned': counts['mastered'] >= 50}]}
