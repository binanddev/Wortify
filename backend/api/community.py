from functools import wraps
from django.conf import settings

def community_available(view):
    @wraps(view)
    def wrapped(request,*args,**kwargs):
        if not getattr(settings,'COMMUNITY_ENABLED',False):return JsonResponse({'error':'Lớp học và gửi bài chấm đang tạm ngắt để phát triển.'},status=503)
        return view(request,*args,**kwargs)
    return wrapped

from decimal import Decimal, InvalidOperation
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from users.models import Profile, Classroom, Review
from cards.models import StudySession, StudyAttempt, StudyProgress
from practice.models import Attempt
from .common import endpoint, body

def text(data, key, limit, required=False):
    value = data.get(key, '')
    if not isinstance(value, str) or len(value) > limit or (required and not value.strip()):
        raise ValueError('Nội dung không hợp lệ: ' + key)
    return value.strip()

def review_data(r):
    return {'id':r.pk,'attempt':r.attempt_id,'title':r.attempt.exercise.title,'student':r.attempt.user.username,'reviewer':r.reviewer.username,'classroom':r.classroom_id,'score':str(r.score) if r.score is not None else None,'feedback':r.feedback,'graded':r.graded_at is not None}

@endpoint
@require_http_methods(['GET','PATCH'])
def profile(request):
    p,_=Profile.objects.get_or_create(user=request.user)
    if request.method=='PATCH':
        data=body(request);p.display_name=text(data,'display_name',100);p.bio=text(data,'bio',2000);p.save()
    sessions=StudySession.objects.filter(user=request.user,language=request.language,completed_at__isnull=False).order_by('-completed_at')
    reviews=StudyAttempt.objects.filter(user=request.user,card__deck__language=request.language,completed_at__isnull=False).count()
    mastered=StudyProgress.objects.filter(user=request.user,card__deck__language=request.language,state='mastered').count()
    attempts=Attempt.objects.filter(user=request.user,exercise__chapter__book__language=request.language).select_related('exercise').order_by('-created_at')
    return JsonResponse({'username':request.user.username,'display_name':p.display_name,'bio':p.bio,'reviews':reviews,'mastered':mastered,'sessions':sessions.count(),'achievements':[label for passed,label in [(sessions.exists(),'Hoàn thành buổi học đầu tiên'),(reviews>=10,'Ôn tập 10 thẻ'),(reviews>=100,'Ôn tập 100 thẻ'),(mastered>=10,'Nắm vững 10 thẻ')] if passed],'history':[{'id':a.pk,'title':a.exercise.title,'status':a.status,'date':a.created_at.isoformat()} for a in attempts[:30]],'study_history':[{'token':str(s.token),'kind':s.kind,'result':s.result,'date':s.completed_at.isoformat()} for s in sessions[:20]]})

@endpoint
@require_http_methods(['GET','POST'])
@community_available
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
@community_available
def classroom(request,pk):
    c=get_object_or_404(Classroom.objects.filter(Q(owner=request.user)|Q(members=request.user)).distinct(),pk=pk,language=request.language)
    manager=c.owner_id==request.user.pk
    if request.method!='GET':
        if not manager: return JsonResponse({'error':'Chỉ người tạo lớp được quản lý lớp.'},status=403)
        if request.method=='DELETE':c.delete();return JsonResponse({'ok':True})
        data=body(request)
        if 'remove_member' in data:c.members.remove(data['remove_member'])
        if 'title' in data:c.title=text(data,'title',120,True);c.save(update_fields=['title'])
    return JsonResponse({'id':c.pk,'title':c.title,'owner':c.owner.username,'manage':manager,'invite':str(c.invite) if manager else None,'members':[{'id':u.pk,'username':u.username} for u in c.members.all()] if manager else [],'reviews':[review_data(r) for r in Review.objects.filter(classroom=c).filter(Q(reviewer=request.user)|Q(attempt__user=request.user)).select_related('attempt__exercise','attempt__user','reviewer')]})

@endpoint
@require_http_methods(['GET','POST'])
@community_available
def reviews(request):
    if request.method=='POST':
        data=body(request)
        a=get_object_or_404(Attempt,user=request.user,pk=data.get('attempt'),exercise__chapter__book__language=request.language)
        if a.exercise.check_mode=='auto_check' and not a.exercise.allow_review:raise ValueError('Bài này không hỗ trợ chấm lại.')
        c=None
        if data.get('classroom'):
            c=get_object_or_404(Classroom,members=request.user,pk=data['classroom'],language=request.language);reviewer=c.owner
        else:reviewer=get_object_or_404(get_user_model(),username=text(data,'reviewer',150,True),is_active=True)
        if reviewer==request.user:raise ValueError('Hãy chọn người khác để chấm bài.')
        r,created=Review.objects.get_or_create(attempt=a,defaults={'reviewer':reviewer,'classroom':c})
        if not created and (r.reviewer_id!=reviewer.pk or r.classroom_id!=(c.pk if c else None)):raise ValueError('Bài đã được gửi cho người chấm khác.')
        return JsonResponse(review_data(r),status=201 if created else 200)
    qs=Review.objects.filter(Q(reviewer=request.user)|Q(attempt__user=request.user),attempt__exercise__chapter__book__language=request.language).select_related('attempt__exercise','attempt__user','reviewer').order_by('-created_at')
    return JsonResponse({'reviews':[{**review_data(r),'can_grade':r.reviewer_id==request.user.pk} for r in qs]})

@endpoint
@require_http_methods(['GET','PATCH'])
@transaction.atomic
@community_available
def review(request,pk):
    r=get_object_or_404(Review.objects.select_for_update().filter(Q(reviewer=request.user)|Q(attempt__user=request.user)),pk=pk,attempt__exercise__chapter__book__language=request.language)
    if request.method=='PATCH':
        if r.reviewer_id!=request.user.pk:return JsonResponse({'error':'Bạn không phải người được giao chấm.'},status=403)
        data=body(request)
        try:score=Decimal(str(data.get('score')))
        except InvalidOperation:raise ValueError('Điểm phải từ 0 đến 10.')
        if not score.is_finite() or not 0<=score<=10:raise ValueError('Điểm phải từ 0 đến 10.')
        r.score=score.quantize(Decimal('.01'));r.feedback=text(data,'feedback',10000);r.graded_at=timezone.now();r.save()
        r.attempt.status='graded';r.attempt.teacher_feedback=r.feedback;r.attempt.save(update_fields=['status','teacher_feedback'])
    return JsonResponse({**review_data(r),'can_grade':r.reviewer_id==request.user.pk,'answers':r.attempt.answers})
