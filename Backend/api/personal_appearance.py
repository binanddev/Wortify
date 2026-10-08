"""Private account-wide background, never a user-controlled public file path."""
import uuid
import av
from django.db import transaction
from django.contrib.auth import get_user_model
from django.http import JsonResponse, FileResponse, Http404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from users.models import Profile, Theme
from .common import endpoint

def payload(profile):
    return {'background_url': f'/api/me/background/image/?v={profile.background_updated_at.timestamp()}'
            if profile.background_image and profile.background_updated_at else ''}

@endpoint
@require_http_methods(['GET', 'POST', 'DELETE'])
@transaction.atomic
def background(request):
    get_user_model().objects.select_for_update().get(pk=request.user.pk)
    profile, _ = Profile.objects.get_or_create(user=request.user)
    profile = Profile.objects.select_for_update().get(pk=profile.pk)
    if request.method == 'GET': return JsonResponse(payload(profile))
    old = profile.background_image.name
    storage = profile.background_image.storage
    if request.method == 'POST':
        if not profile.background_image and Theme.objects.filter(owner=request.user).exclude(background_image='').count() >= 10:
            raise ValueError('The library already contains 10 images.')
        source = request.FILES.get('image')
        if not source or not 0 < source.size <= 30 * 1024 * 1024:
            raise ValueError('Choose a JPG, PNG or WebP image, up to 30 MB.')
        extension = source.name.rsplit('.', 1)[-1].lower()
        formats = {'jpg': ('jpeg_pipe','mjpeg'), 'jpeg': ('jpeg_pipe','mjpeg'), 'png': ('png_pipe','png'), 'webp': ('webp_pipe','webp')}
        if extension not in formats: raise ValueError('Only JPG, PNG or WebP images are accepted.')
        try:
            with av.open(source, format=formats[extension][0]) as container:
                stream = container.streams.video[0]
                if stream.codec_context.name != formats[extension][1] or stream.codec_context.width * stream.codec_context.height > 40_000_000:
                    raise ValueError('Invalid image.')
                next(container.decode(stream))
        except Exception as exc:
            raise ValueError('The image is corrupt or exceeds 40 megapixels.') from exc
        source.seek(0)
        profile.background_image.save(f'{uuid.uuid4().hex}.{extension}', source, save=False)
    else: profile.background_image = ''
    profile.use_default_background = request.method != 'POST'
    profile.background_updated_at = timezone.now()
    try: profile.save(update_fields=['background_image','background_updated_at','use_default_background'])
    except Exception:
        if request.method == 'POST': storage.delete(profile.background_image.name)
        raise
    if old: transaction.on_commit(lambda: storage.delete(old))
    return JsonResponse(payload(profile))

@endpoint
@require_http_methods(['GET', 'HEAD'])
def image(request):
    profile = Profile.objects.filter(user=request.user).first()
    if not profile or not profile.background_image: raise Http404
    ext = profile.background_image.name.rsplit('.',1)[-1]
    response = FileResponse(profile.background_image.open('rb'), content_type={'jpg':'image/jpeg','jpeg':'image/jpeg','png':'image/png','webp':'image/webp'}[ext])
    response['Cache-Control'] = 'private, no-store'
    response['X-Content-Type-Options'] = 'nosniff'
    return response
