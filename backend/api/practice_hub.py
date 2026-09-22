"""Practice Hub API: folder trees and standalone practice/theory, automatic grading and batch persistence."""
from django.db import transaction
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from practice.models import PracticeNode
from types import SimpleNamespace
from practice.schema import MODES, validate_presentation, validate_question
from .common import endpoint, body

def visible(request):
    access=Q(owner=request.user)|Q(visibility='public')
    for prefix in ('','parent__','parent__parent__','parent__parent__parent__'):
        access |= Q(**{prefix+'class_assignments__classroom__members':request.user})
    return PracticeNode.objects.filter(language=request.language).filter(access).distinct()

def node_data(n,user):
    return {'id':n.pk,'parent':n.parent_id,'kind':n.kind,'title':n.title,'payload':n.payload,'links':[r.pk for r in n.links.all()], 'visibility':n.visibility,'position':n.position,'can_edit':n.owner_id==user.pk,'updated_at':n.updated_at.isoformat()}

def validate_payload(kind,payload):
    if not isinstance(payload,dict):raise ValueError('Nội dung phải là đối tượng JSON.')
    if kind=='theory':
        if payload.get('format','markdown') not in ('markdown','html'):raise ValueError('Lý thuyết dùng HTML hoặc Markdown.')
        if not isinstance(payload.get('content',''),str) or len(payload.get('content',''))>2_000_000:raise ValueError('Lý thuyết tối đa 2 MB văn bản.')
    if kind=='exercise':
        if payload.get('kind')=='writing':raise ValueError('Bài viết dài không được hỗ trợ.')
        if not isinstance(payload.get('presentation',{}),dict):raise ValueError('presentation phải là đối tượng JSON.')
        mode=payload.get('presentation',{}).get('interaction','short_answer')
        if mode not in MODES:raise ValueError('Dạng bài không hợp lệ.')
        question_kind=MODES[mode]
        if mode=='multiple_choice' and payload.get('kind')=='multi':question_kind='multi'
        payload['kind']=question_kind
        payload['check_mode']='auto_check'
        questions=payload.get('questions',[])
        if not isinstance(questions,list) or not 1<=len(questions)<=100:raise ValueError('Mỗi bài cần 1–100 câu hỏi.')
        e=SimpleNamespace(kind=question_kind,check_mode=payload['check_mode'])
        cleaned=[]
        for i,data in enumerate(questions,1):
            if not isinstance(data,dict):raise ValueError('Câu hỏi phải là đối tượng.')
            q=SimpleNamespace(exercise=e,position=i,kind=question_kind,prompt=data.get('prompt',''),accepted_answers=data.get('accepted_answers',[]),options=data.get('options',[]),blanks=data.get('blanks',[]),presentation=data.get('presentation',{}),example=bool(data.get('example',False)))
            
            if not isinstance(q.prompt,str) or not q.prompt.strip():raise ValueError('Câu hỏi cần nội dung.')
            if not isinstance(q.blanks,list):raise ValueError('blanks phải là mảng.')
            if isinstance(q.presentation,dict):q.presentation.pop('manual',None)
            validate_question(q);validate_presentation(q,mode)
            cleaned.append({'id':str(i),'position':i,'kind':question_kind,'prompt':q.prompt,'accepted_answers':q.accepted_answers,'options':q.options,'blanks':q.blanks,'presentation':q.presentation,'example':q.example,'blank_count':len(q.blanks),'blank_options':[b.get('options',[]) for b in q.blanks]})
        payload['questions']=cleaned
    return payload

def tree_height(node):
    return (1 if node.kind=='folder' else 0)+max((tree_height(c) for c in node.children.all()),default=0)

def save_node(request,data,node=None):
    kind=data.get('kind',node.kind if node else 'exercise')
    if kind not in ('folder','exercise','theory'):raise ValueError('Chọn thư mục, bài tập hoặc lý thuyết.')
    if node and kind!=node.kind:raise ValueError('Không đổi loại nội dung đang tồn tại.')
    title=data.get('title',node.title if node else '')
    if not isinstance(title,str) or not title.strip() or len(title)>200:raise ValueError('Tên nội dung cần 1–200 ký tự.')
    parent_id=data.get('parent',node.parent_id if node else None) or None
    parent=get_object_or_404(PracticeNode,pk=parent_id,owner=request.user,language=request.language,kind='folder') if parent_id else None
    p=parent;depth=0;seen=set()
    while p:
        if p.pk in seen or (node and p.pk==node.pk):raise ValueError('Không chuyển thư mục vào chính nó hoặc con của nó.')
        seen.add(p.pk);depth+=1;p=p.parent
    height=tree_height(node) if node else (1 if kind=='folder' else 0)
    if depth+height>3:raise ValueError('Tối đa 3 cấp thư mục, kể cả thư mục con được di chuyển.')
    payload=validate_payload(kind,data.get('payload',node.payload if node else {}))
    links=data.get('links',list(node.links.values_list('id',flat=True)) if node else [])
    if not isinstance(links,list) or len(links)>100:raise ValueError('Tối đa 100 liên kết.')
    targets=list(visible(request).filter(pk__in=links))
    if len(targets)!=len(set(links)):raise ValueError('Nội dung liên kết không tồn tại hoặc không được truy cập.')
    if node and node.pk in links:raise ValueError('Không liên kết nội dung với chính nó.')
    visibility=data.get('visibility',node.visibility if node else 'private')
    if visibility not in ('private','public'):raise ValueError('Chia sẻ không hợp lệ.')
    n=node or PracticeNode(owner=request.user,language=request.language)
    n.kind=kind;n.parent=parent;n.title=title.strip();n.payload=payload;n.visibility=visibility;n.position=int(data.get('position',n.position))
    n.full_clean();n.save();n.links.set(targets)
    return n

@endpoint
@require_http_methods(['GET','POST'])
@transaction.atomic
def nodes(request):
    if request.method=='POST':return JsonResponse({'node':node_data(save_node(request,body(request)),request.user)},status=201)
    # Small metadata response first; full content is fetched once in the background.
    qs=visible(request).prefetch_related('links')
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
    n=get_object_or_404(visible(request).prefetch_related('links'),pk=pk)
    if request.method=='GET':return JsonResponse({'node':node_data(n,request.user)})
    if n.owner_id!=request.user.pk:return JsonResponse({'error':'Chỉ chủ sở hữu được sửa nội dung.'},status=403)
    if request.method=='DELETE':n.delete();return JsonResponse({'ok':True})
    return JsonResponse({'node':node_data(save_node(request,body(request),n),request.user)})

@endpoint
@require_http_methods(['POST'])
@transaction.atomic
def import_nodes(request):
    data=body(request);rows=data.get('nodes')
    if not isinstance(rows,list) or not 1<=len(rows)<=100:raise ValueError('JSON cần mảng nodes gồm 1–100 mục.')
    created=[]
    def add(items,parent,depth=0):
        if depth>3:raise ValueError('Tối đa 3 cấp thư mục.')
        for row in items:
            if len(created)>=500:raise ValueError('Tối đa 500 nội dung trong một lần nhập.')
            if not isinstance(row,dict):raise ValueError('Mỗi mục phải là đối tượng.')
            n=save_node(request,{**row,'parent':parent,'links':[]});created.append(n.pk)
            children=row.get('children',[])
            if children:
                if n.kind!='folder' or not isinstance(children,list):raise ValueError('Chỉ thư mục chứa children.')
                add(children,n.pk,depth+1)
    add(rows,data.get('parent'))
    return JsonResponse({'created':created},status=201)
