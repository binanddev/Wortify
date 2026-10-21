"""Revocable, staff-owned keys scoped exclusively to system-content imports."""
import hashlib
import json
import secrets
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from users.models import ContentImportKey
from .management import management, audit
from .common import endpoint
from .content_packages import MAX_BYTES, publish_document


@management('content.import')
@require_http_methods(['GET', 'POST', 'DELETE'])
@transaction.atomic
def settings(request):
    get_user_model().objects.select_for_update().get(pk=request.user.pk)
    if request.method == 'DELETE':
        ContentImportKey.objects.filter(user=request.user).delete()
        audit(request, request.user, 'Disabled content import API.')
        return JsonResponse({'enabled': False})
    if request.method == 'POST':
        raw = 'wti_' + secrets.token_urlsafe(32)
        key, _ = ContentImportKey.objects.update_or_create(user=request.user, defaults={
            'digest': hashlib.sha256(raw.encode()).hexdigest(), 'prefix': raw[:12], 'last_used_at': None})
        audit(request, request.user, 'Enabled or rotated content import API key.')
        response = JsonResponse({'enabled': True, 'key': raw, 'prefix': key.prefix, 'created_at': key.created_at})
    else:
        key = ContentImportKey.objects.filter(user=request.user).first()
        response = JsonResponse({'enabled': bool(key), **({'prefix': key.prefix, 'created_at': key.created_at, 'last_used_at': key.last_used_at} if key else {})})
    response['Cache-Control'] = 'no-store'
    return response


@csrf_exempt
@require_http_methods(['GET','POST'])
def upload(request):
    # This route never accepts session authentication; exemption applies only to bearer keys.
    scheme, _, raw = request.headers.get('Authorization', '').partition(' ')
    if scheme.lower() != 'bearer' or not raw.startswith('wti_') or len(raw) > 100:
        return JsonResponse({'error': 'A valid content import API key is required.'}, status=401)
    key = ContentImportKey.objects.select_related('user').filter(digest=hashlib.sha256(raw.encode()).hexdigest()).first()
    if not key or not key.user.is_active or not (key.user.is_staff or key.user.is_superuser):
        return JsonResponse({'error': 'This import key is invalid, disabled or no longer permitted.'}, status=401)
    request.user = key.user
    response = _import(request)
    if response.status_code < 400:
        ContentImportKey.objects.filter(pk=key.pk, digest=key.digest).update(last_used_at=timezone.now())
    response['Cache-Control'] = 'no-store'
    return response


@endpoint
def _import(request):
    from .content_input import import_input
    if request.method == 'GET':
        from .content_merge import catalog
        return catalog(request)
    document, options = import_input(request)
    return publish_document(request, document, **options)
