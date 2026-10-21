"""Public reading catalogue. Private lessons never enter the result set."""
from .common import public_endpoint
from django.http import JsonResponse, Http404
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_GET, require_POST
from django.db import transaction
from django.contrib.auth import get_user_model
from copy import deepcopy
from practice.models import ReadingLesson, SystemContentPackage, PackageReceipt
from .common import endpoint, body


def system_readings(nodes, prefix=''):
    for index, node in enumerate(nodes):
        path = f'{prefix}.{index}' if prefix else str(index)
        if node.get('kind') == 'folder':
            yield from system_readings(node.get('children', []), path)
        elif node.get('kind') == 'reading':
            yield path, node


def system_node(package, path):
    if package.document.get('mode'): raise Http404
    if PackageReceipt.objects.filter(package=package,user__username='wortify-publisher').exists():
        source=get_object_or_404(ReadingLesson,owner__username='wortify-publisher',language=package.language,source_key=f'system:{package.pk}:{path}')
        return {'title':source.title,'payload':source.payload,'level':source.level,'topic':source.topic},source
    node=next((n for p,n in system_readings(package.document.get('reading',[])) if p==path),None)
    if not node: raise Http404
    return node,None


def summary(key, title, level, topic, source):
    return dict(key=key, title=title, level=level, topic=topic, source=source)


@public_endpoint
@require_GET
def library(request):
    query = request.GET.get('q', '').strip().casefold()[:200]
    level = request.GET.get('level', '')
    topic = request.GET.get('topic', '').strip().casefold()
    source = request.GET.get('source', '')
    try:
        page = max(1, int(request.GET.get('page', '1')))
    except ValueError:
        raise ValueError('Invalid page.')
    rows = []
    packages=list(SystemContentPackage.objects.filter(language=request.language).order_by('-created_at'))
    materialized=set(PackageReceipt.objects.filter(package__in=packages,user__username='wortify-publisher').values_list('package_id',flat=True))
    native={r.source_key:r for r in ReadingLesson.objects.filter(language=request.language,owner__username='wortify-publisher').exclude(source_key='')}
    handled=set()
    for package in packages:
        if package.document.get('mode'): continue
        for path, node in system_readings(package.document.get('reading', [])):
            key=f'system:{package.pk}:{path}'
            if package.pk in materialized:
                current=native.get(key)
                if not current: continue
                node={'title':current.title,'level':current.level,'topic':current.topic}
                handled.add(current.pk)
            rows.append(summary(key, node['title'], node.get('level', ''), node.get('topic', ''), 'system'))
    for lesson in ReadingLesson.objects.filter(language=request.language, visibility='public', owner__is_active=True).exclude(pk__in=handled).order_by('-updated_at').values('id', 'title', 'level', 'topic', 'owner__is_staff', 'owner__is_superuser'):
        rows.append(summary(f"community:{lesson['id']}", lesson['title'], lesson['level'], lesson['topic'], 'system' if lesson['owner__is_staff'] or lesson['owner__is_superuser'] else 'community'))
    topics = sorted(set(row['topic'] for row in rows if row['topic']), key=str.casefold)
    rows = [r for r in rows if (not query or query in (r['title']+' '+r['topic']).casefold()) and (not level or r['level'] == level) and (not topic or r['topic'].casefold() == topic) and (not source or r['source'] == source)]
    saved = dict(ReadingLesson.objects.filter(owner=request.user, language=request.language).exclude(source_key='').values_list('source_key','id')) if request.user.is_authenticated else {}
    own = set(ReadingLesson.objects.filter(owner=request.user,language=request.language).values_list('id',flat=True)) if request.user.is_authenticated else set()
    for row in rows:
        row['saved_id'] = saved.get(row['key'])
        if row['key'].startswith('community:') and int(row['key'].split(':')[1]) in own:
            row['saved_id'] = int(row['key'].split(':')[1])
    return JsonResponse({'lessons': rows[(page-1)*24:page*24], 'total': len(rows), 'page': page, 'topics': topics})


@public_endpoint
@require_GET
def detail(request):
    key = request.GET.get('key', '')
    if key.startswith('community:'):
        try: pk = int(key.split(':')[1])
        except (ValueError, IndexError): raise Http404
        lesson = get_object_or_404(ReadingLesson, pk=pk, language=request.language, visibility='public', owner__is_active=True)
        return JsonResponse({'title': lesson.title, 'payload': lesson.payload})
    if key.startswith('system:'):
        try:
            _, pk, path = key.split(':')
            import uuid
            pk = uuid.UUID(pk)
        except (ValueError, AttributeError): raise Http404
        package = get_object_or_404(SystemContentPackage, pk=pk, language=request.language)
        node,_=system_node(package,path)
        return JsonResponse({'title':node['title'],'payload':node['payload']})
    raise Http404


@endpoint
@require_POST
@transaction.atomic
def save(request):
    key = body(request).get('key')
    if not isinstance(key,str) or len(key)>160: raise ValueError('Choose a reading from Explore.')
    get_user_model().objects.select_for_update().get(pk=request.user.pk)
    existing=ReadingLesson.objects.filter(owner=request.user,language=request.language,source_key=key).first()
    if existing: return JsonResponse({'id':existing.pk,'saved':True,'already_saved':True})
    source=None
    if key.startswith('community:'):
        try: pk=int(key.split(':')[1])
        except (ValueError,IndexError): raise Http404
        source=get_object_or_404(ReadingLesson,pk=pk,language=request.language,visibility='public',owner__is_active=True)
        if source.owner_id==request.user.pk: return JsonResponse({'id':source.pk,'saved':True,'already_saved':True})
        node={'title':source.title,'payload':source.payload,'level':source.level,'topic':source.topic}
    elif key.startswith('system:'):
        import uuid
        try:
            _,pk,path=key.split(':');pk=uuid.UUID(pk)
        except (ValueError,AttributeError): raise Http404
        package=get_object_or_404(SystemContentPackage,pk=pk,language=request.language)
        node,source=system_node(package,path)
    else: raise Http404
    payload=deepcopy(node['payload'])
    copies=[]
    if source:
        from practice.models import PracticeMedia
        from .practice_media import media_data
        replacements={}
        copied={}
        for asset in source.attachments.all():
            clone=PracticeMedia.objects.create(owner=request.user,language=request.language,file=asset.file.name,name=asset.name,size=asset.size,content_type=asset.content_type)
            copied[str(asset.pk)]=clone;copies.append(clone)
            replacements[media_data(asset)['url']]=media_data(clone)['url']
        if 'attachments' in payload:
            payload['attachments']=[{**media_data(copied[item['id']]),**({'question':item['question']} if item.get('question') else {})} for item in payload['attachments'] if item.get('id') in copied]
        def remap(value):
            if isinstance(value,dict): return {k:remap(v) for k,v in value.items()}
            if isinstance(value,list): return [remap(v) for v in value]
            if isinstance(value,str):
                for old,new in replacements.items(): value=value.replace(old,new)
            return value
        payload=remap(payload)
    lesson=ReadingLesson.objects.create(owner=request.user,language=request.language,source_key=key,title=node['title'],payload=payload,level=node.get('level',''),topic=node.get('topic',''),visibility='private',completed=[])
    lesson.attachments.set(copies)
    return JsonResponse({'id':lesson.pk,'saved':True,'already_saved':False},status=201)
