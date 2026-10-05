import uuid
import secrets
from django.conf import settings
from django.db import IntegrityError, transaction
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import UserCreationForm
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from api.common import body

@ensure_csrf_cookie
@require_http_methods(['GET', 'POST'])
def superuser_registration(request, setup_key):
    key = settings.SUPERUSER_SETUP_KEY
    if len(key) < 32 or not secrets.compare_digest(setup_key.encode(), key.encode()):
        return JsonResponse({'error': 'Đường dẫn không tồn tại hoặc đã hết hiệu lực.'}, status=404)
    if request.method == 'GET':
        return JsonResponse({'enabled': True})
    return session(request, superuser_registration=True)

@ensure_csrf_cookie
@require_http_methods(['GET', 'POST', 'DELETE'])
def session(request, superuser_registration=False):
    if request.method == 'DELETE':
        logout(request)
    elif request.method == 'POST':
        try:
            data = body(request)
        except ValueError:
            return JsonResponse({'error': 'JSON không hợp lệ.'}, status=400)
        if any(not isinstance(data.get(key, ''), str) for key in ['username', 'password', 'password1', 'password2']):
            return JsonResponse({'error': 'Thông tin đăng nhập không hợp lệ.'}, status=400)
        if data.get('register') or superuser_registration:
            form = UserCreationForm(data)
            if not form.is_valid():
                return JsonResponse({'error': form.errors.as_text()}, status=400)
            try:
                with transaction.atomic():
                    user = form.save(commit=False)
                    if superuser_registration:
                        user.is_staff = True
                        user.is_superuser = True
                    user.save()
            except IntegrityError:
                return JsonResponse({'error': 'Tên tài khoản đã được sử dụng.'}, status=400)
        else:
            user = authenticate(request, username=data.get('username', ''), password=data.get('password', ''))
        if user is None:
            return JsonResponse({'error': 'Tên đăng nhập hoặc mật khẩu không đúng.'}, status=400)
        login(request, user)
        request.session["appearance_session"] = uuid.uuid4().hex
    user = request.user
    preferences={}
    if user.is_authenticated:
        from .models import Profile
        profile,_=Profile.objects.get_or_create(user=user)
        preferences=profile.preferences
        if not request.session.get("appearance_session"):
            request.session["appearance_session"] = uuid.uuid4().hex
    return JsonResponse({'user': {'id': user.pk, 'username': user.username, 'staff': user.is_staff, 'superuser': user.is_superuser, 'preferences':preferences, 'appearance_session':request.session.get('appearance_session')} if user.is_authenticated else None})
