"""FSRS scheduling shared by automatic and self-rated flashcard reviews."""
from datetime import timedelta, timezone as datetime_timezone
from django.utils import timezone
from fsrs import Card, Scheduler, Rating, State


def scheduler(options=None):
    options = options or {}
    return Scheduler(desired_retention=float(options.get('retention', .9)), maximum_interval=3650, enable_fuzzing=False)


def memory_card(progress, now):
    if progress and progress.memory.get('card'):
        return Card.from_dict(progress.memory['card'])
    if progress and progress.last_reviewed_at and progress.interval_days >= 1:
        return Card(card_id=progress.card_id, state=State.Review, stability=max(1,progress.interval_days), difficulty=5,
                    due=progress.due_at, last_review=progress.last_reviewed_at)
    return Card(card_id=progress.card_id if progress else 0, due=now)


def duration(value):
    if value is None: return None
    if type(value) is not int or not 0 <= value <= 86_400_000: raise ValueError('Invalid response time.')
    return value if 250 <= value <= 120_000 else None


def review(progress, correct, mode, now, response_ms=None, rating=None, options=None):
    options = options or {}
    response_ms = duration(response_ms)
    if rating is not None and (type(rating) is not int or rating not in (1,2,3,4) or (rating==1) == correct):
        raise ValueError('Invalid recall rating.')
    now = now.astimezone(datetime_timezone.utc)
    if progress.last_reviewed_at and now < progress.last_reviewed_at: return
    memory = dict(progress.memory)
    timings = dict(memory.get('timings',{}))
    stats = dict(timings.get(mode, {'count':0,'average':0}))
    selected = rating or (1 if not correct else 2 if options.get('adapt_time',True) and response_ms and stats['count']>=5 and response_ms > max(15000,stats['average']*2.5) else 3)
    if response_ms:
        stats['average'] = round((stats['average']*min(stats['count'],19)+response_ms)/(min(stats['count'],19)+1))
        stats['count'] += 1; timings[mode]=stats
    memory['timings']=timings
    # Immediate retries are practice, not evidence of long-term recall.
    too_soon = rating is None and correct and progress.last_reviewed_at and now-progress.last_reviewed_at < timedelta(minutes=1)
    if not too_soon:
        card, log = scheduler(options).review_card(memory_card(progress,now),Rating(selected),review_datetime=now,review_duration=response_ms)
        memory['card']=card.to_dict(); memory['rating']=selected
        memory['last_log']=log.to_dict()
        progress.due_at=card.due
        progress.interval_days=max(0,(card.due-now).total_seconds()/86400)
    memory.setdefault('first_review',now.isoformat())
    progress.memory=memory
    progress.correct_count+=int(correct); progress.incorrect_count+=int(not correct)
    progress.repetition_count+=1; progress.lapse_count+=int(not correct)
    progress.last_reviewed_at=now; progress.response_time_ms=response_ms; progress.last_mode=mode
    progress.state='weak' if not correct else 'mastered' if progress.interval_days>=7 else 'learning'


def summary(progress, now, options=None):
    card=memory_card(progress,now)
    engine=scheduler(options)
    choices={str(int(r)):engine.review_card(card,r,review_datetime=max(now,card.last_review or now))[0].due.isoformat() for r in Rating}
    return {'due_at':progress.due_at.isoformat() if progress else None,'interval_days':progress.interval_days if progress else 0,
            'difficulty':card.difficulty,'retrievability':engine.get_card_retrievability(card,now) if card.last_review else None,
            'lapses':progress.lapse_count if progress else 0,'timings':progress.memory.get('timings',{}) if progress else {},'choices':choices}
