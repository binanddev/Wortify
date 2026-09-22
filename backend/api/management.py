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
            if not request.user.is_active or not request.user.is_superuser:
                return JsonResponse({'error':'Bạn không có quyền quản trị mục này.'},status=403)
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
        return JsonResponse(_appearance_payload(item))
    if request.method == 'POST':
        upload = request.FILES.get('background_image')
        if not upload:
            raise ValueError('Chọn một ảnh nền.')
        if not upload.content_type or not upload.content_type.startswith('image/'):
            raise ValueError('Chỉ nhận tệp hình ảnh.')
        if upload.size > 8 * 1024 * 1024:
            raise ValueError('Ảnh nền không được vượt quá 8 MB.')
        if item.background_image:
            item.background_image.delete(save=False)
        item.background_image = upload
        item.save()
        audit(request, item, 'Cập nhật ảnh nền dùng chung.')
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
        return JsonResponse({'error': 'Chưa có ảnh nền.'}, status=404)
    response = FileResponse(item.background_image.open('rb'), content_type=mimetypes.guess_type(item.background_image.name)[0] or 'application/octet-stream')
    response['Cache-Control'] = 'private, max-age=300'
    return response

def audit(request,obj,message,created=False):
    LogEntry.objects.log_actions(user_id=request.user.pk,queryset=[obj],action_flag=ADDITION if created else CHANGE,change_message=message)

@management('auth.view_user')
@require_http_methods(['GET','POST'])
def users(request):
    User=get_user_model()
    if request.method=='POST':
        if not request.user.has_perm('auth.add_user'):return JsonResponse({'error':'Không có quyền tạo tài khoản.'},status=403)
        data=body(request);username=data.get('username','')
        if not isinstance(username,str) or not username.strip():raise ValueError('Nhập tên tài khoản.')
        user=User(username=username,email=data.get('email',''));user.full_clean(exclude=['password']);validate_password(data.get('password',''),user)
        role=data.get('role','user')
        if role not in ('user','staff','superuser'):raise ValueError('Vai trò không hợp lệ.')
        user.is_staff=role in ('staff','superuser');user.is_superuser=role=='superuser'
        user.set_password(data['password']);user.save();audit(request,user,'Tạo tài khoản từ quản trị.',True)
        return JsonResponse({'id':user.pk},status=201)
    q=request.GET.get('q','')[:100];qs=User.objects.filter(Q(username__icontains=q)|Q(email__icontains=q)).order_by('username')
    page=max(1,int(request.GET.get('page',1)));total=qs.count()
    return JsonResponse({'users':list(qs[(page-1)*50:page*50].values('id','username','email','is_active','is_staff','is_superuser','last_login','date_joined')),'total':total,'page':page,'can_add':request.user.has_perm('auth.add_user'),'can_edit':request.user.has_perm('auth.change_user'),'superuser':request.user.is_superuser})

@management('auth.change_user')
@require_http_methods(['GET','PATCH','DELETE'])
@transaction.atomic
def user_detail(request,pk):
    User=get_user_model()
    user=get_object_or_404(User.objects.select_for_update(),pk=pk)
    if request.method=='GET':
        logs=LogEntry.objects.filter(content_type=ContentType.objects.get_for_model(User),object_id=str(pk)).order_by('-action_time')[:30]
        return JsonResponse({'logs':[{'at':l.action_time.isoformat(),'message':l.change_message,'actor':l.user.username} for l in logs]})
    if request.method=='DELETE':
        if user.pk==request.user.pk:raise ValueError('Không thể xóa tài khoản đang sử dụng.')
        if user.is_superuser and User.objects.filter(is_superuser=True,is_active=True).count()<=1:raise ValueError('Cần giữ ít nhất một superuser hoạt động.')
        from users.models import ClassroomAssignment
        ClassroomAssignment.objects.filter(assigned_by=user).delete()
        revoke_sessions(user);audit(request,user,'Xóa tài khoản và dữ liệu cá nhân.');user.delete()
        return JsonResponse({'ok':True})
    data=body(request)
    for key in ['username','email','first_name','last_name']:
        if key in data:
            if not isinstance(data[key],str):raise ValueError('Thông tin tài khoản không hợp lệ.')
            setattr(user,key,data[key])
    if 'role' in data:
        if data['role'] not in ('user','staff','superuser'):raise ValueError('Vai trò không hợp lệ.')
        if user.pk==request.user.pk and data['role']!='superuser':raise ValueError('Không tự gỡ quyền quản trị hiện tại.')
        user.is_superuser=data['role']=='superuser';user.is_staff=data['role'] in ('staff','superuser')
    if 'is_active' in data:
        if type(data['is_active']) is not bool:raise ValueError('Trạng thái không hợp lệ.')
        if user.pk==request.user.pk and not data['is_active']:raise ValueError('Không tự khóa tài khoản đang sử dụng.')
        user.is_active=data['is_active']
    if data.get('password'):
        if not isinstance(data['password'],str):raise ValueError('Mật khẩu không hợp lệ.')
        validate_password(data['password'],user);user.set_password(data['password'])
    user.full_clean();user.save()
    if data.get('revoke_sessions') or not user.is_active:revoke_sessions(user)
    if user.pk==request.user.pk and data.get('password'):update_session_auth_hash(request,user)
    audit(request,user,'Cập nhật tài khoản, vai trò, trạng thái hoặc phiên đăng nhập. Không ghi mật khẩu.')
    return JsonResponse({'ok':True})

def revoke_sessions(user):
    from django.contrib.sessions.models import Session
    from django.utils import timezone
    for session in Session.objects.filter(expire_date__gt=timezone.now()):
        if session.get_decoded().get('_auth_user_id')==str(user.pk):session.delete()
