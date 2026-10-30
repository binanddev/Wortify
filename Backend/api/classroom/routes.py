"""Lightweight declarations for the opt-in classroom API.

The root URLconf may inspect/resolve these routes without importing teaching,
PDF, or realtime implementation modules. A handler is resolved only when its
own URL receives a request. Namespace/auth/method decorators remain on the
original handlers and keep their existing behavior.
"""
from importlib import import_module


ROUTES = (
    ('classes/public/<uuid:token>/', 'api.teaching_public.board', ('GET',)),
    ('classes/public/<uuid:token>/info/', 'api.teaching_public.info', ('GET',)),
    ('classes/public/<uuid:token>/pdfs/<uuid:asset_id>/', 'api.teaching_public.pdf_content', ('GET',)),
    ('classes/public/<uuid:token>/realtime/', 'api.teaching_public.ticket', ('GET',)),
    ('classes/<int:pk>/boards/<uuid:board_id>/sharing/', 'api.teaching_public.sharing', ('GET', 'POST')),
    ('classes/<int:pk>/boards/<uuid:board_id>/realtime/', 'api.teaching_realtime.ticket', ('POST',)),
    ('classes/<int:pk>/boards/', 'api.teaching.boards', ('GET', 'POST')),
    ('classes/<int:pk>/boards/<uuid:board_id>/', 'api.teaching.board', ('GET', 'POST')),
    ('classes/<int:pk>/boards/<uuid:board_id>/pdfs/', 'api.teaching.upload_pdf', ('POST',)),
    ('classes/<int:pk>/boards/<uuid:board_id>/pdfs/<uuid:asset_id>/', 'api.teaching.pdf_content', ('GET',)),
    ('classes/', 'api.community.classes', ('GET', 'POST')),
    ('classes/<int:pk>/', 'api.community.classroom', ('GET', 'PATCH', 'DELETE')),
    ('classes/<int:pk>/assignments/', 'api.community.classroom_assignments', ('POST', 'DELETE')),
)


def deferred_view(source, methods):
    """Create a sync view without importing its implementation or dependencies."""
    module, name = source.rsplit('.', 1)
    resolved = None

    def dispatch(request, *args, **kwargs):
        from api.feature_availability import current, MESSAGE
        from django.http import JsonResponse
        if not current()['classes']:
            return JsonResponse({'error': MESSAGE, 'code': 'feature_disabled'}, status=503)
        nonlocal resolved
        if resolved is None:
            resolved = getattr(import_module(module), name)
        return resolved(request, *args, **kwargs)

    dispatch.__name__ = name
    dispatch.__qualname__ = name
    dispatch.__module__ = module
    dispatch.__doc__ = f'Deferred classroom endpoint: {source}.'
    # Documentation consumes this declaration instead of importing the handler.
    dispatch.__api_reference__ = {'source': source, 'methods': tuple(methods)}
    return dispatch


def routes():
    return [(pattern, deferred_view(source, methods)) for pattern, source, methods in ROUTES]
