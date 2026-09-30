import secrets
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import UserCreationForm
from django.db import IntegrityError, transaction
from django.http import Http404
from django.shortcuts import render
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.http import require_http_methods
from .models import SuperuserBootstrap


@never_cache
@ensure_csrf_cookie
@csrf_protect
@require_http_methods(['GET', 'POST'])
def bootstrap(request):
    key = settings.SUPERUSER_SETUP_KEY
    User = get_user_model()
    if len(key) < 32 or User.objects.filter(is_superuser=True).exists() or SuperuserBootstrap.objects.exists():
        raise Http404
    error = ''
    if request.method == 'POST':
        supplied = request.POST.get('setup_key', '')
        if not secrets.compare_digest(supplied.encode(), key.encode()):
            return render(request, 'users/bootstrap.html', {'form': UserCreationForm(), 'error': 'Khóa thiết lập không đúng.'}, status=403)
        form = UserCreationForm(request.POST)
        if form.is_valid():
            try:
                with transaction.atomic():
                    # Unique singleton insert serializes competing setup requests.
                    SuperuserBootstrap.objects.create(pk=1)
                    if User.objects.filter(is_superuser=True).exists():
                        raise IntegrityError('Setup already completed')
                    user = form.save(commit=False)
                    user.is_staff = True
                    user.is_superuser = True
                    user.save()
                return render(request, 'users/bootstrap.html', {'complete': True})
            except IntegrityError:
                raise Http404
    else:
        form = UserCreationForm()
    return render(request, 'users/bootstrap.html', {'form': form, 'error': error}, status=400 if request.method == 'POST' else 200)
