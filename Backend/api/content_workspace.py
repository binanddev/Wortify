"""Shared editorial ownership; authentication and learning always retain the actor."""
from contextlib import contextmanager
from contextvars import ContextVar
import hashlib
import json
import re
from django.db import transaction
from django.db.models import Count, Max
from django.http import JsonResponse

forced_visibility = ContextVar('workspace_visibility', default=None)


def is_editor(user):
    return user.is_authenticated and user.is_active and (user.is_staff or user.is_superuser)


def scope(request):
    default = 'shared' if request.user.is_staff and not request.user.is_superuser else 'personal'
    value = getattr(request, 'headers', {}).get('X-Wortify-Workspace', getattr(request, 'GET', {}).get('workspace', default))
    if value not in ('shared', 'personal'):
        raise ValueError('Invalid content workspace.')
    return value


def content_owner(request):
    # Management's internal requests explicitly supply their content owner.
    if not hasattr(request, 'headers') or not is_editor(request.user) or scope(request) == 'personal':
        return request.user
    if not hasattr(request, '_content_owner'):
        from .content_merge import publisher
        request._content_owner = publisher(create=True)
    return request._content_owner


def learning_owners(user):
    owners = [user.pk]
    if is_editor(user):
        from .content_merge import publisher
        shared = publisher()
        if shared:
            owners.append(shared.pk)
    return owners


def studio_preferences(user, preferences):
    if user.is_staff and not user.is_superuser:
        return {**preferences, 'interface': 'studio', 'appearanceSelections': {
            key: {**value, 'interface': 'studio'}
            for key, value in preferences.get('appearanceSelections', {}).items()
        }}
    return preferences


def section_for(path):
    match = re.match(r'^/api/(en|de)/(decks|folders|practice-hub|reading)/', path)
    if not match:
        return None
    tail = path[match.end():]
    if match[2] == 'practice-hub' and not re.match(r'^(nodes|organize|import|media)/', tail):
        return None
    if match[2] == 'reading' and re.match(r'^(discover|save)/', tail):
        return None
    if '/copy/' in path or '/learning/' in path:
        return None
    return {'decks':'flashcards','folders':'flashcards','practice-hub':'practice','reading':'reading'}[match[2]]


def revision(owner, language, section):
    from cards.models import Deck, Folder
    from practice.models import PracticeNode, ReadingFolder, ReadingLesson
    filters = dict(owner=owner, language=language)
    if section == 'flashcards':
        rows = [list(Folder.objects.filter(**filters).order_by('pk').values_list('id','parent_id','name','archived','theory_format','theory_content')),
                list(Deck.objects.filter(**filters).annotate(cards_count=Count('cards'),cards_updated=Max('cards__updated_at')).order_by('pk').values_list('id','folder_id','title','visibility','archived','updated_at','cards_count','cards_updated'))]
    elif section == 'practice':
        rows = [list(PracticeNode.objects.filter(**filters).order_by('pk').values_list('id','parent_id','title','visibility','position','updated_at')), list(PracticeNode.objects.filter(**filters).order_by('pk','links__pk').values_list('id','links__pk'))]
    else:
        rows = [list(ReadingFolder.objects.filter(**filters).order_by('pk').values_list('id','parent_id','title')),
                list(ReadingLesson.objects.filter(**filters).order_by('pk').values_list('id','folder_id','title','visibility','level','topic','updated_at'))]
    return hashlib.sha256(json.dumps(rows,default=str,ensure_ascii=False).encode()).hexdigest()


@contextmanager
def workspace_request(request):
    # Scope is explicit on every request; changing browser tabs never changes a session's owner.
    section = section_for(request.path)
    editorial = is_editor(request.user) and hasattr(request, 'language')
    token = forced_visibility.set(('public' if scope(request) == 'shared' else 'private') if editorial else None)
    try:
        if not section or not editorial or scope(request) != 'shared':
            yield None
            return
        from django.contrib.auth import get_user_model
        with transaction.atomic():
            owner = content_owner(request)
            if request.method not in ('GET','HEAD'):
                get_user_model().objects.select_for_update().get(pk=owner.pk)
            before = revision(owner,request.language,section)
            expected = request.headers.get('X-Wortify-Revision')
            # Creation may be the first request in an empty workspace; edits must carry a revision.
            editing = request.method in ('PATCH','DELETE') or (request.method == 'POST' and re.search(r'/(cards|images|reorder|manage|organize|import)/',request.path))
            if editing and (not expected or expected != before):
                yield JsonResponse({'error':'Shared content changed. Reload the library before saving; your unsaved edits are still available.'},status=409)
                return
            yield (owner, section, before)
    finally:
        forced_visibility.reset(token)


def finish_workspace(request, response, workspace):
    if not workspace or isinstance(workspace, JsonResponse):
        return response
    owner, section, before = workspace
    if response.status_code < 400:
        response['X-Wortify-Revision'] = before if request.method in ('GET','HEAD') else revision(owner,request.language,section)
        if request.method not in ('GET','HEAD') and not (section == 'reading' and request.method == 'POST' and re.search(r'/reading/\d+/$', request.path)):
            from .management import audit
            audit(request, owner, f'Wortify {section}/{request.language}: {request.method} {request.path}')
    return response
