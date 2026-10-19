from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from content.models import ContentPolicy
from content.sharing import sharing_mode
from cards.models import Deck
from practice.models import PracticeNode, ReadingLesson
from .common import endpoint, body
from .management import management, audit

@endpoint
@require_http_methods(['GET'])
def current(request):
    policy = ContentPolicy.objects.filter(pk=1).first()
    response = JsonResponse({'mode': policy.mode if policy else 'choice'})
    response['Cache-Control'] = 'no-store'
    return response

@management('content.change_policy')
@require_http_methods(['GET', 'PATCH'])
def settings(request):
    if request.method == 'GET':
        return current(request)
    mode = body(request).get('mode')
    if mode not in ('choice', 'public', 'new_public'):
        raise ValueError('Invalid publishing mode.')
    with sharing_mode():
        policy = ContentPolicy.objects.get(pk=1)
        policy.mode = mode
        policy.save(update_fields=['mode', 'updated_at'])
        changed = {}
        if mode == 'public':
            for name, model in [('flashcards', Deck), ('practice', PracticeNode), ('reading', ReadingLesson)]:
                changed[name] = model.objects.exclude(visibility='public').update(visibility='public')
        audit(request, policy, 'Publishing policy: ' + mode)
    return JsonResponse({'mode': mode, 'changed': changed})
