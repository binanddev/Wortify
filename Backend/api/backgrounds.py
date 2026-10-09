"""Account-wide image library. Theme rows retain legacy image storage, not presets."""
import uuid
from django.contrib.auth import get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from users.models import Profile, Theme
from .common import endpoint, body
from .themes import validate_image, image_url

LIMIT = 10
INTERFACES = ('studio','glass','xp','retro','notebook','rpg')
def selected_for(profile, theme):
    saved = profile.preferences.get('backgroundByInterface', {})
    return saved.get(theme) if theme else (None if profile.use_default_background else (profile.theme_de_id or profile.theme_en_id or 0))
def remember(profile, theme, pk):
    if not theme: return
    if theme not in INTERFACES: raise ValueError('Invalid appearance.')
    prefs = dict(profile.preferences)
    choices = dict(prefs.get('backgroundByInterface', {}))
    choices[theme] = pk
    prefs['backgroundByInterface'] = choices
    profile.preferences = prefs
    profile.save(update_fields=['preferences'])


def profile_for(user):
    get_user_model().objects.select_for_update().get(pk=user.pk)
    profile, _ = Profile.objects.get_or_create(user=user)
    return profile

def owned(user):
    return Theme.objects.filter(owner=user).exclude(background_image='')

@endpoint
@require_http_methods(['GET', 'POST'])
@transaction.atomic
def library(request):
    profile = profile_for(request.user)
    theme = request.GET.get('interface') or request.POST.get('interface')
    if theme and theme not in INTERFACES: raise ValueError('Invalid appearance.')
    if request.method == 'POST':
        if owned(request.user).count() + bool(profile.background_image) >= LIMIT:
            raise ValueError('The library already contains 10 images. Delete one before adding another.')
        source = request.FILES.get('image')
        ext = validate_image(source)
        name = request.POST.get('name', '').strip() or source.name.rsplit('.', 1)[0]
        item = Theme(owner=request.user, name=name[:80], preferences={}, shared=False)
        item.background_image.save(f'{uuid.uuid4().hex}.{ext}', source, save=False)
        try:
            item.save()
            profile.use_default_background = False
            profile.theme_de = profile.theme_en = item
            profile.save(update_fields=['theme_de', 'theme_en', 'use_default_background'])
        except Exception:
            item.background_image.delete(save=False)
            raise
        remember(profile, theme, item.pk)
        return JsonResponse({'id': item.pk}, status=201)
    rows = [{'id': t.pk, 'name': t.name, 'url': image_url(t)} for t in owned(request.user).order_by('-pk')]
    if profile.background_image:
        rows.append({'id': 0, 'name': 'Previous background', 'url': '/api/me/background/image/'})
    return JsonResponse({'images': rows, 'limit': LIMIT, 'selected': selected_for(profile, theme)})

@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def select(request):
    profile = profile_for(request.user)
    data = body(request)
    pk = data.get('id')
    theme = data.get('interface')
    if theme and theme not in INTERFACES: raise ValueError('Invalid appearance.')
    if pk is not None and (type(pk) is not int or pk < 0):
        raise ValueError('Invalid background.')
    item = get_object_or_404(owned(request.user), pk=pk) if pk else None
    if pk == 0 and not profile.background_image:
        raise ValueError('The legacy image no longer exists.')
    profile.use_default_background = pk is None
    profile.theme_de = profile.theme_en = item
    profile.save(update_fields=['theme_de', 'theme_en', 'use_default_background'])
    remember(profile, theme, pk)
    return JsonResponse({'ok': True})

@endpoint
@require_http_methods(['DELETE'])
@transaction.atomic
def remove(request, pk):
    profile = profile_for(request.user)
    if (pk == 0 and not profile.theme_de_id and not profile.theme_en_id) or pk in (profile.theme_de_id, profile.theme_en_id):
        profile.use_default_background = True
        profile.theme_de = profile.theme_en = None
        profile.save(update_fields=['use_default_background', 'theme_de', 'theme_en'])
    for theme, selected in list(profile.preferences.get('backgroundByInterface', {}).items()):
        if selected == pk: remember(profile, theme, None)
    if pk == 0:
        field = profile.background_image
        if field:
            storage, name = field.storage, field.name
            profile.background_image = ''
            profile.save(update_fields=['background_image'])
            transaction.on_commit(lambda: storage.delete(name))
    else:
        get_object_or_404(owned(request.user), pk=pk).delete()
    return JsonResponse({'ok': True})
