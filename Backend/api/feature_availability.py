from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.db import transaction
from django.db.utils import OperationalError, ProgrammingError
from users.models import FeatureAvailability
from .common import body
THEMES = ('glass','xp','retro','notebook','rpg')
MESSAGE = 'Hệ thống đang hoàn thiện'
def current():
    try:
        item = FeatureAvailability.objects.filter(pk=1).first()
    except (OperationalError, ProgrammingError):
        item = None
    return {'themes': {'studio': True, **{k: item.themes.get(k, True) if item else True for k in THEMES}}, 'classes': item.classes if item else True}
def response(data):
    result = JsonResponse(data)
    result['Cache-Control'] = 'no-store'
    return result
@require_http_methods(['GET'])
def public(request):
    return response(current())
@require_http_methods(['GET','PATCH'])
def manage(request):
    if not request.user.is_authenticated or not request.user.is_superuser:
        return JsonResponse({'error':'Administrator access required.'}, status=403)
    if request.method == 'GET': return response(current())
    try:
        data = body(request)
        themes = data.get('themes', {})
        if set(data) - {'themes','classes'} or not isinstance(themes,dict) or set(themes)-set(THEMES) or any(type(v) is not bool for v in themes.values()) or ('classes' in data and type(data['classes']) is not bool):
            raise ValueError('Invalid switches. Studio is always enabled.')
    except ValueError as exc:
        return JsonResponse({'error':str(exc)}, status=400)
    with transaction.atomic():
        item,_ = FeatureAvailability.objects.get_or_create(pk=1)
        item = FeatureAvailability.objects.select_for_update().get(pk=item.pk)
        item.themes = {**item.themes, **themes}
        item.classes = data.get('classes',item.classes)
        item.save()
    return response(current())
