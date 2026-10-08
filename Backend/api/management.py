"""Separate administrative API; learner ownership rules remain unchanged."""
import json
import mimetypes
import uuid
from functools import wraps
from pathlib import Path
from django.contrib.auth import get_user_model, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.admin.models import LogEntry, CHANGE, ADDITION
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Count, Q
from django.http import JsonResponse, FileResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from content.models import SiteAppearance
from .common import endpoint,body

def management(permission):
    def decorate(view):
        @endpoint
        @wraps(view)
        def wrapped(request,*args,**kwargs):
            if not request.user.is_active or not (request.user.is_superuser or (request.user.is_staff and permission.startswith(('auth.', 'content.')))):
                return JsonResponse({'error':'You cannot manage this item.'},status=403)
            return view(request,*args,**kwargs)
        return wrapped
    return decorate

def _appearance_payload(item):
    return {
        'background_image': bool(item.background_image),
        'background_url': f'/api/site/appearance/image/?v={item.updated_at.timestamp()}' if item.background_image else '',
        'updated_at': item.updated_at.isoformat(),
    }

@management('site.change_appearance')
@require_http_methods(['GET', 'POST', 'DELETE'])
def site_appearance(request):
    item, _ = SiteAppearance.objects.get_or_create(pk=1)
    if request.method == 'DELETE':
        if item.background_image:
            item.background_image.delete(save=False)
            item.background_image = ''
            item.save(update_fields=['background_image', 'updated_at'])
            audit(request, item, 'Remove shared background.')
        return JsonResponse(_appearance_payload(item))
    if request.method == 'POST':
        upload = request.FILES.get('background_image')
        if not upload:
            raise ValueError('Choose a background image.')
        from .themes import validate_image
        validate_image(upload)
        if item.background_image:
            item.background_image.delete(save=False)
        item.background_image = upload
        item.save()
        audit(request, item, 'Update shared background.')
    return JsonResponse(_appearance_payload(item))

@endpoint
@require_http_methods(['GET'])
def public_appearance(request):
    item = SiteAppearance.objects.filter(pk=1).first()
    return JsonResponse(_appearance_payload(item) if item else {
        'background_image': False,
        'background_url': '',
    })

@endpoint
@require_http_methods(['GET'])
def site_appearance_image(request):
    item = get_object_or_404(SiteAppearance, pk=1)
    if not item.background_image:
        return JsonResponse({'error': 'No background image yet.'}, status=404)
    response = FileResponse(item.background_image.open('rb'), content_type=mimetypes.guess_type(item.background_image.name)[0] or 'application/octet-stream')
    response['Cache-Control'] = 'private, max-age=300'
    return response

def audit(request,obj,message,created=False):
    LogEntry.objects.log_actions(user_id=request.user.pk,queryset=[obj],action_flag=ADDITION if created else CHANGE,change_message=message)

@management('auth.view_user')
@require_http_methods(['GET','POST'])
@transaction.atomic
def users(request):
    User=get_user_model()
    if request.method=='POST':
        if not (request.user.is_staff or request.user.is_superuser):return JsonResponse({'error':'You cannot create accounts.'},status=403)
        data=body(request);username=data.get('username','')
        if not isinstance(username,str) or not username.strip():raise ValueError('Enter a username.')
        user=User(username=username,email=data.get('email',''),first_name=data.get('first_name',''),last_name=data.get('last_name',''));user.full_clean(exclude=['password']);validate_password(data.get('password',''),user)
        role=data.get('role','user')
        if role not in ('user','staff','superuser'):raise ValueError('Invalid role.')
        if not request.user.is_superuser and role != 'user':return JsonResponse({'error':'Staff can create regular accounts only.'},status=403)
        user.is_staff=role in ('staff','superuser');user.is_superuser=role=='superuser'
        user.set_password(data['password']);user.save();audit(request,user,f'Create account · role {role}.',True)
        return JsonResponse({'id':user.pk},status=201)
    q=request.GET.get('q','')[:100];qs=User.objects.filter(Q(username__icontains=q)|Q(email__icontains=q)).order_by('username')
    if not request.user.is_superuser:qs=qs.filter(is_staff=False,is_superuser=False)
    role=request.GET.get('role', '')
    if role == 'user': qs=qs.filter(is_staff=False,is_superuser=False)
    elif role == 'staff': qs=qs.filter(is_staff=True,is_superuser=False)
    elif role == 'superuser': qs=qs.filter(is_superuser=True)
    elif role: raise ValueError('Invalid role.')
    status=request.GET.get('status', '')
    if status in ('active','inactive'): qs=qs.filter(is_active=status=='active')
    elif status: raise ValueError('Invalid status.')
    sorts={'username':'username','newest':'-date_joined','recent':'-last_login'}
    order=request.GET.get('sort','username')
    if order not in sorts: raise ValueError('Invalid order.')
    qs=qs.order_by(sorts[order], 'pk')
    page=max(1,int(request.GET.get('page',1)));total=qs.count()
    return JsonResponse({'users':list(qs[(page-1)*50:page*50].values('id','username','email','is_active','is_staff','is_superuser','last_login','date_joined','first_name','last_name')),'total':total,'page':page,'can_add':True,'can_edit':True,'superuser':request.user.is_superuser})

@management('auth.change_user')
@require_http_methods(['GET','PATCH','DELETE'])
@transaction.atomic
def user_detail(request,pk):
    User=get_user_model()
    if request.method != 'GET' and request.user.is_superuser:
        list(User.objects.select_for_update().filter(is_superuser=True).order_by('pk'))
    user=managed_user(request, pk, lock=True)
    if request.method=='GET':
        logs=LogEntry.objects.filter(content_type=ContentType.objects.get_for_model(User),object_id=str(pk)).order_by('-action_time')[:30]
        return JsonResponse({'logs':[{'at':l.action_time.isoformat(),'message':l.change_message,'actor':l.user.username} for l in logs]})
    if request.method=='DELETE':
        if user.pk==request.user.pk:raise ValueError('You cannot delete your current account.')
        if user.is_superuser and User.objects.filter(is_superuser=True,is_active=True).count()<=1:raise ValueError('At least one active superuser must remain.')
        from users.models import ClassroomAssignment
        ClassroomAssignment.objects.filter(assigned_by=user).delete()
        data=body(request)
        if data.get('confirm') != user.username: raise ValueError('Enter the exact username to confirm.')
        reason=data.get('reason','')
        if not isinstance(reason,str) or not 3 <= len(reason.strip()) <= 500: raise ValueError('Enter a deletion reason (3–500 characters).')
        revoke_sessions(user);audit(request,user,f'Delete account and personal data. Reason: {reason}');user.delete()
        return JsonResponse({'ok':True})
    data=body(request)
    previous={key:getattr(user,key) for key in ('username','email','first_name','last_name','is_staff','is_superuser','is_active')}
    for key in ['username','email','first_name','last_name']:
        if key in data:
            if not isinstance(data[key],str):raise ValueError('Invalid account details.')
            setattr(user,key,data[key])
    if not request.user.is_superuser and (data.get('role', 'user') != 'user' or any(k in data for k in ('is_staff','is_superuser','groups','user_permissions'))):
        return JsonResponse({'error':'You cannot change administrative roles.'},status=403)
    was_active_superuser = user.is_superuser and user.is_active
    if 'role' in data:
        if data['role'] not in ('user','staff','superuser'):raise ValueError('Invalid role.')
        if user.pk==request.user.pk and data['role']!='superuser':raise ValueError('You cannot remove your own administrative role.')
        user.is_superuser=data['role']=='superuser';user.is_staff=data['role'] in ('staff','superuser')
    if 'is_active' in data:
        if type(data['is_active']) is not bool:raise ValueError('Invalid status.')
        if user.pk==request.user.pk and not data['is_active']:raise ValueError('You cannot lock your current account.')
        user.is_active=data['is_active']
    if data.get('password'):
        if not isinstance(data['password'],str):raise ValueError('Invalid password.')
        validate_password(data['password'],user);user.set_password(data['password'])
    if was_active_superuser and not (user.is_superuser and user.is_active) and not User.objects.filter(is_superuser=True,is_active=True).exclude(pk=user.pk).exists():
        raise ValueError('At least one active superuser must remain.')
    user.full_clean();user.save()
    if data.get('revoke_sessions') or not user.is_active or (data.get('password') and user.pk != request.user.pk) or previous['is_staff'] != user.is_staff or previous['is_superuser'] != user.is_superuser:revoke_sessions(user)
    if user.pk==request.user.pk and data.get('password'):update_session_auth_hash(request,user)
    labels={'username':'Username','email':'Email','first_name':'Name','last_name':'Last name','is_staff':'Staff permission','is_superuser':'Admin permission','is_active':'Activity'}
    changes=[f'{labels[key]}: {previous[key]} → {getattr(user,key)}' for key in previous if previous[key] != getattr(user,key)]
    if data.get('password'): changes.append('Reset password (value not logged)')
    if data.get('revoke_sessions'): changes.append('Sign out all devices')
    reason=data.get('reason','')
    if not isinstance(reason,str) or len(reason)>500: raise ValueError('Reasons must not exceed 500 characters.')
    if changes: audit(request,user,'; '.join(changes) + (f'. Reason: {reason}' if reason else ''))
    return JsonResponse({'ok':True})

def revoke_sessions(user):
    from django.contrib.sessions.models import Session
    from django.utils import timezone
    for session in Session.objects.filter(expire_date__gt=timezone.now()):
        if session.get_decoded().get('_auth_user_id')==str(user.pk):session.delete()


def managed_user(request, pk, lock=False):
    qs = get_user_model().objects.all()
    if lock:
        qs = qs.select_for_update()
    if not request.user.is_superuser:
        qs = qs.filter(is_superuser=False, is_staff=False)
    return get_object_or_404(qs, pk=pk)
