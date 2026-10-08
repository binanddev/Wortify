"""Practice Hub API: folder trees and folder-based practice/theory, automatic grading and batch persistence."""
from django.db import transaction
from django.db.models import Q, Prefetch
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from practice.models import PracticeNode, PracticeProgress
from types import SimpleNamespace
from practice.schema import MODES, validate_presentation, validate_question
from .common import endpoint, body
from copy import deepcopy

def visible(request):
    access=Q(owner=request.user)|Q(visibility='public')
    for prefix in ('parent__'*depth for depth in range(11)):
        access |= Q(**{prefix+'class_assignments__classroom__members':request.user})
    return PracticeNode.objects.filter(language=request.language).filter(access).distinct()

def node_data(n,user):
    progress=next((p for p in n.learning_progress.all() if p.user_id==user.pk and p.revision==n.updated_at.isoformat()),None)
    return {'id':n.pk,'parent':n.parent_id,'kind':n.kind,'title':n.title,'payload':n.payload,'tags':n.payload.get('tags',[]) if n.kind=='folder' and not n.parent_id else [],'links':[r.pk for r in n.links.all()], 'visibility':n.visibility,'position':n.position,'can_edit':n.owner_id==user.pk,'updated_at':n.updated_at.isoformat(),'interaction':n.payload.get('presentation',{}).get('interaction') if n.kind=='exercise' else None,'progress':{'completed':progress.completed if progress else []}}

def validate_payload(kind,payload):
    if not isinstance(payload,dict):raise ValueError('Content must be a JSON object.')
    if kind=='theory':
        if payload.get('format','markdown') not in ('markdown','html'):raise ValueError('Theory supports HTML or Markdown.')
        if not isinstance(payload.get('content',''),str) or len(payload.get('content',''))>2_000_000:raise ValueError('Theory text must not exceed 2 MB.')
    if kind=='exercise':
        if payload.get('kind')=='writing':raise ValueError('Long-form writing exercises are not supported.')
        if not isinstance(payload.get('presentation',{}),dict):raise ValueError('presentation must be a JSON object.')
        mode=payload.get('presentation',{}).get('interaction','short_answer')
        if mode not in MODES:raise ValueError('Invalid exercise type.')
        question_kind=MODES[mode]
        if mode=='multiple_choice' and payload.get('kind')=='multi':question_kind='multi'
        payload['kind']=question_kind
        payload['check_mode']='auto_check'
        questions=payload.get('questions',[])
        if not isinstance(questions,list) or not 1<=len(questions)<=100:raise ValueError('Each exercise requires 1–100 questions.')
        e=SimpleNamespace(kind=question_kind,check_mode=payload['check_mode'])
        cleaned=[]
        for i,data in enumerate(questions,1):
            if not isinstance(data,dict):raise ValueError('A question must be an object.')
            q=SimpleNamespace(exercise=e,position=i,kind=question_kind,prompt=data.get('prompt',''),accepted_answers=data.get('accepted_answers',[]),options=data.get('options',[]),blanks=data.get('blanks',[]),presentation=data.get('presentation',{}),example=bool(data.get('example',False)))
            
            if not isinstance(q.prompt,str) or not q.prompt.strip():raise ValueError('Questions require content.')
            if not isinstance(q.blanks,list):raise ValueError('blanks must be an array.')
            if isinstance(q.presentation,dict):q.presentation.pop('manual',None)
            validate_question(q);validate_presentation(q,mode)
            cleaned.append({'id':str(i),'position':i,'kind':question_kind,'prompt':q.prompt,'accepted_answers':q.accepted_answers,'options':q.options,'blanks':q.blanks,'presentation':q.presentation,'example':q.example,'blank_count':len(q.blanks),'blank_options':[b.get('options',[]) for b in q.blanks]})
        payload['questions']=cleaned
    return payload

def tree_height(node):
    return (1 if node.kind=='folder' else 0)+max((tree_height(c) for c in node.children.all()),default=0)

def save_node(request,data,node=None):
    kind=data.get('kind',node.kind if node else 'exercise')
    if kind not in ('folder','exercise','theory'):raise ValueError('Choose folder, exercise or theory.')
    if node and kind!=node.kind:raise ValueError('The type of existing content cannot be changed.')
    title=data.get('title',node.title if node else '')
    if not isinstance(title,str) or not title.strip() or len(title)>200:raise ValueError('Content titles must contain 1–200 characters.')
    parent_id=data.get('parent',node.parent_id if node else None) or None
    parent=get_object_or_404(PracticeNode,pk=parent_id,owner=request.user,language=request.language,kind='folder') if parent_id else None
    if kind=='exercise' and parent is None:raise ValueError('Choose a folder before adding or moving exercises.')
    p=parent;depth=0;seen=set()
    while p:
        if p.pk in seen or (node and p.pk==node.pk):raise ValueError('A folder cannot be moved into itself or a descendant.')
        seen.add(p.pk);depth+=1;p=p.parent
    height=tree_height(node) if node else (1 if kind=='folder' else 0)
    if depth+height>10:raise ValueError('Up to 10 folder levels, including moved descendants.')
    previous_payload=deepcopy(node.payload) if node else None
    payload=validate_payload(kind,data.get('payload',node.payload if node else {}))
    tags=data.get('tags',payload.get('tags',[]))
    if not isinstance(tags,list) or len(tags)>12 or any(not isinstance(t,str) or not 1<=len(t.strip())<=40 for t in tags):raise ValueError('Up to 12 tags, each 1–40 characters.')
    if kind=='folder' and parent is None:
        payload['tags']=list(dict.fromkeys(t.strip().casefold() for t in tags))
    else:
        if data.get('tags'):raise ValueError('Only root folders can have tags.')
        payload.pop('tags',None)
    from .practice_media import validated_attachments
    attachments=validated_attachments(request,payload) if kind=='exercise' else []
    content_changed=not node or {k:v for k,v in payload.items() if k!='title'}!={k:v for k,v in previous_payload.items() if k!='title'}
    links=data.get('links',list(node.links.values_list('id',flat=True)) if node else [])
    if not isinstance(links,list) or len(links)>100:raise ValueError('Up to 100 links.')
    targets=list(visible(request).filter(pk__in=links))
    if len(targets)!=len(set(links)):raise ValueError('Linked content does not exist or is inaccessible.')
    if node and node.pk in links:raise ValueError('Content cannot link to itself.')
    visibility=data.get('visibility',node.visibility if node else 'private')
    if visibility not in ('private','public'):raise ValueError('Invalid sharing setting.')
    n=node or PracticeNode(owner=request.user,language=request.language)
    n.kind=kind;n.parent=parent;n.title=title.strip();n.payload=payload;n.visibility=visibility;n.position=int(data.get('position',n.position))
    n.full_clean()
    n.save() if content_changed else n.save(update_fields=['kind','parent','title','payload','visibility','position'])
    n.links.set(targets)
    n.attachments.set(attachments)
    return n

@endpoint
@require_http_methods(['GET','POST'])
@transaction.atomic
def nodes(request):
    if request.method=='POST':return JsonResponse({'node':node_data(save_node(request,body(request)),request.user)},status=201)
    # Small metadata response first; full content is fetched once in the background.
    qs=visible(request).prefetch_related('links',Prefetch('learning_progress',queryset=PracticeProgress.objects.filter(user=request.user)))
    rows=[]
    for n in qs:
        d=node_data(n,request.user)
        if request.GET.get('full')!='1':d.pop('payload')
        rows.append(d)
    return JsonResponse({'nodes':rows})

@endpoint
@require_http_methods(['GET','PATCH','DELETE'])
@transaction.atomic
def node(request,pk):
    n=get_object_or_404(visible(request).prefetch_related('links',Prefetch('learning_progress',queryset=PracticeProgress.objects.filter(user=request.user))),pk=pk)
    if request.method=='GET':return JsonResponse({'node':node_data(n,request.user)})
    if n.owner_id!=request.user.pk:return JsonResponse({'error':'Only the owner can edit this content.'},status=403)
    if request.method=='DELETE':n.delete();return JsonResponse({'ok':True})
    return JsonResponse({'node':node_data(save_node(request,body(request),n),request.user)})

@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def import_nodes(request):
    data=body(request);rows=data.get('nodes')
    if not isinstance(rows,list) or not 1<=len(rows)<=100:raise ValueError('JSON requires a nodes array with 1–100 items.')
    created=[]
    def add(items,parent,depth=0):
        if depth>10:raise ValueError('Up to 10 folder levels.')
        for row in items:
            if len(created)>=500:raise ValueError('Up to 500 items per import.')
            if not isinstance(row,dict):raise ValueError('Each item must be an object.')
            n=save_node(request,{**row,'parent':parent,'links':[]});created.append(n.pk)
            children=row.get('children',[])
            if children:
                if n.kind!='folder' or not isinstance(children,list):raise ValueError('Only folders can contain children.')
                add(children,n.pk,depth+1)
    add(rows,data.get('parent'))
    return JsonResponse({'created':created},status=201)


@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def organize(request):
    data=body(request)
    ids=data.get('ids')
    if not isinstance(ids,list) or not 1<=len(ids)<=100 or any(type(i) is not int for i in ids) or len(set(ids))!=len(ids):
        raise ValueError('Choose 1–100 distinct items.')
    owned={n.pk:n for n in PracticeNode.objects.select_for_update().filter(owner=request.user,language=request.language)}
    if any(i not in owned for i in ids):raise ValueError('Only the owner can organize this content.')
    action=data.get('action','move')
    if action=='restore':
        placements=data.get('placements')
        if not isinstance(placements,list) or len(placements)!=len(ids) or any(not isinstance(p,dict) or p.get('id')!=pk for p,pk in zip(placements,ids)):
            raise ValueError('Invalid undo data.')
        for placement in placements:
            save_node(request,{'parent':placement.get('parent'),'position':placement.get('position',0)},owned[placement['id']])
        return JsonResponse({'ok':True})
    if action=='reorder':
        parents={owned[i].parent_id for i in ids}
        if len(parents)!=1:raise ValueError('Reorder items within the same folder only.')
        siblings=[n.pk for n in owned.values() if n.parent_id==owned[ids[0]].parent_id]
        # Preserve the positions of retired/hidden items outside this selection.
        replacement=iter(ids)
        ordered=[next(replacement) if pk in ids else pk for pk in siblings]
        for position,pk in enumerate(ordered):
            PracticeNode.objects.filter(pk=pk).update(position=position)
        return JsonResponse({'ok':True})
    if action not in ('move','group'):raise ValueError('Invalid action.')
    for pk in ids:
        ancestor=owned[pk].parent_id
        while ancestor in owned:
            if ancestor in ids:raise ValueError('Choose either the folder or its children, not both.')
            ancestor=owned[ancestor].parent_id
    parent=data.get('parent') or None
    if parent is not None and (type(parent) is not int or parent not in owned or owned[parent].kind!='folder'):
        raise ValueError('Choose a folder you own.')
    if action=='group':
        folder=save_node(request,{'kind':'folder','title':data.get('title','New exercise group'),'parent':parent})
        parent=folder.pk
    offset=PracticeNode.objects.filter(owner=request.user,language=request.language,parent_id=parent).count()
    for index,pk in enumerate(ids):
        save_node(request,{'parent':parent,'position':offset+index},owned[pk])
    return JsonResponse({'ok':True,'parent':parent})


PUBLIC_MODES = {'cloze_drag_drop', 'error_correction', 'matching', 'sentence_building', 'categorization', 'inline_selection', 'short_answer'}


def search_text(value):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFD', str(value).casefold().replace('đ', 'd')) if unicodedata.category(c) != 'Mn')


@endpoint
@require_http_methods(['GET'])
def explore(request):
    if request.GET.get('browse')=='1':
        from .explore_discovery import browse
        return browse(request)
    query = request.GET.get('q', '').strip()[:200]
    mode = request.GET.get('mode', '')
    kind = request.GET.get('kind', '')
    sort = request.GET.get('sort', 'relevance')
    if mode and mode not in PUBLIC_MODES: raise ValueError('Invalid exercise type.')
    if kind not in ('', 'exercise', 'theory', 'folder'): raise ValueError('Invalid content type.')
    if sort not in ('relevance', 'newest'): raise ValueError('Invalid order.')
    page = max(1, int(request.GET.get('page', 1)))
    terms = search_text(query).split()
    # Recognize common bilingual topic names without pretending to be semantic search.
    aliases = [('thi hien tai don', 'present simple'), ('thi qua khu don', 'past simple'), ('thi hien tai tiep dien', 'present continuous')]
    alternatives = [terms]
    for vietnamese, english in aliases:
        if search_text(query) in (vietnamese, english): alternatives = [vietnamese.split(), english.split()]
    qs = PracticeNode.objects.filter(language=request.language, visibility='public').select_related('owner')
    if kind: qs = qs.filter(kind=kind)
    results = []
    for node in qs.iterator(chunk_size=200):
        payload = node.payload
        interaction = payload.get('presentation', {}).get('interaction', 'short_answer') if node.kind == 'exercise' else ''
        if node.kind == 'exercise' and interaction not in PUBLIC_MODES: continue
        if mode and interaction != mode: continue
        author = node.owner.get_full_name().strip() or node.owner.get_username()
        title = search_text(node.title)
        description = str(payload.get('instruction') or payload.get('context') or '')
        searchable = ' '.join([title, search_text(description), search_text(author), search_text(payload.get('context', '')), search_text(payload.get('content', '')), ' '.join(search_text(q.get('prompt', '')) for q in payload.get('questions', []))])
        matching = [group for group in alternatives if all(term in searchable for term in group)]
        if not matching: continue
        score = max(sum(3 if term in title else 1 for term in group) for group in matching)
        results.append((score, node.updated_at, node.pk, {
            'id':node.pk, 'title':node.title, 'kind':node.kind, 'interaction':interaction,
            'description':description[:200], 'author':author,
            'question_count':len(payload.get('questions', [])), 'updated_at':node.updated_at.isoformat(),
            'can_edit':node.owner_id == request.user.pk,
        }))
    results.sort(key=lambda item: (item[1], item[2]) if sort == 'newest' else item[:3], reverse=True)
    total = len(results)
    pages = max(1, (total + 17) // 18)
    page = min(page, pages)
    return JsonResponse({'results':[item[3] for item in results[(page-1)*18:page*18]], 'total':total, 'page':page, 'pages':pages})
