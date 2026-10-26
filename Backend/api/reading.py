from .content_workspace import content_owner
from copy import deepcopy
from datetime import timedelta
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from practice.models import ReadingLesson, ReadingFolder, ReadingProgress
from .common import endpoint, body
from .practice_hub import validate_payload
from .practice_media import validated_attachments


def serialized(lesson, user=None):
    completed = lesson.completed
    if user and lesson.owner_id != user.pk:
        progress = ReadingProgress.objects.filter(user=user,lesson=lesson,revision=lesson.updated_at.isoformat()).first()
        completed = progress.completed if progress else []
    return {'id':lesson.pk,'folder_id':lesson.folder_id,'title':lesson.title,'visibility':lesson.visibility,'level':lesson.level,'topic':lesson.topic,'payload':lesson.payload,'progress':{'completed':completed},'revision':lesson.updated_at.isoformat()}


def content(request, data):
    payload = deepcopy(data.get('payload', {}))
    if not isinstance(payload, dict) or not isinstance(payload.get('presentation'),dict) or payload['presentation'].get('interaction') != 'reading':
        raise ValueError('Import a reading lesson (TYPE: reading).')
    payload = validate_payload('exercise', payload)
    title = data.get('title',payload.get('title',''))
    if not isinstance(title,str) or not 1 <= len(title.strip()) <= 200:
        raise ValueError('Reading title must contain 1â€“200 characters.')
    validated_attachments(request,payload)
    payload['title'] = title.strip()
    return title.strip(), payload


@endpoint
@require_http_methods(['GET','POST'])
@transaction.atomic
def library(request):
    if request.method == 'GET':
        return JsonResponse({'folders':list(ReadingFolder.objects.filter(owner=content_owner(request),language=request.language).values('id','title','parent_id')), 'lessons':list(ReadingLesson.objects.filter(owner=content_owner(request),language=request.language).order_by('-updated_at').values('id','title','updated_at','folder_id','visibility','level','topic'))})
    from .reading_management import locked_owner, destination
    owner = locked_owner(request)
    data = body(request)
    folder = destination(request, data.get('folder_id'), owner)
    entries = data.get('lessons')
    if not isinstance(entries,list) or not 1 <= len(entries) <= 100 or any(not isinstance(d,dict) for d in entries):
        raise ValueError('Import between 1 and 100 reading lessons.')
    result=[]
    for data in entries:
        title,payload = content(request,data)
        lesson = ReadingLesson.objects.create(owner=owner,language=request.language,folder=folder,title=title,payload=payload)
        lesson.attachments.set(validated_attachments(request,payload))
        result.append(serialized(lesson, request.user))
    return JsonResponse({'lessons':result},status=201)


@endpoint
@require_http_methods(['GET','PATCH','POST','DELETE'])
@transaction.atomic
def detail(request, pk):
    lessons = ReadingLesson.objects.all()
    if request.method != 'GET':
        lessons = lessons.select_for_update()
    lesson = get_object_or_404(lessons,pk=pk,owner=content_owner(request),language=request.language)
    if request.method == 'GET': return JsonResponse(serialized(lesson, request.user))
    if request.method == 'DELETE':
        lesson.delete()
        return JsonResponse({'ok':True})
    data=body(request)
    if data.get('revision') != lesson.updated_at.isoformat():
        return JsonResponse({'error':'This reading has changed. Reload it before continuing.'},status=409)
    if request.method == 'POST':
        completed=data.get('completed',[])
        valid={q['id'] for q in lesson.payload['questions'] if not q.get('example')}
        if not isinstance(completed,list) or any(not isinstance(i,str) or i not in valid for i in completed):
            raise ValueError('Invalid reading progress.')
        if lesson.owner_id == request.user.pk:
            lesson.completed=sorted(set(lesson.completed + completed))
            lesson.save(update_fields=['completed'])
        else:
            progress, _ = ReadingProgress.objects.get_or_create(user=request.user,lesson=lesson,defaults={'revision':data['revision']})
            previous = progress.completed if progress.revision == data['revision'] else []
            progress.completed=sorted(set(previous + completed))
            progress.revision=data['revision']
            progress.save()
    else:
        lesson.title,lesson.payload=content(request,data)
        lesson.attachments.set(validated_attachments(request,lesson.payload))
        lesson.completed=[]
        previous_revision = lesson.updated_at
        lesson.save()
        # Fast saves can share a clock tick; every content edit must invalidate
        # progress submissions from the previous revision.
        if lesson.updated_at <= previous_revision:
            lesson.updated_at = previous_revision + timedelta(microseconds=1)
            ReadingLesson.objects.filter(pk=lesson.pk).update(updated_at=lesson.updated_at)
    return JsonResponse(serialized(lesson, request.user))


LEVELS = ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')


def metadata(data):
    level = data.get('level', '')
    topic = data.get('topic', '')
    if level not in ('', *LEVELS):
        raise ValueError('Choose a level from A1 to C2.')
    if not isinstance(topic, str) or len(topic.strip()) > 80:
        raise ValueError('Topic must contain at most 80 characters.')
    return {'level': level, 'topic': topic.strip()}


@endpoint
@require_http_methods(['PATCH'])
@transaction.atomic
def sharing(request, pk):
    lesson = get_object_or_404(ReadingLesson.objects.select_for_update(), pk=pk, owner=content_owner(request), language=request.language)
    data = body(request)
    visibility = data.get('visibility')
    if visibility not in ('private', 'public'):
        raise ValueError('Choose private or public.')
    values = metadata(data)
    lesson.visibility = visibility
    lesson.level = values['level']
    lesson.topic = values['topic']
    # Establish media access only for files already owned by this author.
    lesson.attachments.set(validated_attachments(request, lesson.payload))
    lesson.save(update_fields=['visibility', 'level', 'topic'])
    return JsonResponse(serialized(lesson, request.user))
