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
        raise ValueError('Choose a JPG, PNG or WebP image, up to 30 MB.')
    ext = source.name.rsplit('.', 1)[-1].lower()
    formats = {'jpg': ('jpeg_pipe','mjpeg'), 'jpeg': ('jpeg_pipe','mjpeg'), 'png': ('png_pipe','png'), 'webp': ('webp_pipe','webp')}
    if ext not in formats: raise ValueError('Only JPG, PNG or WebP images are accepted.')
    try:
        with av.open(source, format=formats[ext][0]) as container:
            stream = container.streams.video[0]
            if stream.codec_context.name != formats[ext][1] or stream.codec_context.width * stream.codec_context.height > 40_000_000:
                raise ValueError('Invalid image.')
            next(container.decode(stream))
    except Exception as exc:
        raise ValueError('The image is corrupt or exceeds 40 megapixels.') from exc
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
    return JsonResponse({'error': 'Personal theme presets are no longer supported. Use the background library.'}, status=410)

@endpoint
@require_http_methods(['DELETE'])
@transaction.atomic
def delete_theme(request, pk):
    theme = get_object_or_404(Theme, pk=pk)
    if not editable(request.user, theme): return JsonResponse({'error': 'You cannot delete this theme.'}, status=403)
    theme.delete()
    return JsonResponse({'ok': True})

@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def select_theme(request):
    return JsonResponse({'error': 'Choose an image from your background library.'}, status=410)

@endpoint
@require_http_methods(['GET'])
def manifest(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)
    personal = f'/api/me/background/image/?v={profile.background_updated_at.timestamp()}' if profile.background_image and profile.background_updated_at else ''
    site = SiteAppearance.objects.filter(pk=1).first()
    fallback = personal or (f'/api/site/appearance/image/?v={site.updated_at.timestamp()}' if site and site.background_image else '')
    theme = visible(request.user).filter(pk=profile.theme_de_id or profile.theme_en_id).first()
    background_url = image_url(theme) if theme and theme.background_image else fallback
    if profile.use_default_background: background_url = ''
    result = {lang: {'theme_id': None, 'preferences': {}, 'background_url': background_url}
              for lang in ('de', 'en')}
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
