"""Atomic, owner-scoped deck management; copies never inherit learning progress."""
import io
import json
import uuid
import zipfile
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.db import transaction
from django.forms.models import model_to_dict
from django.http import Http404, HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST
from cards.models import Card, Deck, DeckOperation, Folder
from .common import body, endpoint

MAX_DECKS = 100
MAX_CARDS = 20000


def selection(ids, user, language, lock=False):
    if not isinstance(ids, list) or not 1 <= len(ids) <= MAX_DECKS or any(type(pk) is not int or pk < 1 for pk in ids) or len(set(ids)) != len(ids):
        raise ValueError('Select 1–100 distinct decks.')
    query = Deck.objects.filter(pk__in=ids, owner=user, language=language)
    if lock:
        query = query.select_for_update()
    decks = {deck.pk: deck for deck in query.order_by('pk')}
    if len(decks) != len(ids):
        raise Http404
    return [decks[pk] for pk in ids]


def destination(value, user, language):
    if value is None or value == '':
        return None
    if type(value) is not int or value < 1:
        raise ValueError('Invalid destination folder.')
    rows = list(Folder.objects.filter(owner=user, language=language).values('id', 'parent_id', 'archived'))
    folders = {row['id']: row['parent_id'] for row in rows}
    hidden = {row['id'] for row in rows if row['archived']}
    if value not in folders:
        raise Http404
    seen = set()
    current = value
    while current is not None:
        if current in hidden or current in seen:
            raise ValueError('Choose an active folder.')
        seen.add(current)
        current = folders.get(current)
    return value


@endpoint
@require_POST
@transaction.atomic
def manage(request):
    data = body(request)
    try:
        token = uuid.UUID(str(data.get('request_id', '')))
    except (ValueError, AttributeError):
        raise ValueError('A valid operation ID is required.')
    payload = {key: value for key, value in data.items() if key != 'request_id'}
    # Use the same owner lock as folder changes so a destination cannot disappear mid-operation.
    get_user_model().objects.select_for_update().get(pk=request.user.pk)
    existing = DeckOperation.objects.filter(token=token).first()
    if existing:
        if existing.user_id != request.user.pk or existing.language != request.language or existing.payload != payload:
            raise ValueError('This operation ID was already used for a different request.')
        return JsonResponse(existing.result)
    action = payload.get('action')
    if action not in ('move', 'copy', 'delete', 'undo'):
        raise ValueError('Unknown deck operation.')
    allowed = {'action', 'operation_id'} if action == 'undo' else {'action', 'ids'} if action == 'delete' else {'action', 'ids', 'folder', 'names'} if action == 'copy' else {'action', 'ids', 'folder'}
    if set(payload) - allowed:
        raise ValueError('Unknown operation fields.')
    result = {'operation_id': str(token), 'action': action, 'undoable': action == 'move'}
    if action == 'undo':
        try:
            original_id = uuid.UUID(str(payload.get('operation_id', '')))
        except (ValueError, AttributeError):
            raise ValueError('Invalid move operation.')
        original = DeckOperation.objects.filter(token=original_id, user=request.user, language=request.language).first()
        if not original or original.payload.get('action') != 'move' or original.result.get('undone_by') or original.created_at < timezone.now() - timedelta(minutes=15):
            raise ValueError('This move can no longer be undone.')
        moves = original.result['moves']
        decks = selection([move['id'] for move in moves], request.user, request.language, lock=True)
        by_id = {deck.pk: deck for deck in decks}
        for move in moves:
            deck = by_id[move['id']]
            if deck.folder_id != move['to'] or deck.updated_at.isoformat() != move['version']:
                raise ValueError('These decks changed after the move. Refresh before moving them again.')
        for folder_id in {move['from'] for move in moves}:
            destination(folder_id, request.user, request.language)
        for move in moves:
            deck = by_id[move['id']]
            Deck.objects.filter(pk=deck.pk, owner=request.user, language=request.language).update(folder_id=move['from'], updated_at=timezone.now())
        original.result['undone_by'] = str(token)
        original.result['undoable'] = False
        original.save(update_fields=['result'])
        result.update(ids=[deck.pk for deck in decks], count=len(decks))
    else:
        decks = selection(payload.get('ids'), request.user, request.language, lock=action != 'copy')
        result.update(ids=[deck.pk for deck in decks], count=len(decks))
        if action == 'delete':
            Deck.objects.filter(pk__in=result['ids'], owner=request.user, language=request.language).delete()
        else:
            if 'folder' not in payload:
                raise ValueError('Choose a destination folder.')
            folder_id = destination(payload.get('folder'), request.user, request.language)
            if action == 'move':
                moves = []
                for deck in decks:
                    if deck.folder_id == folder_id:
                        continue
                    old_folder = deck.folder_id
                    # Move only location, leaving publication policy and learning data untouched.
                    deck.folder_id = folder_id
                    deck.updated_at = timezone.now()
                    Deck.objects.filter(pk=deck.pk, owner=request.user, language=request.language).update(folder_id=folder_id, updated_at=deck.updated_at)
                    moves.append({'id': deck.pk, 'from': old_folder, 'to': folder_id, 'version': deck.updated_at.isoformat()})
                result.update(moves=moves, count=len(moves), ids=[move['id'] for move in moves], undoable=bool(moves))
            else:
                if Card.objects.filter(deck__in=decks).count() > MAX_CARDS:
                    raise ValueError('Copy up to 20,000 cards at a time.')
                names = payload.get('names', {})
                if not isinstance(names, dict) or set(names) - {str(deck.pk) for deck in decks} or any(not isinstance(name, str) or not name.strip() or len(name) > 150 for name in names.values()):
                    raise ValueError('Use deck names of 1–150 characters.')
                copies = []
                for source in decks:
                    copied = Deck.objects.create(owner=request.user, language=request.language, folder_id=folder_id,
                        title=names.get(str(source.pk), source.title[:143] + ' (copy)').strip(), description=source.description,
                        topic=source.topic, level=source.level, visibility='private')
                    Card.objects.bulk_create([Card(deck=copied, **model_to_dict(card, exclude=['id', 'deck'])) for card in source.cards.all()])
                    copies.append(copied.pk)
                result['ids'] = copies
    DeckOperation.objects.create(token=token, user=request.user, language=request.language, payload=payload, result=result)
    return JsonResponse(result)


@endpoint
@require_GET
@transaction.atomic
def export(request):
    from .card_learning import export_deck
    try:
        ids = [int(value) for value in request.GET.get('ids', '').split(',') if value]
    except ValueError:
        raise ValueError('Invalid deck selection.')
    decks = selection(ids, request.user, request.language)
    fmt = request.GET.get('format', 'json')
    if fmt not in ('json', 'csv'):
        raise ValueError('Choose JSON or CSV.')
    if Card.objects.filter(deck__in=decks).count() > MAX_CARDS:
        raise ValueError('Export up to 20,000 cards at a time.')
    output = io.BytesIO()
    manifest = []
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        for deck in decks:
            filename = f'deck-{deck.pk}.{fmt}'
            archive.writestr(filename, export_deck(request, deck.pk, fmt).content)
            manifest.append({'id': deck.pk, 'title': deck.title, 'description': deck.description,
                'level': deck.level, 'topic': deck.topic, 'language': deck.language, 'file': filename})
        archive.writestr('manifest.json', json.dumps({'decks': manifest}, ensure_ascii=False, indent=2))
    response = HttpResponse(output.getvalue(), content_type='application/zip')
    response['Content-Disposition'] = 'attachment; filename="wortify-decks.zip"'
    response['Cache-Control'] = 'private, no-store'
    return response
