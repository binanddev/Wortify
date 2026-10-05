import random
import uuid
from django.db import transaction
from django.utils import timezone
from cards.models import StudyAttempt, MatchRound
from .comparison import normalize
from .study import finish


def sentence_items(text):
    words = text.split()
    if not 2 <= len(words) <= 40:
        raise ValueError('Cần câu ví dụ từ 2 đến 40 từ để sắp xếp câu.')
    items = [{'id': str(i), 'text': word} for i, word in enumerate(words)]
    random.shuffle(items)
    if [item['id'] for item in items] == [str(i) for i in range(len(words))]:
        items = items[1:] + items[:1]
    return items


def create_match(deck, wrong_only=False):
    cards = list(deck.cards.all())
    if wrong_only:
        cards = [c for c in cards if c.studyprogress_set.filter(user=deck.owner, state='weak').exists()]
    random.shuffle(cards)
    selected, terms, meanings = [], set(), set()
    for card in cards:
        term, meaning = normalize(card.german_text), normalize(card.vietnamese_meaning)
        if term not in terms and meaning not in meanings:
            selected.append(card)
            terms.add(term)
            meanings.add(meaning)
        if len(selected) == 6:
            break
    if len(selected) < 2:
        raise ValueError('Cần ít nhất hai thẻ có từ và nghĩa khác nhau để ghép thẻ. Nếu đang lọc từ yếu, hãy chọn tất cả thẻ.')
    with transaction.atomic():
        pairs = []
        for card in selected:
            attempt = StudyAttempt.objects.create(user=deck.owner, card=card, mode='match')
            pairs.append({'id': uuid.uuid4().hex, 'term': card.german_text, 'meaning': card.vietnamese_meaning, 'attempt': str(attempt.token)})
        return MatchRound.objects.create(deck=deck, pairs=pairs)


def match_payload(round):
    left = [{'id': p['id'], 'text': p['term']} for p in round.pairs]
    right = [{'id': p['id'], 'text': p['meaning']} for p in round.pairs]
    # Independent IDs prevent encoding the answer in the two visible button IDs.
    right = [{'id': str(i), 'text': p['text']} for i, p in enumerate(right)]
    random.Random('left:' + str(round.token)).shuffle(left)
    random.Random(str(round.token)).shuffle(right)
    return {'token': str(round.token), 'left': left, 'right': right, 'completed': bool(round.completed_at), 'result': round.result}


@transaction.atomic
def submit_match(round, mapping):
    if not isinstance(mapping, dict) or set(mapping) != {p['id'] for p in round.pairs} or set(mapping.values()) != {str(i) for i in range(len(round.pairs))}:
        raise ValueError('Hãy ghép mỗi từ với một nghĩa, không để trống hoặc dùng lại một nghĩa.')
    if not MatchRound.objects.filter(pk=round.pk, completed_at__isnull=True).update(completed_at=timezone.now()):
        round.refresh_from_db()
        return round.result
    rows = []
    for i, pair in enumerate(round.pairs):
        correct = mapping[pair['id']] == str(i)
        attempt = StudyAttempt.objects.get(token=pair['attempt'], user=round.deck.owner)
        finish(attempt, round.pairs[int(mapping[pair['id']])]['meaning'], {'is_correct': correct})
        rows.append({'term': pair['term'], 'meaning': pair['meaning'], 'is_correct': correct})
    result = {'correct': sum(row['is_correct'] for row in rows), 'total': len(rows), 'rows': rows}
    MatchRound.objects.filter(pk=round.pk).update(result=result)
    return result
