"""Class-scoped, ordered vector operations. WSGI compatible; no image broadcasts."""
import math
import re
import uuid
from django.db import transaction
from django.db.models import Q, Exists, OuterRef
from django.http import JsonResponse, FileResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from users.models import Classroom, TeachingBoard, BoardEvent, BoardPDF
from users.board_uploads import MAX_PDF_BYTES
from .common import endpoint, body
from .teaching_realtime import committed_event

MAX_PAGES = 200
MAX_POINTS = 200000

def room(request, pk, write=False):
    # EXISTS avoids multiplying the teacher's row by every member on hot writes.
    membership = Classroom.members.through.objects.filter(classroom_id=OuterRef('pk'), user_id=request.user.pk)
    accessible = Classroom.objects.alias(board_member=Exists(membership)).filter(Q(owner=request.user) | Q(board_member=True))
    c = get_object_or_404(accessible, pk=pk, language=request.language)
    if write and c.owner_id != request.user.pk:
        from django.core.exceptions import PermissionDenied
        raise PermissionDenied('Only the class teacher can edit the board.')
    return c

def initial():
    page = str(uuid.uuid4())
    return {'pages': [{'id': page, 'width': 1120, 'height': 792, 'paper': 'plain'}], 'active': page, 'strokes': {}}

def uid(value):
    return str(uuid.UUID(str(value)))

def number(value, low, high):
    if type(value) not in (int, float) or not math.isfinite(value) or not low <= value <= high:
        raise ValueError('Invalid board coordinates or size.')
    return value

def apply(state, op, point_count=None):
    if not isinstance(op, dict):
        raise ValueError('Invalid board operation.')
    kind = op.get('kind')
    if kind == 'page':
        if len(state['pages']) >= MAX_PAGES:
            raise ValueError('A lesson supports up to 200 pages.')
        page = {'id': uid(op.get('id')), 'width': number(op.get('width'), 200, 2400), 'height': number(op.get('height'), 200, 2400), 'paper': op.get('paper')}
        if page['paper'] not in ('plain', 'grid', 'ruled') or any(p['id'] == page['id'] for p in state['pages']):
            raise ValueError('Invalid page.')
        state['pages'].append(page)
        return 0
    page = next((p for p in state['pages'] if p['id'] == op.get('page')), None)
    if not page:
        raise ValueError('Board page not found.')
    if kind == 'active':
        state['active'] = page['id']
    elif kind == 'ink':
        key = uid(op.get('id'))
        points = op.get('points')
        if not isinstance(points, list) or not 1 <= len(points) <= 2048:
            raise ValueError('Invalid stroke points.')
        for pt in points:
            if not isinstance(pt, list) or len(pt) != 2:
                raise ValueError('Invalid stroke point.')
            number(pt[0], 0, page['width']); number(pt[1], 0, page['height'])
        stroke = state['strokes'].get(key)
        if stroke is None:
            if op.get('offset') != 0 or not re.fullmatch(r'#[0-9a-fA-F]{6}', str(op.get('color'))):
                raise ValueError('Invalid stroke.')
            if op.get('tool') not in ('pen', 'pencil', 'marker', 'line', 'rectangle', 'ellipse'):
                raise ValueError('Invalid pen.')
            stroke = {'id': key, 'page': page['id'], 'tool': op['tool'], 'color': op['color'], 'width': number(op.get('width'), 0.5, 40), 'points': [], 'visible': True}
            state['strokes'][key] = stroke
        if stroke['page'] != page['id'] or type(op.get('offset')) is not int or op['offset'] != len(stroke['points']):
            raise ValueError('Stroke changed. Reconnect before writing.')
        if point_count is None:
            point_count = sum(len(s['points']) for s in state['strokes'].values())
        if point_count + len(points) > MAX_POINTS:
            raise ValueError('This lesson is full. Create another lesson to continue.')
        stroke['points'].extend(points)
        return len(points)
    elif kind == 'visibility':
        ids = op.get('ids')
        if not isinstance(ids, list) or len(ids) > 20000 or type(op.get('visible')) is not bool:
            raise ValueError('Invalid eraser operation.')
        for key in ids:
            stroke = state['strokes'].get(key)
            if not stroke or stroke['page'] != page['id']:
                raise ValueError('Stroke not found on this page.')
            stroke['visible'] = op['visible']
    else:
        raise ValueError('Unknown board operation.')
    return 0


def apply_batch(state, operations):
    # Count existing ink once, instead of scanning all strokes for every chunk.
    point_count = sum(len(stroke['points']) for stroke in state['strokes'].values())
    for operation in operations:
        point_count += apply(state, operation, point_count=point_count)

@endpoint
@require_http_methods(['GET', 'POST'])
def boards(request, pk):
    c = room(request, pk, request.method == 'POST')
    if request.method == 'POST':
        title = body(request).get('title', '')
        if not isinstance(title, str) or not title.strip() or len(title) > 120:
            raise ValueError('Enter a lesson title (up to 120 characters).')
        b = TeachingBoard.objects.create(classroom=c, title=title.strip(), state=initial())
        return JsonResponse({'id': str(b.pk)}, status=201)
    return JsonResponse({'boards': [{'id': str(b.pk), 'title': b.title, 'updated_at': b.updated_at.isoformat()} for b in c.boards.defer('state').order_by('-updated_at')]})

def snapshot_response(request, b):
    raw = request.GET.get('since')
    if raw is not None:
        since = int(raw)
        events = list(b.events.filter(revision__gt=since, revision__lte=b.revision).order_by('revision').values('revision', 'batch', 'operations')[:64])
        if 0 <= since <= b.revision and (since == b.revision or events and events[0]['revision'] == since + 1):
            return JsonResponse({'revision': events[-1]['revision'] if events else b.revision, 'events': events})
    # Reload both columns together: a deferred state read must not pair a new
    # snapshot with an older revision observed before another teacher write.
    b = TeachingBoard.objects.get(pk=b.pk)
    return JsonResponse({'id': str(b.pk), 'title': b.title, 'revision': b.revision, 'state': b.state})

@endpoint
@require_http_methods(['GET', 'POST'])
def board(request, pk, board_id):
    c = room(request, pk, request.method == 'POST')
    b = get_object_or_404(TeachingBoard.objects.defer('state'), pk=board_id, classroom=c)
    if request.method == 'GET':
        return snapshot_response(request, b)
    data = body(request)
    batch = uid(data.get('batch'))
    ops = data.get('operations')
    if not isinstance(ops, list) or not 1 <= len(ops) <= 128 or len(request.body) > 256000:
        raise ValueError('Invalid board batch.')
    with transaction.atomic():
        b = TeachingBoard.objects.select_for_update().get(pk=b.pk)
        previous = b.events.filter(batch=batch).first()
        if previous:
            return JsonResponse({'revision': previous.revision, 'notification': committed_event(request, b, 'batch', previous.batch, previous.operations, revision=previous.revision)})
        if type(data.get('revision')) is not int or data['revision'] != b.revision:
            return JsonResponse({'error': 'The board changed in another window. Reopen the lesson before continuing.'}, status=409)
        # JSONField decoding returned an instance-local object; no full clone is
        # needed. An invalid operation exits before save, keeping the DB atomic.
        state = b.state
        apply_batch(state, ops)
        b.state = state
        b.revision += 1
        b.save(update_fields=['state', 'revision', 'updated_at'])
        BoardEvent.objects.create(board=b, revision=b.revision, batch=batch, operations=ops)
        b.events.filter(revision__lte=b.revision - 500).delete()
    return JsonResponse({'revision': b.revision, 'notification': committed_event(request, b, 'batch', batch, ops)})

def validated_pdf_pages(source):
    if not 0 < source.size <= MAX_PDF_BYTES:
        raise ValueError('Choose one PDF file, up to 300 MB.')
    if not source.name.lower().endswith('.pdf') or source.read(5) != b'%PDF-':
        raise ValueError('Choose a valid PDF file.')
    source.seek(0)
    try:
        from pypdf import PdfReader
        reader = PdfReader(source)
        if reader.is_encrypted:
            raise ValueError('Unlock the PDF before importing it.')
        if not 1 <= len(reader.pages) <= MAX_PAGES:
            raise ValueError('A PDF supports up to 200 pages.')
        dimensions = []
        for p in reader.pages:
            w, h = float(p.cropbox.width), float(p.cropbox.height)
            if int(p.get('/Rotate', 0)) % 180:
                w, h = h, w
            if not math.isfinite(w + h) or min(w, h) <= 0 or max(w, h) / min(w, h) > 10:
                raise ValueError('Unsupported PDF page dimensions.')
            scale = 1120 / max(w, h)
            dimensions.append((max(200, round(w * scale)), max(200, round(h * scale))))
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError('The PDF is damaged or cannot be read.') from exc
    source.seek(0)
    return dimensions

@endpoint
@require_http_methods(['POST'])
def upload_pdf(request, pk, board_id):
    c = room(request, pk, True)
    b = get_object_or_404(TeachingBoard.objects.defer('state'), pk=board_id, classroom=c)
    files = request.FILES.getlist('file')
    if len(files) != 1 or not 0 < files[0].size <= MAX_PDF_BYTES:
        raise ValueError('Choose one PDF file, up to 300 MB.')
    source = files[0]
    dimensions = validated_pdf_pages(source)
    asset = BoardPDF(board=b, name=source.name[:255], size=source.size)
    try:
        asset.file.save(f'{uuid.uuid4()}.pdf', source, save=False)
        with transaction.atomic():
            b = TeachingBoard.objects.select_for_update().get(pk=b.pk)
            existing = b.state['pages']
            if len(existing) == 1 and not existing[0].get('pdf') and not b.state['strokes']:
                existing = []  # Replace the untouched starter sheet with the document.
            if len(existing) + len(dimensions) > MAX_PAGES:
                raise ValueError('A lesson supports up to 200 pages. Create another lesson for this PDF.')
            asset.save()
            pages = [{'id': str(uuid.uuid4()), 'width': w, 'height': h, 'paper': 'plain', 'pdf': str(asset.pk), 'pdfPage': i + 1, 'name': asset.name} for i, (w, h) in enumerate(dimensions)]
            b.state = {**b.state, 'pages': existing + pages, 'active': pages[0]['id']}
            b.revision += 1
            b.save()
            # A document import invalidates deltas; reconnecting viewers get a fresh snapshot.
            b.events.all().delete()
    except Exception:
        if asset.file.name:
            asset.file.delete(save=False)
        raise
    return JsonResponse({'revision': b.revision, 'state': b.state, 'notification': committed_event(request, b, 'invalidate')}, status=201)

@endpoint
@require_http_methods(['GET'])
def pdf_content(request, pk, board_id, asset_id):
    c = room(request, pk)
    asset = get_object_or_404(BoardPDF, pk=asset_id, board__id=board_id, board__classroom=c)
    response = FileResponse(asset.file.open('rb'), content_type='application/pdf', as_attachment=False, filename=asset.name)
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response
