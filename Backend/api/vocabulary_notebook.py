"""Small vocabulary sets with recall, sentence production and self-assessment."""
import uuid
from datetime import timedelta
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from cards.models import Deck, DeckLearningState
from cards.services.comparison import normalize
from .common import endpoint, body

PHASES = ('prepare', 'recall', 'sentence', 'variation', 'check')
INTERVALS = (1, 3, 7, 14)


def response_data(state, deck):
    notebook = state.notebook or {'revision': 0, 'records': {}, 'session': None}
    ids = list(deck.cards.values_list('id', flat=True))
    selected = (notebook.get('session') or {}).get('cards', [])
    cards = list(deck.cards.filter(pk__in=selected).values('id', 'german_text', 'vietnamese_meaning', 'example_german',
        'example_vietnamese', 'article', 'plural_form', 'part_of_speech', 'usage', 'notes', 'accepted_answers', 'accepted_examples'))
    today = timezone.localdate().isoformat()
    records = notebook.get('records', {})
    return {'notebook': notebook, 'cards': cards, 'total': len(ids),
        'due': sum(1 for cid in ids if records.get(str(cid), {}).get('next_date', '9999') <= today),
        'new': sum(1 for cid in ids if str(cid) not in records)}


@endpoint
@require_http_methods(['GET', 'POST'])
@transaction.atomic
def notebook(request, pk):
    deck = get_object_or_404(Deck, pk=pk, owner=request.user, language=request.language)
    # Serialize initialization too; other study modes keep their own fields.
    Deck.objects.select_for_update().get(pk=deck.pk)
    state, _ = DeckLearningState.objects.get_or_create(user=request.user, deck=deck)
    state = DeckLearningState.objects.select_for_update().get(pk=state.pk)
    if request.method == 'GET': return JsonResponse(response_data(state, deck))
    data = body(request)
    token = str(uuid.UUID(data.get('token', '')))
    value = state.notebook or {'revision': 0, 'records': {}, 'session': None}
    if value.get('last_token') == token: return JsonResponse(response_data(state, deck))
    if data.get('revision') != value['revision']:
        return JsonResponse({'error': 'This set changed in another tab. Reload the current step.', **response_data(state, deck)}, status=409)
    action = data.get('action')
    session = value.get('session')
    today = timezone.localdate()
    if action == 'start':
        if session and not session.get('done'): raise ValueError('Finish or discard the current set first.')
        size = data.get('size', 5)
        if type(size) is not int or not 3 <= size <= 8: raise ValueError('Choose 3–8 words per set.')
        selection = data.get('selection', 'ready')
        if selection not in ('ready', 'all'): raise ValueError('Invalid selection.')
        records = value['records']
        cards = list(deck.cards.values_list('id', flat=True))
        due = [c for c in cards if records.get(str(c), {}).get('next_date', '9999') <= today.isoformat()]
        new = [c for c in cards if str(c) not in records]
        ready = set(due + new)
        rest = [c for c in cards if c not in ready] if selection == 'all' else []
        chosen = (due + new + rest)[:size]
        if not chosen: raise ValueError('No words are ready. You can choose to practise other words early.')
        value['session'] = {'id': str(uuid.uuid4()), 'cards': chosen, 'phase': 'prepare', 'index': 0,
            'answers': {}, 'done': False, 'started_at': timezone.now().isoformat()}
    elif action == 'discard':
        value['session'] = None
    elif action == 'step':
        if not session or session.get('done'): raise ValueError('Start a set first.')
        card_id = session['cards'][session['index']]
        if not deck.cards.filter(pk__in=session['cards']).count() == len(session['cards']):
            raise ValueError('A card in this set was deleted. Discard the set and start again.')
        phase = session['phase']
        if phase != 'prepare':
            answer = data.get('answer', '')
            correction = data.get('correction', '')
            if not isinstance(answer, str) or len(answer) > 2000 or not isinstance(correction, str) or len(correction) > 2000:
                raise ValueError('Answers and corrections must be text up to 2000 characters.')
            remembered = data.get('remembered')
            if type(remembered) is not bool: raise ValueError('Assess this step before continuing.')
            if remembered and not answer.strip(): raise ValueError('Write your answer before marking it remembered.')
            correct = None
            if phase in ('recall', 'check'):
                card = deck.cards.get(pk=card_id)
                candidates = [card.german_text, *card.accepted_answers]
                if card.article and not card.german_text.lower().startswith(card.article.lower() + ' '):
                    candidates.append(f'{card.article} {card.german_text}')
                correct = bool(normalize(answer)) and any(normalize(answer) == normalize(target) for target in candidates)
                remembered = remembered and correct
            row = session['answers'].setdefault(str(card_id), {})
            row[phase] = {'answer': answer.strip(), 'correction': correction.strip(), 'remembered': remembered, 'correct': correct}
        session['index'] += 1
        if session['index'] == len(session['cards']):
            session['index'] = 0
            position = PHASES.index(phase)
            if position + 1 < len(PHASES): session['phase'] = PHASES[position + 1]
            else:
                session['done'] = True
                session['completed_at'] = timezone.now().isoformat()
                for cid in session['cards']:
                    key = str(cid); answers = session['answers'][key]
                    successful = all(answers[p]['remembered'] for p in PHASES[1:])
                    old = value['records'].get(key, {})
                    # Early practice cannot accelerate the scheduled interval.
                    early = old.get('next_date', '') > today.isoformat()
                    stage = min(old.get('stage', -1) + 1, 3) if successful else -1
                    if successful and early: stage = old['stage']
                    next_date = old['next_date'] if successful and early else (today + timedelta(days=INTERVALS[max(0, stage)])).isoformat()
                    value['records'][key] = {'stage': stage, 'next_date': next_date,
                        'needs_practice': not successful, 'last_practised': today.isoformat(),
                        'recall': answers['check']['remembered'],
                        'sentence': answers['sentence']['remembered'] and answers['variation']['remembered']}
    else: raise ValueError('Unknown notebook action.')
    value['revision'] += 1
    value['last_token'] = token
    state.notebook = value
    state.save(update_fields=['notebook'])
    return JsonResponse(response_data(state, deck))
