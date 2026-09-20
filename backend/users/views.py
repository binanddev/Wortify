from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.forms import UserCreationForm
from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from api.common import body

@ensure_csrf_cookie
@require_http_methods(['GET', 'POST', 'DELETE'])
def session(request):
    if request.method == 'DELETE':
        logout(request)
    elif request.method == 'POST':
        try:
            data = body(request)
        except ValueError:
            return JsonResponse({'error': 'JSON không hợp lệ.'}, status=400)
        if any(not isinstance(data.get(key, ''), str) for key in ['username', 'password', 'password1', 'password2']):
            return JsonResponse({'error': 'Thông tin đăng nhập không hợp lệ.'}, status=400)
        if data.get('register'):
            form = UserCreationForm(data)
            if not form.is_valid():
                return JsonResponse({'error': form.errors.as_text()}, status=400)
            user = form.save()
        else:
            user = authenticate(request, username=data.get('username', ''), password=data.get('password', ''))
        if user is None:
            return JsonResponse({'error': 'Tên đăng nhập hoặc mật khẩu không đúng.'}, status=400)
        login(request, user)
    user = request.user
    return JsonResponse({'user': {'id': user.pk, 'username': user.username, 'staff': user.is_staff, 'superuser': user.is_superuser} if user.is_authenticated else None})
