from copy import deepcopy
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from practice.models import ReadingLesson
from .common import endpoint, body
from .practice_hub import validate_payload
from .practice_media import validated_attachments


def serialized(lesson):
    return {'id':lesson.pk,'title':lesson.title,'payload':lesson.payload,'progress':{'completed':lesson.completed},'revision':lesson.updated_at.isoformat()}


def content(request, data):
    payload = deepcopy(data.get('payload', {}))
    if not isinstance(payload, dict) or not isinstance(payload.get('presentation'),dict) or payload['presentation'].get('interaction') != 'reading':
        raise ValueError('Import a reading lesson (TYPE: reading).')
    payload = validate_payload('exercise', payload)
    title = data.get('title',payload.get('title',''))
    if not isinstance(title,str) or not 1 <= len(title.strip()) <= 200:
        raise ValueError('Reading title must contain 1–200 characters.')
    validated_attachments(request,payload)
    payload['title'] = title.strip()
    return title.strip(), payload


@endpoint
@require_http_methods(['GET','POST'])
@transaction.atomic
def library(request):
    if request.method == 'GET':
        return JsonResponse({'lessons':list(ReadingLesson.objects.filter(owner=request.user,language=request.language).order_by('-updated_at').values('id','title','updated_at'))})
    entries = body(request).get('lessons')
    if not isinstance(entries,list) or not 1 <= len(entries) <= 100 or any(not isinstance(d,dict) for d in entries):
        raise ValueError('Import between 1 and 100 reading lessons.')
    result=[]
    for data in entries:
        title,payload = content(request,data)
        lesson = ReadingLesson.objects.create(owner=request.user,language=request.language,title=title,payload=payload)
        result.append(serialized(lesson))
    return JsonResponse({'lessons':result},status=201)


@endpoint
@require_http_methods(['GET','PATCH','POST','DELETE'])
@transaction.atomic
def detail(request, pk):
    lessons = ReadingLesson.objects.all()
    if request.method != 'GET':
        lessons = lessons.select_for_update()
    lesson = get_object_or_404(lessons,pk=pk,owner=request.user,language=request.language)
    if request.method == 'GET': return JsonResponse(serialized(lesson))
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
        lesson.completed=sorted(set(lesson.completed + completed))
        lesson.save(update_fields=['completed'])
    else:
        lesson.title,lesson.payload=content(request,data)
        lesson.completed=[]
        lesson.save()
    return JsonResponse(serialized(lesson))
