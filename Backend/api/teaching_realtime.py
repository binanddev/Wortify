"""Short-lived relay credentials and signed, already-committed events.

The relay never needs database access, session cookies, or outbound Django calls.
"""
import base64
import hashlib
import hmac
import json
import time
from urllib.parse import urlsplit
from django.conf import settings
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from users.models import TeachingBoard
from .common import endpoint


def configuration():
    url = settings.TEACHING_REALTIME_URL.strip()
    if not url:
        return None
    parsed = urlsplit(url)
    if parsed.scheme not in ('wss', 'ws') or not parsed.hostname or parsed.path != '/ws' or parsed.query or parsed.fragment or parsed.username or (parsed.scheme == 'ws' and not settings.DEBUG):
        raise ValueError('Set TEACHING_REALTIME_URL to the relay wss://host/ws address.')
    if len(settings.TEACHING_REALTIME_SECRET) < 32:
        raise ValueError('Configure the same TEACHING_REALTIME_SECRET (at least 32 characters) on Django and the relay.')
    return url


def sign(scope, payload):
    now = int(time.time())
    value = {'v': 1, 'iat': now, 'exp': now + 60, **payload}
    data = base64.urlsafe_b64encode(json.dumps(value, separators=(',', ':'), ensure_ascii=True).encode()).rstrip(b'=').decode()
    signature = hmac.new(settings.TEACHING_REALTIME_SECRET.encode(), f'wortify-teaching-{scope}.v1.{data}'.encode(), hashlib.sha256).hexdigest()
    return {'data': data, 'signature': signature}


def committed_event(request, board, kind, batch=None, operations=None, revision=None):
    # A relay configuration error must never fail a durable board save.
    try:
        if not configuration():
            return None
    except ValueError:
        return None
    payload = {'room': str(board.pk), 'user': request.user.pk, 'kind': kind, 'revision': board.revision if revision is None else revision}
    payload['public_access'] = board.public_version if board.public_enabled else None
    if kind == 'batch':
        payload.update(batch=str(batch), operations=operations)
    return sign('event', payload)


@endpoint
@require_http_methods(['POST'])
def ticket(request, pk, board_id):
    from .teaching import room
    classroom = room(request, pk)
    board = get_object_or_404(TeachingBoard.objects.only('id'), pk=board_id, classroom=classroom)
    url = configuration()
    if not url:
        return JsonResponse({'enabled': False})
    from .teaching_local import ensure_local_relay
    if not ensure_local_relay():return JsonResponse({'enabled':False})
    proof = sign('ticket', {'room': str(board.pk), 'user': request.user.pk, 'write': classroom.owner_id == request.user.pk})
    return JsonResponse({'enabled': True, 'url': url, 'ticket': proof})
