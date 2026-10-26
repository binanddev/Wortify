"""Owner-scoped organization for the private Reading library."""
from copy import deepcopy

from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import Http404, JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods

from practice.models import ReadingFolder, ReadingLesson
from .common import body, endpoint
from .content_workspace import content_owner, forced_visibility, is_editor, scope
from .practice_media import validated_attachments

MAX_FOLDER_DEPTH = 20
MAX_BATCH = 100


def locked_owner(request):
    owner = content_owner(request)
    get_user_model().objects.select_for_update().get(pk=owner.pk)
    return owner


def title_value(value):
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 200:
        raise ValueError('Reading title must contain 1–200 characters.')
    return value.strip()


def folder_data(folder):
    return {'id': folder.pk, 'title': folder.title, 'parent_id': folder.parent_id}


def destination(request, value, owner=None):
    """Validate a destination and every ancestor, including legacy imported trees."""
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError('Choose a reading folder.')
    owner = owner or content_owner(request)
    rows = {row.pk: row for row in ReadingFolder.objects.filter(owner=owner, language=request.language)}
    folder = rows.get(value)
    if folder is None:
        raise Http404
    current, seen = folder, set()
    while current:
        if current.pk in seen:
            raise ValueError('Reading folders cannot contain a cycle.')
        seen.add(current.pk)
        if len(seen) > MAX_FOLDER_DEPTH:
            raise ValueError('Reading folders support at most 20 levels.')
        if current.parent_id is None:
            break
        current = rows.get(current.parent_id)
        if current is None:
            raise ValueError('The folder hierarchy is not available in this account and language.')
    return folder


def branch(request, root, owner):
    rows = list(ReadingFolder.objects.filter(owner=owner, language=request.language))
    children = {}
    for folder in rows:
        children.setdefault(folder.parent_id, []).append(folder)
    ids, levels, pending = set(), 0, [root.pk]
    while pending:
        levels += 1
        following = []
        for pk in pending:
            if pk in ids:
                raise ValueError('Reading folders cannot contain a cycle.')
            ids.add(pk)
            following.extend(folder.pk for folder in children.get(pk, []))
        pending = following
    # Do not let a malformed historical relation modify another owner's tree.
    if ReadingFolder.objects.filter(parent_id__in=ids).exclude(owner=owner, language=request.language).exists():
        raise ValueError('The folder hierarchy is not available in this account and language.')
    return ids, levels


def depth(folder):
    count = 0
    while folder:
        count += 1
        folder = folder.parent
    return count


@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def create_folder(request):
    owner, data = locked_owner(request), body(request)
    parent = destination(request, data.get('parent_id'), owner)
    if depth(parent) >= MAX_FOLDER_DEPTH:
        raise ValueError('Reading folders support at most 20 levels.')
    folder = ReadingFolder.objects.create(owner=owner, language=request.language,
                                         title=title_value(data.get('title')), parent=parent)
    return JsonResponse({'folder': folder_data(folder)}, status=201)


@endpoint
@require_http_methods(['PATCH', 'DELETE'])
@transaction.atomic
def folder_detail(request, pk):
    owner = locked_owner(request)
    folder = get_object_or_404(ReadingFolder.objects.select_for_update(), pk=pk,
                               owner=owner, language=request.language)
    if request.method == 'DELETE':
        ids, _ = branch(request, folder, owner)
        parent = destination(request, folder.parent_id, owner)
        if parent and parent.pk in ids:
            raise ValueError('Reading folders cannot contain a cycle.')
        if ReadingLesson.objects.filter(folder_id__in=ids).exclude(owner=owner, language=request.language).exists():
            raise ValueError('The folder contains readings outside this account or language.')
        ReadingLesson.objects.filter(owner=owner, language=request.language, folder_id__in=ids).update(folder=parent)
        ReadingFolder.objects.filter(pk=folder.pk, owner=owner, language=request.language).delete()
        return JsonResponse({'ok': True})
    data = body(request)
    if not any(key in data for key in ('title', 'parent_id')):
        raise ValueError('Choose a folder change.')
    if 'title' in data:
        folder.title = title_value(data['title'])
    if 'parent_id' in data:
        parent = destination(request, data['parent_id'], owner)
        ids, height = branch(request, folder, owner)
        if parent and parent.pk in ids:
            raise ValueError('A folder cannot be moved into itself or one of its subfolders.')
        if depth(parent) + height > MAX_FOLDER_DEPTH:
            raise ValueError('Reading folders support at most 20 levels.')
        folder.parent = parent
    folder.save(update_fields=['title', 'parent'])
    return JsonResponse({'folder': folder_data(folder)})


@endpoint
@require_http_methods(['PATCH'])
@transaction.atomic
def metadata(request, pk):
    owner, data = locked_owner(request), body(request)
    lesson = get_object_or_404(ReadingLesson.objects.select_for_update(), pk=pk,
                               owner=owner, language=request.language)
    values = {}
    if 'title' in data:
        values['title'] = title_value(data['title'])
    if 'folder_id' in data:
        values['folder'] = destination(request, data['folder_id'], owner)
    if not values:
        raise ValueError('Choose a reading change.')
    # Organization is not a content revision and must not clear learning progress.
    ReadingLesson.objects.filter(pk=lesson.pk).update(**values)
    lesson.refresh_from_db()
    from .reading import serialized
    return JsonResponse(serialized(lesson, request.user))


@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def organize(request):
    owner, data = locked_owner(request), body(request)
    action, ids = data.get('action'), data.get('ids')
    if action not in ('move', 'copy', 'delete'):
        raise ValueError('Choose move, copy or delete.')
    if (not isinstance(ids, list) or not 1 <= len(ids) <= MAX_BATCH or
            any(isinstance(pk, bool) or not isinstance(pk, int) or pk <= 0 for pk in ids) or len(set(ids)) != len(ids)):
        raise ValueError('Choose between 1 and 100 different readings.')
    rows = list(ReadingLesson.objects.select_for_update().filter(pk__in=ids, owner=owner,
                                                                 language=request.language).order_by('pk'))
    if len(rows) != len(ids):
        raise Http404
    if action == 'delete':
        ReadingLesson.objects.filter(pk__in=ids, owner=owner, language=request.language).delete()
        return JsonResponse({'ok': True, 'ids': ids})
    folder = destination(request, data.get('folder_id'), owner)
    if action == 'move':
        ReadingLesson.objects.filter(pk__in=ids, owner=owner, language=request.language).update(folder=folder)
        return JsonResponse({'ok': True, 'ids': ids})
    if is_editor(request.user) and scope(request) == 'shared':
        raise ValueError('Switch to Personal sandbox to save a personal copy. Use Bulk import to publish reviewed content as Wortify.')
    copied = []
    token = forced_visibility.set('private')
    try:
        for lesson in rows:
            payload = deepcopy(lesson.payload)
            attachments = validated_attachments(request, payload)
            clone = ReadingLesson.objects.create(owner=owner, language=request.language, folder=folder,
                title=lesson.title, payload=payload, level=lesson.level, topic=lesson.topic,
                visibility='private', completed=[], source_key='')
            clone.attachments.set(attachments)
            copied.append(clone.pk)
    finally:
        forced_visibility.reset(token)
    return JsonResponse({'ok': True, 'ids': copied})
