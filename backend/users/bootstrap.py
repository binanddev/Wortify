import secrets
from django.conf import settings
from django.contrib.auth.forms import UserCreationForm
from django.db import IntegrityError, transaction
from django.http import Http404
from django.shortcuts import render
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from django.views.decorators.clickjacking import xframe_options_deny


@never_cache
@ensure_csrf_cookie
@csrf_protect
@xframe_options_deny
@require_http_methods(['GET', 'POST'])
def bootstrap(request, setup_key):
    key = settings.SUPERUSER_SETUP_KEY
    if len(key) < 32 or not secrets.compare_digest(setup_key.encode(), key.encode()):
        raise Http404
    def page(context, status=200):
        response = render(request, 'users/bootstrap.html', context, status=status)
        response['Referrer-Policy'] = 'no-referrer'
        response['X-Robots-Tag'] = 'noindex, nofollow, noarchive'
        return response

    error = ''
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            try:
                with transaction.atomic():
                    user = form.save(commit=False)
                    user.is_staff = True
                    user.is_superuser = True
                    user.save()
                return page({'complete': True})
            except IntegrityError:
                error = 'Tên tài khoản đã được sử dụng. Hãy chọn tên khác.'
    else:
        form = UserCreationForm()
    return page({'form': form, 'error': error}, status=400 if request.method == 'POST' else 200)
