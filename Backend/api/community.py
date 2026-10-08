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
        raise ValueError('Invalid content: ' + key)
    return value.strip()


@endpoint
@require_http_methods(['GET','PATCH'])
def profile(request):
    from django.db import transaction
    from .profile_data import profile_data
    p,_=Profile.objects.get_or_create(user=request.user)
    if request.method=='PATCH':
        data=body(request)
        with transaction.atomic():
            p=Profile.objects.select_for_update().get(pk=p.pk)
            if 'display_name' in data:p.display_name=text(data,'display_name',100)
            if 'bio' in data:p.bio=text(data,'bio',2000)
            if 'daily_goal' in data:
                goal=data['daily_goal']
                if type(goal) is not int or not 1<=goal<=500:raise ValueError('The goal must be between 1 and 500 questions per day.')
                p.preferences={**p.preferences,'dailyGoals':{**p.preferences.get('dailyGoals',{}),request.language:goal}}
            p.save()
    return JsonResponse(profile_data(request,p))


@endpoint
@require_http_methods(['POST','DELETE'])
def classroom_assignments(request,pk):
    c=get_object_or_404(Classroom,pk=pk,owner=request.user,language=request.language)
    data=body(request)
    if request.method=='DELETE':
        c.assignments.filter(pk=data.get('id')).delete();return JsonResponse({'ok':True})
    node=get_object_or_404(visible(request),pk=data.get('node'))
    due=parse_datetime(data['due_at']) if data.get('due_at') else None
    if data.get('due_at') and not due:raise ValueError('Invalid assignment deadline.')
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
        if not manager: return JsonResponse({'error':'Only the class creator can manage the class.'},status=403)
        if request.method=='DELETE':c.delete();return JsonResponse({'ok':True})
        data=body(request)
        if 'remove_member' in data:c.members.remove(data['remove_member'])
        if 'title' in data:c.title=text(data,'title',120,True);c.save(update_fields=['title'])
    assignments=c.assignments.select_related('node')
    return JsonResponse({'id':c.pk,'title':c.title,'owner':c.owner.username,'manage':manager,'invite':str(c.invite) if manager else None,'members':[{'id':u.pk,'username':u.username} for u in c.members.all()] if manager else [],'assignments':[{'id':a.pk,'node':a.node_id,'title':a.node.title,'due_at':a.due_at.isoformat() if a.due_at else None} for a in assignments]})
