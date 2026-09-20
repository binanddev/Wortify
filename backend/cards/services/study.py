import random
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from cards.models import Card, StudyAttempt, StudyProgress
from .comparison import normalize


def choices(card):
    pool = list(card.deck.cards.exclude(pk=card.pk))
    random.shuffle(pool)
    pool.sort(key=lambda item: item.part_of_speech != card.part_of_speech)
    answers, seen = [card.vietnamese_meaning], {normalize(card.vietnamese_meaning)}
    for item in pool:
        key = normalize(item.vietnamese_meaning)
        if key not in seen:
            answers.append(item.vietnamese_meaning)
            seen.add(key)
        if len(answers) == 4:
            random.shuffle(answers)
            return answers
    raise ValueError('Cần ít nhất bốn nghĩa tiếng Việt khác nhau trong bộ thẻ để làm trắc nghiệm.')


def schedule(progress, correct, now):
    if correct:
        progress.correct_count += 1
        progress.repetition_count += 1
        progress.interval_days = 1 if progress.interval_days < 1 else min(365, progress.interval_days * 2)
        progress.state = 'mastered' if progress.interval_days >= 7 else 'learning'
    else:
        progress.incorrect_count += 1
        progress.lapse_count += int(progress.correct_count > 0)
        progress.repetition_count = 0
        progress.interval_days = 10 / 1440
        progress.state = 'weak'
    progress.due_at = now + timedelta(days=progress.interval_days)
    progress.last_reviewed_at = now


@transaction.atomic
def finish(attempt, answer, result, response_ms=None):
    # Conditional claim is also effective on SQLite, where select_for_update is a no-op.
    now = timezone.now()
    claimed = StudyAttempt.objects.filter(pk=attempt.pk, completed_at__isnull=True, abandoned=False).update(
        completed_at=now, submitted_answer=answer, normalized_answer=result.get('normalized_transcript', normalize(answer)),
        is_correct=result['is_correct'], result=result, response_time_ms=response_ms)
    if claimed:
        progress, _ = StudyProgress.objects.select_for_update().get_or_create(user=attempt.user, card=attempt.card)
        schedule(progress, result['is_correct'], now)
        progress.last_mode = attempt.mode
        progress.response_time_ms = response_ms
        progress.save()
    attempt.refresh_from_db()
    return attempt.result


def queue(user, settings, deck_id=None, filter_name='all', learn=False, language=None):
    cards = Card.objects.filter(deck__owner=user)
    if language:
        cards = cards.filter(deck__language=language)
    if deck_id:
        cards = cards.filter(deck_id=deck_id)
    progress = {p.card_id: p for p in StudyProgress.objects.filter(user=user)}
    now = timezone.now()
    today = timezone.localdate()
    # Count cards whose first valid review took place today, including subsequent reviews.
    from django.db.models import Min
    used = StudyAttempt.objects.filter(user=user, completed_at__isnull=False, **({'card__deck__language': language} if language else {})).values('card_id').annotate(first=Min('completed_at')).filter(first__date=today).count()
    new_budget = max(0, settings.new_cards_per_day - used)
    due, old, new = [], [], []
    for card in cards:
        p = progress.get(card.pk)
        if p is None:
            new.append(card)
        elif p.due_at <= now:
            due.append(card)
        else:
            old.append(card)
    due.sort(key=lambda c: progress[c.pk].due_at)
    if learn:
        return due + new[:new_budget]
    if filter_name == 'review':
        return [c for c in cards if c.pk in progress and (progress[c.pk].state == 'weak' or progress[c.pk].due_at <= now)]
    if filter_name == 'new':
        return new
    if filter_name == 'due':
        return due
    if filter_name == 'weak':
        return [c for c in cards if c.pk in progress and progress[c.pk].state == 'weak']
    if filter_name == 'wrong':
        ids = StudyAttempt.objects.filter(user=user, mode='quiz', is_correct=False).values_list('card_id', flat=True)
        return list(cards.filter(pk__in=ids))
    return list(cards)
