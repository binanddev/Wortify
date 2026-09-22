from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from django.utils.dateparse import parse_datetime
from users.models import Profile, Classroom, ClassroomAssignment
from practice.models import PracticeAttempt
from cards.models import StudyProgress, LearningEvent
from .common import endpoint, body
from .practice_hub import visible
def text(data, key, limit, required=False):
    value = data.get(key, '')
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise ValueError('Nội dung không hợp lệ: ' + key)
    return value.strip()


@endpoint
@require_http_methods(['GET','PATCH'])
def profile(request):
    p,_=Profile.objects.get_or_create(user=request.user)
    if request.method=='PATCH':
        data=body(request);p.display_name=text(data,'display_name',100);p.bio=text(data,'bio',2000);p.save()
    events=LearningEvent.objects.filter(user=request.user,language=request.language)
    attempts=PracticeAttempt.objects.filter(user=request.user,node__language=request.language).select_related('node').order_by('-created_at')
    mastered=StudyProgress.objects.filter(user=request.user,card__deck__language=request.language,state='mastered').count()
    return JsonResponse({'username':request.user.username,'display_name':p.display_name,'bio':p.bio,'reviews':events.filter(kind='review').count(),'mastered':mastered,'sessions':events.filter(kind__in=['test','practice']).count(),'achievements':['Nắm vững thẻ đầu tiên'] if mastered else [],'history':[{'id':a.pk,'node':a.node_id,'title':a.node.title,'score':a.result['score'],'total':a.result['total'],'date':a.created_at.isoformat()} for a in attempts[:30]],'study_history':[{'token':str(e.token),'kind':e.kind,'result':e.result,'date':e.created_at.isoformat()} for e in events.filter(kind='test').order_by('-created_at')[:20]]})

@endpoint
@require_http_methods(['POST','DELETE'])
def classroom_assignments(request,pk):
    c=get_object_or_404(Classroom,pk=pk,owner=request.user,language=request.language)
    data=body(request)
    if request.method=='DELETE':
        c.assignments.filter(pk=data.get('id')).delete();return JsonResponse({'ok':True})
    node=get_object_or_404(visible(request),pk=data.get('node'))
    due=parse_datetime(data['due_at']) if data.get('due_at') else None
    if data.get('due_at') and not due:raise ValueError('Hạn làm bài không hợp lệ.')
    a,_=ClassroomAssignment.objects.update_or_create(classroom=c,node=node,defaults={'assigned_by':request.user,'due_at':due})
    return JsonResponse({'id':a.pk},status=201)
@endpoint
@require_http_methods(['GET','POST'])
def classes(request):
    if request.method=='POST':
        data=body(request)
        if data.get('invite'):
            c=get_object_or_404(Classroom,invite=data['invite'],language=request.language);c.members.add(request.user)
        else:
            c=Classroom.objects.create(owner=request.user,language=request.language,title=text(data,'title',120,True))
        return JsonResponse({'id':c.pk},status=201)
    qs=Classroom.objects.filter(Q(owner=request.user)|Q(members=request.user),language=request.language).distinct()
    return JsonResponse({'classes':[{'id':c.pk,'title':c.title,'owner':c.owner.username,'manage':c.owner_id==request.user.pk} for c in qs.select_related('owner')]})

@endpoint
@require_http_methods(['GET','PATCH','DELETE'])
def classroom(request,pk):
    c=get_object_or_404(Classroom.objects.filter(Q(owner=request.user)|Q(members=request.user)).distinct(),pk=pk,language=request.language)
    manager=c.owner_id==request.user.pk
    if request.method!='GET':
        if not manager: return JsonResponse({'error':'Chỉ người tạo lớp được quản lý lớp.'},status=403)
        if request.method=='DELETE':c.delete();return JsonResponse({'ok':True})
        data=body(request)
        if 'remove_member' in data:c.members.remove(data['remove_member'])
        if 'title' in data:c.title=text(data,'title',120,True);c.save(update_fields=['title'])
    assignments=c.assignments.select_related('node')
    return JsonResponse({'id':c.pk,'title':c.title,'owner':c.owner.username,'manage':manager,'invite':str(c.invite) if manager else None,'members':[{'id':u.pk,'username':u.username} for u in c.members.all()] if manager else [],'assignments':[{'id':a.pk,'node':a.node_id,'title':a.node.title,'due_at':a.due_at.isoformat() if a.due_at else None} for a in assignments]})
