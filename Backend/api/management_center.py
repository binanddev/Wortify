from .grid import ordered
"""Operational workspace. Staff manage learning content, never privileged accounts."""
import hashlib
import json
from datetime import timedelta
from types import SimpleNamespace

from django.contrib.admin.models import LogEntry
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods

from practice.models import PracticeNode
from .common import body
from .management import management, audit
from .practice_hub import save_node


def content_row(node, full=False):
    data = {'id': node.pk, 'title': node.title, 'kind': node.kind,
            'language': node.language, 'visibility': node.visibility,
            'parent': node.parent_id, 'parent_title': node.parent.title if node.parent_id else '',
            'owner': {'id': node.owner_id, 'username': node.owner.username},
            'system': node.owner.is_staff or node.owner.is_superuser,
            'updated_at': node.updated_at, 'position': node.position}
    version = [node.title, node.parent_id, node.payload, node.visibility, node.position,
               node.updated_at.isoformat(), sorted(link.pk for link in node.links.all())]
    data['version'] = hashlib.sha256(json.dumps(version, sort_keys=True).encode()).hexdigest()
    if full:
        data['payload'] = node.payload
        data['links'] = version[-1]
    return data


def nodes():
    return PracticeNode.objects.select_related('owner', 'parent').prefetch_related('links')


@management('content.view')
@require_http_methods(['GET'])
def summary(request):
    users = get_user_model().objects.all()
    if not request.user.is_superuser:
        users = users.filter(is_staff=False, is_superuser=False)
    week = timezone.now() - timedelta(days=7)
    content = PracticeNode.objects.all()
    return JsonResponse({'users': users.count(), 'active': users.filter(is_active=True).count(),
                         'inactive': users.filter(is_active=False).count(),
                         'new_users': users.filter(date_joined__gte=week).count(),
                         'content': content.count(), 'public': content.filter(visibility='public').count(),
                         'private': content.filter(visibility='private').count(),
                         'recent_content': [content_row(n) for n in nodes().order_by('-updated_at', '-pk')[:6]]})


@management('content.view')
@require_http_methods(['GET'])
def activity(request):
    qs = LogEntry.objects.select_related('user', 'content_type').order_by('-action_time', '-pk')
    # Staff see their own work history; only Admin sees other operators' actions.
    if not request.user.is_superuser:
        qs = qs.filter(user=request.user)
    query = request.GET.get('q', '')[:100]
    if query:
        qs = qs.filter(Q(object_repr__icontains=query) | Q(change_message__icontains=query) | Q(user__username__icontains=query))
    qs=ordered(qs,request.GET.get('ordering',''),{'id':'pk','actor':'user__username','target':'object_repr','message':'change_message','at':'action_time'},['-action_time','-pk'])
    page = max(1, int(request.GET.get('page', 1)))
    return JsonResponse({'total': qs.count(), 'page': page, 'rows': [
        {'id': log.pk, 'at': log.action_time, 'actor': log.user.username,
         'target': log.object_repr, 'message': log.change_message}
        for log in qs[(page-1)*25:page*25]]})


@management('content.change')
@require_http_methods(['GET', 'POST'])
@transaction.atomic
def content(request):
    if request.method == 'POST':
        data = body(request)
        language = data.pop('language', 'en')
        if language not in ('en', 'de'):
            raise ValueError('Choose English or German.')
        # Content created by an operator belongs to that operator. Ownership
        # cannot be reassigned through a client-provided owner ID.
        if set(data) - {'title', 'kind', 'parent', 'payload', 'visibility', 'position', 'links'}:
            raise ValueError('Some fields cannot be edited.')
        node = save_node(SimpleNamespace(user=request.user, language=language), data)
        audit(request, node, f'Create content: {node.title}.', True)
        return JsonResponse(content_row(node, True), status=201)
    qs = nodes()
    if request.GET.get('options') == 'folders':
        return JsonResponse({'rows': list(PracticeNode.objects.filter(owner=request.user, kind='folder').order_by('title', 'pk').values('id', 'title', 'parent', 'language'))})
    query = request.GET.get('q', '')[:100]
    if query:
        qs = qs.filter(Q(title__icontains=query) | Q(owner__username__icontains=query))
    for field, allowed in [('language', ('en', 'de')), ('kind', ('folder', 'exercise', 'theory')),
                           ('visibility', ('public', 'private'))]:
        value = request.GET.get(field, '')
        if value:
            if value not in allowed:
                raise ValueError('Invalid filters.')
            qs = qs.filter(**{field: value})
    source = request.GET.get('source', '')
    if source == 'system': qs = qs.filter(Q(owner__is_staff=True) | Q(owner__is_superuser=True))
    elif source == 'users': qs = qs.filter(owner__is_staff=False, owner__is_superuser=False)
    elif source == 'mine': qs = qs.filter(owner=request.user)
    elif source: raise ValueError('Invalid content source.')
    if request.GET.get('owner'):
        qs = qs.filter(owner_id=int(request.GET['owner']))
    page = max(1, int(request.GET.get('page', 1)))
    return JsonResponse({'total': qs.count(), 'page': page, 'rows': [
        content_row(n) for n in ordered(qs,request.GET.get('ordering',''),{'title':'title','owner':'owner__username','kind':'kind','language':'language','visibility':'visibility','updated_at':'updated_at'},['-updated_at','-pk'])[(page-1)*25:page*25]]})


@management('content.change')
@require_http_methods(['GET', 'PATCH', 'DELETE'])
@transaction.atomic
def content_detail(request, pk):
    # Lock only the content row; parent is nullable and must not enter a
    # PostgreSQL FOR UPDATE outer join.
    get_object_or_404(PracticeNode.objects.select_for_update(), pk=pk)
    node = get_object_or_404(nodes(), pk=pk)
    if request.method == 'GET':
        result = content_row(node, True)
        result['folders'] = list(PracticeNode.objects.filter(owner=node.owner, language=node.language, kind='folder').exclude(pk=pk).values('id', 'title', 'parent'))
        result['children'] = node.children.count()
        return JsonResponse(result)
    data = body(request)
    if data.get('version') != content_row(node)['version']:
        return JsonResponse({'error': 'Content has changed. Close and reopen it to get the latest version before saving.'}, status=409)
    if request.method == 'DELETE':
        if data.get('confirm') != node.title:
            raise ValueError('Enter the exact content title to confirm deletion.')
        reason = data.get('reason', '')
        if not isinstance(reason, str) or not 3 <= len(reason.strip()) <= 500:
            raise ValueError('Enter a deletion reason (3–500 characters).')
        audit(request, node, f'Delete content and children: {node.title}. Reason: {reason}')
        node.delete()
        return JsonResponse({'ok': True})
    data.pop('version')
    reason = data.pop('reason', '')
    cascade = data.pop('cascade', False)
    if type(cascade) is not bool:
        raise ValueError('Invalid scope.')
    if not isinstance(reason, str) or len(reason) > 500:
        raise ValueError('Reasons must not exceed 500 characters.')
    if set(data) - {'title', 'parent', 'payload', 'visibility', 'position', 'links'}:
        raise ValueError('Owner, language and content type cannot be changed.')
    before = node.visibility
    if 'visibility' in data and (data['visibility'] != before or cascade) and len(reason.strip()) < 3:
        raise ValueError('Enter a reason for changing visibility (at least 3 characters).')
    node = save_node(SimpleNamespace(user=node.owner, language=node.language), data, node)
    changed = 1
    if cascade:
        if node.kind != 'folder' or 'visibility' not in data:
            raise ValueError('Cascading visibility applies to folder trees only.')
        frontier = [node.pk]
        descendants = set()
        while frontier:
            frontier = list(PracticeNode.objects.filter(parent_id__in=frontier, owner=node.owner).exclude(pk__in=descendants).values_list('pk', flat=True))
            descendants.update(frontier)
        changed += PracticeNode.objects.filter(pk__in=descendants).update(visibility=node.visibility)
    audit(request, node, f'Edit content: {node.title}. Status {before} → {node.visibility}; {changed} items. {reason}')
    return JsonResponse(content_row(node, True))


@management('content.change')
@require_http_methods(['POST'])
def content_upload(request, pk):
    """Store editorial uploads under the content owner, using normal validation."""
    from .practice_media import upload
    node = get_object_or_404(PracticeNode, pk=pk, kind='exercise')
    operator = request.user
    request.user, request.language = node.owner, node.language
    try:
        response = upload(request)
    finally:
        request.user = operator
    if response.status_code == 201:
        audit(request, node, f'Upload media for content: {node.title}.')
    return response
