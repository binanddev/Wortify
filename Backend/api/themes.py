"""Private/published themes; login appearance manifests contain no creator metadata."""
import json
import uuid
import av
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse, FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from users.models import Profile, Theme
from users.preferences import validate_preferences
from content.models import SiteAppearance
from .common import endpoint, body

DEFAULT_DISPLAY = {'interface': 'studio', 'background': 'mist', 'transparency': 25, 'textSize': 18, 'font': 36, 'textWeight': 500, 'textContrast': 80, 'textColor': 'auto', 'curvature': 18, 'glassLens': 40}
DISPLAY_KEYS = {'interface', 'background', 'transparency', 'textSize', 'font', 'textWeight', 'textContrast', 'textColor', 'curvature', 'glassLens'}

def visible(user):
    return Theme.objects.filter(Q(owner=user) | Q(shared=True))

def editable(user, theme):
    return theme.owner_id == user.pk or user.is_superuser

def image_url(theme):
    return f'/api/themes/{theme.pk}/image/?v={theme.updated_at.timestamp()}' if theme.background_image else ''

def serialize(theme, user):
    return {'id': theme.pk, 'name': theme.name, 'system': theme.shared,
            'preferences': theme.preferences, 'has_image': bool(theme.background_image),
            'can_edit': editable(user, theme)}

def validate_image(source):
    if not source or not 0 < source.size <= 30 * 1024 * 1024:
        raise ValueError('Chọn ảnh JPG, PNG hoặc WebP, tối đa 30 MB.')
    ext = source.name.rsplit('.', 1)[-1].lower()
    formats = {'jpg': ('jpeg_pipe','mjpeg'), 'jpeg': ('jpeg_pipe','mjpeg'), 'png': ('png_pipe','png'), 'webp': ('webp_pipe','webp')}
    if ext not in formats: raise ValueError('Chỉ nhận JPG, PNG hoặc WebP.')
    try:
        with av.open(source, format=formats[ext][0]) as container:
            stream = container.streams.video[0]
            if stream.codec_context.name != formats[ext][1] or stream.codec_context.width * stream.codec_context.height > 40_000_000:
                raise ValueError('Ảnh không hợp lệ.')
            next(container.decode(stream))
    except Exception as exc:
        raise ValueError('Ảnh bị lỗi hoặc vượt quá 40 triệu điểm ảnh.') from exc
    source.seek(0)
    return ext

@endpoint
@require_http_methods(['GET', 'POST'])
@transaction.atomic
def themes(request, pk=None):
    # Serialize a user's creates so simultaneous requests cannot exceed five.
    if request.method == 'GET':
        profile, _ = Profile.objects.get_or_create(user=request.user)
        return JsonResponse({'themes': [serialize(t, request.user) for t in visible(request.user).order_by('shared', 'name', 'pk')],
            'own_count': Theme.objects.filter(owner=request.user).count(),
            'selected': {'de': profile.theme_de_id, 'en': profile.theme_en_id}})
    get_user_model().objects.select_for_update().get(pk=request.user.pk)
    theme = get_object_or_404(Theme.objects.select_for_update(), pk=pk) if pk else Theme(owner=request.user)
    if pk and not editable(request.user, theme): return JsonResponse({'error': 'Bạn không có quyền sửa theme này.'}, status=403)
    if not pk and Theme.objects.filter(owner=request.user).count() >= 5:
        raise ValueError('Bạn có thể lưu tối đa 5 theme. Hãy sửa hoặc xóa một theme trước.')
    data = request.POST
    name = data.get('name', '').strip()
    if not name or len(name) > 80: raise ValueError('Tên theme cần từ 1 đến 80 ký tự.')
    shared = data.get('shared', 'false') == 'true'
    if shared and not (request.user.is_staff or request.user.is_superuser):
        return JsonResponse({'error': 'Chỉ staff hoặc superuser được tạo theme hệ thống.'}, status=403)
    try: prefs = json.loads(data.get('preferences', '{}'))
    except (ValueError, TypeError): raise ValueError('Thông số theme không hợp lệ.')
    if not isinstance(prefs, dict) or set(prefs) - DISPLAY_KEYS: raise ValueError('Theme chỉ chứa thông số hiển thị.')
    theme.name, theme.shared, theme.preferences = name, shared, {**DEFAULT_DISPLAY, **validate_preferences(prefs)}
    if theme.preferences.get('interface') == 'glass':
        theme.preferences.update(textColor='#ffffff', textSize=18, textWeight=500, textContrast=100, font=36, curvature=24, glassLens=0)
        theme.preferences['transparency'] = max(10, min(100, theme.preferences.get('transparency', 25)))
    old = theme.background_image.name
    new_file = None
    source = request.FILES.get('image')
    if data.get('image_mode') == 'upload' and not source:
        raise ValueError('Chọn ảnh JPG, PNG hoặc WebP, tối đa 30 MB.')
    if source:
        ext = validate_image(source)
        new_file = (f'{uuid.uuid4().hex}.{ext}', source)
    elif data.get('image_mode') == 'remove': theme.background_image = ''
    elif data.get('image_mode') == 'current':
        profile, _ = Profile.objects.get_or_create(user=request.user)
        lang = data.get('language', 'de')
        if lang not in ('de', 'en'): raise ValueError('Không gian không hợp lệ.')
        selected = visible(request.user).filter(pk=getattr(profile, f'theme_{lang}_id')).first()
        field = selected.background_image if selected else profile.background_image
        if not selected and not field:
            site = SiteAppearance.objects.filter(pk=1).first()
            field = site.background_image if site else None
        if field:
            with field.open('rb') as image:
                new_file = (f'{uuid.uuid4().hex}.{field.name.rsplit(".", 1)[-1]}', ContentFile(image.read()))
        else: theme.background_image = ''
    if new_file: theme.background_image.save(*new_file, save=False)
    try: theme.save()
    except Exception:
        if new_file: theme.background_image.storage.delete(theme.background_image.name)
        raise
    if old and old != theme.background_image.name:
        storage = theme.background_image.storage
        transaction.on_commit(lambda: storage.delete(old))
    if not shared:
        Profile.objects.exclude(user=theme.owner).filter(theme_de=theme).update(theme_de=None)
        Profile.objects.exclude(user=theme.owner).filter(theme_en=theme).update(theme_en=None)
    return JsonResponse(serialize(theme, request.user), status=200 if pk else 201)

@endpoint
@require_http_methods(['DELETE'])
@transaction.atomic
def delete_theme(request, pk):
    theme = get_object_or_404(Theme, pk=pk)
    if not editable(request.user, theme): return JsonResponse({'error': 'Bạn không có quyền xóa theme này.'}, status=403)
    theme.delete()
    return JsonResponse({'ok': True})

@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def select_theme(request):
    data = body(request)
    scope, theme_id = data.get('scope'), data.get('theme_id')
    if scope not in ('de', 'en', 'both'): raise ValueError('Chọn tiếng Đức, tiếng Anh hoặc cả hai.')
    if theme_id is not None and (type(theme_id) is not int or theme_id <= 0): raise ValueError('Theme không hợp lệ.')
    theme = get_object_or_404(visible(request.user), pk=theme_id) if theme_id else None
    profile, _ = Profile.objects.get_or_create(user=request.user)
    profile = Profile.objects.select_for_update().get(pk=profile.pk)
    fields = ['theme_de', 'theme_en'] if scope == 'both' else [f'theme_{scope}']
    for field in fields: setattr(profile, field, theme)
    profile.save(update_fields=fields)
    return JsonResponse({'ok': True})

@endpoint
@require_http_methods(['GET'])
def manifest(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)
    personal = f'/api/me/background/image/?v={profile.background_updated_at.timestamp()}' if profile.background_image and profile.background_updated_at else ''
    site = SiteAppearance.objects.filter(pk=1).first()
    fallback = personal or (f'/api/site/appearance/image/?v={site.updated_at.timestamp()}' if site and site.background_image else '')
    result = {}
    for lang in ('de', 'en'):
        theme = visible(request.user).filter(pk=getattr(profile, f'theme_{lang}_id')).first()
        result[lang] = {'theme_id': theme.pk if theme else None, 'preferences': theme.preferences if theme else {}, 'background_url': image_url(theme) if theme else fallback}
    return JsonResponse(result)

@endpoint
@require_http_methods(['GET', 'HEAD'])
def theme_image(request, pk):
    theme = get_object_or_404(visible(request.user), pk=pk)
    if not theme.background_image: raise Http404
    response = FileResponse(theme.background_image.open('rb'))
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response
