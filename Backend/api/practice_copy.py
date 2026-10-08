"""Copy a public collection into a reader's private, independently editable library."""
from copy import deepcopy
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from practice.models import PracticeNode, PracticeMedia
from .common import endpoint
from .practice_media import media_data

@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def copy_collection(request, pk):
    source = get_object_or_404(PracticeNode, pk=pk, language=request.language, visibility='public')
    selected = source
    # Validate every ancestor before copying the selected public subtree.
    seen = set()
    while source.parent_id:
        if source.pk in seen: raise ValueError('Invalid folder tree.')
        seen.add(source.pk)
        source = get_object_or_404(PracticeNode, pk=source.parent_id, language=request.language, visibility='public')
    if source.owner_id == request.user.pk: raise ValueError('Your content is already in My Exercise Library.')
    nodes = list(PracticeNode.objects.filter(owner=source.owner, language=request.language, visibility='public').prefetch_related('attachments','links'))
    children = {}
    for node in nodes: children.setdefault(node.parent_id, []).append(node)
    mapping, assets = {}, {}
    def clone(node, parent=None, depth=1):
        if depth > 11 or (node.kind=='folder' and depth>10): raise ValueError('Up to 10 folder levels.')
        payload = deepcopy(node.payload)
        attached = []
        for asset in node.attachments.all():
            if asset.pk not in assets:
                # Uploaded files are immutable; independent ownership records share the bytes.
                assets[asset.pk] = PracticeMedia.objects.create(owner=request.user,language=request.language,file=asset.file.name,name=asset.name,size=asset.size,content_type=asset.content_type)
            attached.append(assets[asset.pk])
        if 'attachments' in payload:
            originals = {str(a.pk):a for a in node.attachments.all()}
            payload['attachments'] = [{**media_data(assets[originals[item['id']].pk]), **({'question':item['question']} if item.get('question') else {})} for item in payload['attachments'] if item.get('id') in originals]
        copy = PracticeNode.objects.create(owner=request.user,language=request.language,parent=parent,kind=node.kind,title=node.title,payload=payload,visibility='private',position=node.position)
        copy.attachments.set(attached)
        mapping[node.pk] = copy
        for child in children.get(node.pk,[]): clone(child,copy,depth+1)
        return copy
    if selected.kind == 'folder':
        root = clone(selected)
    else:
        root = PracticeNode.objects.create(owner=request.user,language=request.language,kind='folder',title=source.title,payload={'tags':source.payload.get('tags',[])},visibility='private')
        clone(selected,root,2)
    for node in nodes:
        if node.pk in mapping:
            mapping[node.pk].links.set([mapping[link.pk] for link in node.links.all() if link.pk in mapping])
    return JsonResponse({'id':root.pk,'title':root.title,'count':len(mapping) + (1 if selected.kind != 'folder' else 0)},status=201)
