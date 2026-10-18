from pathlib import Path
from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET


@require_GET
def guide(request):
    text=(Path(settings.BASE_DIR)/'sample_data/content-authoring.txt').read_text(encoding='utf-8')
    section=request.GET.get('section')
    if section in ('flashcards','practice','reading'): text='Generate only SECTION: '+section+'. Do not include other sections.\n'+text
    return HttpResponse(text, content_type='text/plain; charset=utf-8')


@require_GET
def openapi(request):
    response_properties = {
        'error': {'type':'string'}, 'id': {'type':'string'},
        'publisher': {'type':'string'}, 'visibility': {'type':'string'},
        'digest': {'type':'string'}, 'preview_token': {'type':'string'},
        'already_published': {'type':'boolean'}, 'already_imported': {'type':'boolean'},
        'counts': {'type':'object','additionalProperties':{'type':'integer'}},
    }
    responses = {}
    for code, description in [(200,'Preview or existing package'),(201,'Published atomically'),(400,'Invalid content or preview token'),(401,'Invalid or revoked key')]:
        responses[str(code)] = {'description':description, 'content':{'application/json':{'schema':{'type':'object','properties':response_properties}}}}
    properties = {
        'text': {'type':'string','description':'Complete Wortify Text 1 document'},
        'preview': {'type':'boolean','default':False},
        'confirm': {'type':'string','enum':['IMPORT']},
        'preview_token': {'type':'string','description':'Token from preview; valid 24 hours'},
    }
    operation = {
        'operationId':'importSystemContent', 'summary':'Preview or publish public system content',
        'description':'First send text and preview=true. Check counts, then send identical text, confirm=IMPORT and preview_token. New UUID only for new content. Retry unchanged IDs after a timeout. Fix 400 errors and preview again.',
        'security':[{'ImportKey':[]}],
        'parameters':[{'name':'section','in':'query','required':True,'schema':{'type':'string','enum':['flashcards','practice','reading']}}],
        'requestBody':{'required':True,'content':{'application/json':{'schema':{'type':'object','required':['text'],'additionalProperties':False,'properties':properties}}}},
        'responses':responses,
    }
    rules = {'operationId':'getAuthoringRules','summary':'Read complete syntax and lesson types','responses':{'200':{'description':'Authoring rules','content':{'text/plain':{'schema':{'type':'string'}}}}}}
    return JsonResponse({
        'openapi':'3.1.0',
        'info':{'title':'Wortify content import','version':'1.0.0','description':'Public Flashcard, Practice Hub and Reading content credited to Wortify. Read the guide first. Direct requests max 8 MB; multipart files max 50 MB.'},
        'servers':[{'url':request.build_absolute_uri('/').rstrip('/')}],
        'components':{'securitySchemes':{'ImportKey':{'type':'http','scheme':'bearer'}}},
        'paths':{'/api/import/guide/':{'get':rules},'/api/import/content/':{'post':operation}},
    })
