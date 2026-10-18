"""Shared file, raw-text and small JSON-envelope input for staff and bots."""
import json
from .common import body
from .content_text import parse_package

MAX_BYTES = 50 * 1024 * 1024


def decode_text(text):
    if not isinstance(text, str) or len(text.encode('utf-8')) > MAX_BYTES:
        raise ValueError('Use a UTF-8 content file up to 50 MB.')
    normalized=text.lstrip('\ufeff').strip()
    if normalized.startswith('{'):
        try: return json.loads(normalized), False
        except (ValueError, RecursionError): raise ValueError('Invalid JSON file.')
    return parse_package(normalized), True


def import_input(request):
    if request.content_type in ('application/json','text/plain') and int(request.META.get('CONTENT_LENGTH') or 0) > 8*1024*1024:
        raise ValueError('Direct text/JSON requests are limited to 8 MB. Use a multipart file up to 50 MB.')
    file=request.FILES.get('file')
    params=request.POST if file else request.GET
    if file:
        if file.size > MAX_BYTES: raise ValueError('Use a UTF-8 content file up to 50 MB.')
        try: text=file.read().decode('utf-8-sig')
        except UnicodeError: raise ValueError('Use UTF-8 text.')
    elif request.content_type == 'application/json':
        params=body(request)
        text=params.get('text')
    elif request.content_type == 'text/plain':
        if len(request.body)>MAX_BYTES: raise ValueError('Use a UTF-8 content file up to 50 MB.')
        try: text=request.body.decode('utf-8-sig')
        except UnicodeError: raise ValueError('Use UTF-8 text.')
    else: raise ValueError('Send a .txt/.json file, text/plain body, or JSON with a text field.')
    document, compact=decode_text(text)
    return document, dict(preview=params.get('preview') in (True,'true'), confirm=params.get('confirm'), preview_token=params.get('preview_token') or request.headers.get('X-Wortify-Preview'), require_preview=compact)
