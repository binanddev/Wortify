"""Separate administrative API; learner ownership rules remain unchanged."""
import json
import mimetypes
import uuid
from functools import wraps
from pathlib import Path
from django.contrib.auth import get_user_model, update_session_auth_hash
from django.contrib.auth.password_validation import validate_password
from django.contrib.admin.models import LogEntry, CHANGE, ADDITION
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Count, Q
from django.http import JsonResponse, FileResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from content.models import Book, BookAsset
from content.importing import asset_key, resources, save_exercise
from practice.models import Chapter, Exercise
from .common import endpoint,body

def management(permission):
    def decorate(view):
        @endpoint
        @wraps(view)
        def wrapped(request,*args,**kwargs):
            if not request.user.is_active or not (request.user.is_superuser if permission.startswith('auth.') else (request.user.is_staff or request.user.is_superuser)):
                return JsonResponse({'error':'Bạn không có quyền quản trị mục này.'},status=403)
            return view(request,*args,**kwargs)
        return wrapped
    return decorate

def audit(request,obj,message,created=False):
    LogEntry.objects.log_actions(user_id=request.user.pk,queryset=[obj],action_flag=ADDITION if created else CHANGE,change_message=message)

@management('auth.view_user')
@require_http_methods(['GET','POST'])
def users(request):
    User=get_user_model()
    if request.method=='POST':
        if not request.user.has_perm('auth.add_user'):return JsonResponse({'error':'Không có quyền tạo tài khoản.'},status=403)
        data=body(request);username=data.get('username','')
        if not isinstance(username,str) or not username.strip():raise ValueError('Nhập tên tài khoản.')
        user=User(username=username,email=data.get('email',''));user.full_clean(exclude=['password']);validate_password(data.get('password',''),user)
        user.set_password(data['password']);user.save();audit(request,user,'Tạo tài khoản từ quản trị.',True)
        return JsonResponse({'id':user.pk},status=201)
    q=request.GET.get('q','')[:100];qs=User.objects.filter(Q(username__icontains=q)|Q(email__icontains=q)).order_by('username')
    page=max(1,int(request.GET.get('page',1)));total=qs.count()
    return JsonResponse({'users':list(qs[(page-1)*50:page*50].values('id','username','email','is_active','is_staff','is_superuser','last_login','date_joined')),'total':total,'page':page,'can_add':request.user.has_perm('auth.add_user'),'can_edit':request.user.has_perm('auth.change_user'),'superuser':request.user.is_superuser})

@management('auth.change_user')
@require_http_methods(['PATCH'])
@transaction.atomic
def user_detail(request,pk):
    user=get_object_or_404(get_user_model().objects.select_for_update(),pk=pk);data=body(request)
    if (user.is_staff or user.is_superuser) and not request.user.is_superuser:return JsonResponse({'error':'Chỉ quản trị viên cao nhất được sửa tài khoản quản trị.'},status=403)
    for key in ['username','email']:
        if key in data:
            if not isinstance(data[key],str):raise ValueError('Thông tin tài khoản không hợp lệ.')
            setattr(user,key,data[key])
    for key in ['is_active','is_staff']:
        if key in data:
            if not isinstance(data[key],bool):raise ValueError('Trạng thái không hợp lệ.')
            if key=='is_staff' and not request.user.is_superuser:return JsonResponse({'error':'Không được thay quyền quản trị.'},status=403)
            if user.pk==request.user.pk and not data[key]:raise ValueError('Không thể tự khóa hoặc gỡ quyền tài khoản hiện tại.')
            if user.is_superuser and not data[key]:raise ValueError('Không khóa hoặc gỡ quyền superuser tại đây.')
            setattr(user,key,data[key])
    if data.get('password'):
        if not isinstance(data['password'],str):raise ValueError('Mật khẩu không hợp lệ.')
        validate_password(data['password'],user);user.set_password(data['password'])
    user.full_clean();user.save()
    if user.pk==request.user.pk and data.get('password'):update_session_auth_hash(request,user)
    audit(request,user,'Cập nhật thông tin, trạng thái hoặc đặt lại mật khẩu. Không ghi mật khẩu vào nhật ký.')
    return JsonResponse({'ok':True})

@management('content.view_book')
@require_http_methods(['GET','POST'])
def admin_books(request):
    if request.method=='POST':
        from django.utils.text import slugify
        data=body(request)
        if data.get('language') not in ['en','de']:raise ValueError('Chọn ngôn ngữ en hoặc de.')
        title=data.get('title')
        if not isinstance(title,str) or not title.strip() or len(title)>200:raise ValueError('Tên sách cần từ 1 đến 200 ký tự.')
        book=Book(title=title.strip(),language=data['language'],author=data.get('author',''),description=data.get('description',''),level=data.get('level',''),slug=(slugify(title)[:36] or 'book')+'-'+uuid.uuid4().hex[:8])
        book.full_clean();book.save();audit(request,book,'Tạo sách mới.',True)
        return JsonResponse({'id':book.pk},status=201)
    return JsonResponse({'books':list(Book.objects.annotate(chapter_count=Count('chapters',distinct=True),asset_count=Count('assets',distinct=True)).values('id','title','language','chapter_count','asset_count'))})

@management('content.change_book')
@require_http_methods(['GET','PATCH'])
def admin_book(request,pk):
    book=get_object_or_404(Book,pk=pk)
    if request.method=='PATCH':
        data=body(request)
        for key in ['title','description','author']:
            if key in data:
                if not isinstance(data[key],str):raise ValueError('Nội dung không hợp lệ.')
                setattr(book,key,data[key])
        book.full_clean();book.save();audit(request,book,'Chỉnh thông tin sách.')
    exercises=Exercise.objects.filter(chapter__book=book).prefetch_related('questions').select_related('chapter')
    refs={}
    for chapter in book.chapters.all():
        for r in chapter.theory.get('resources',[]):refs.setdefault(r['file'],{**r,'uses':[]})['uses'].append(chapter.title)
    for e in exercises:
        for r in resources(e.source_document):refs.setdefault(r['file'],{**r,'uses':[]})['uses'].append(e.source_id)
        for q in e.questions.all():
            for r in q.presentation.get('resources',[]):refs.setdefault(r['file'],{**r,'uses':[]})['uses'].append(f'{e.source_id} / {q.position}')
    assets={a.key:a for a in book.assets.all()}
    for key,a in assets.items():refs.setdefault(key,{'file':key,'type':a.kind,'uses':[]})
    return JsonResponse({'book':{'id':book.pk,'title':book.title,'description':book.description,'author':book.author},'resources':[{**r,'uploaded':k in assets,'id':assets[k].pk if k in assets else None,'url':f'/api/{book.language}/book-assets/{assets[k].pk}/' if k in assets else None,'description':assets[k].description if k in assets else ''} for k,r in sorted(refs.items())],'chapters':[{'id':c.pk,'number':c.number,'title':c.title,'theory':c.theory} for c in book.chapters.all()],'exercises':[{'id':e.pk,'number':e.number,'chapter':e.chapter.number,'title':e.title,'type':e.presentation.get('type',e.source_type),'source_type':e.source_type,'published':e.reviewed,'manual':e.check_mode!='auto_check','warnings':e.import_warnings} for e in exercises]})

@management('practice.change_exercise')
@require_http_methods(['GET','PATCH'])
def admin_exercise(request,pk):
    item=get_object_or_404(Exercise,pk=pk)
    if request.method=='PATCH':
        data=body(request);source=data.get('source')
        if not isinstance(source,dict):raise ValueError('Nội dung phải là một bài tập JSON.')
        source={**source,'id':item.source_id or item.number}
        item,_=save_exercise(item.chapter,source,existing=item);audit(request,item,'Chỉnh nội dung JSON bài tập.')
    return JsonResponse({'id':item.pk,'title':item.title,'source':item.source_document,'warnings':item.import_warnings})

@management('practice.change_chapter')
@require_http_methods(['PATCH'])
def admin_chapter(request,pk):
    item=get_object_or_404(Chapter,pk=pk);data=body(request)
    if not isinstance(data.get('theory'),dict):raise ValueError('Lý thuyết phải là đối tượng JSON.')
    from content.ingestion import validate_theory
    validate_theory(data['theory'])
    item.theory=data['theory'];item.title=data.get('title',item.title);item.full_clean();item.save();audit(request,item,'Chỉnh lý thuyết chương.')
    return JsonResponse({'ok':True})

ALLOWED={'.png':'image','.jpg':'image','.jpeg':'image','.webp':'image','.gif':'image','.mp3':'audio','.wav':'audio','.ogg':'audio','.m4a':'audio','.webm':'audio'}

def validate_media(upload):
    suffix=Path(upload.name).suffix.lower()
    if suffix not in ALLOWED or upload.size>10*1024*1024:raise ValueError(f'{upload.name}: chỉ nhận ảnh/audio, tối đa 10 MB mỗi tệp.')
    head=upload.read(20);upload.seek(0)
    signatures={'.png':head.startswith(b'\x89PNG\r\n\x1a\n'),'.jpg':head.startswith(b'\xff\xd8\xff'),'.jpeg':head.startswith(b'\xff\xd8\xff'),'.gif':head.startswith((b'GIF87a',b'GIF89a')),'.webp':head.startswith(b'RIFF') and head[8:12]==b'WEBP','.wav':head.startswith(b'RIFF') and head[8:12]==b'WAVE','.ogg':head.startswith(b'OggS'),'.mp3':head.startswith(b'ID3') or (len(head)>1 and head[0]==255 and head[1]&224==224),'.m4a':head[4:8]==b'ftyp','.webm':head.startswith(b'\x1aE\xdf\xa3')}
    if not signatures[suffix]:raise ValueError(f'{upload.name}: nội dung tệp không khớp định dạng.')
    return suffix,ALLOWED[suffix]

@management('content.change_book')
@require_http_methods(['POST'])
def upload_assets(request,pk):
    book=get_object_or_404(Book,pk=pk)
    files=request.FILES.getlist('files');keys=json.loads(request.POST.get('keys','[]'));descriptions=json.loads(request.POST.get('descriptions','[]'))
    if not files or len(files)>20 or len(keys)!=len(files) or not isinstance(keys,list):raise ValueError('Mỗi lượt chọn 1–20 tệp và đường dẫn tương ứng.')
    if sum(f.size for f in files)>50*1024*1024:raise ValueError('Tổng tệp tối đa 50 MB mỗi lượt.')
    keys=[asset_key(k) for k in keys]
    if len(set(keys))!=len(keys):raise ValueError('Có đường dẫn trùng nhau trong lượt tải.')
    metadata=[validate_media(f) for f in files]
    if any(Path(k).suffix.lower()!=suffix for k,(suffix,kind) in zip(keys,metadata)):raise ValueError('Đuôi đường dẫn đích phải khớp tệp tải lên.')
    written=[]
    try:
        with transaction.atomic():
            for i,(key,upload,(suffix,kind)) in enumerate(zip(keys,files,metadata)):
                obj,_=BookAsset.objects.get_or_create(book=book,key=key,defaults={'kind':kind})
                obj.kind=kind;obj.description=str(descriptions[i] if i<len(descriptions) else '')[:300]
                obj.file.save(uuid.uuid4().hex+suffix,upload,save=False);written.append((obj.file.storage,obj.file.name));obj.save();audit(request,obj,'Tải tài nguyên sách.')
    except Exception:
        for storage,name in written:storage.delete(name)
        raise
    return JsonResponse({'uploaded':len(files)})

@endpoint
@require_http_methods(['GET'])
def book_asset(request,pk):
    asset=get_object_or_404(BookAsset,pk=pk,book__language=request.language)
    if not asset.file or not asset.file.storage.exists(asset.file.name):return JsonResponse({'error':'Tệp chưa có trên máy chủ.'},status=404)
    response=FileResponse(asset.file.open('rb'),content_type=mimetypes.guess_type(asset.file.name)[0] or 'application/octet-stream')
    response['Cache-Control']='private, no-store';response['X-Content-Type-Options']='nosniff'
    return response

@management('content.change_book')
@require_http_methods(['POST'])
def json_preview(request,pk):
    from content.models import BookImportBatch
    from content.ingestion import validate_document
    from django.utils import timezone
    from datetime import timedelta
    book=get_object_or_404(Book,pk=pk)
    documents=[];summary=[]
    if request.content_type=='application/json':
        incoming=body(request).get('documents')
        if not isinstance(incoming,list) or not 1<=len(incoming)<=20:raise ValueError('Chọn 1–20 chương.')
        if len(json.dumps(incoming).encode())>20*1024*1024:raise ValueError('Tổng JSON tối đa 20 MB.')
        entries=[(f'Chương {i+1}',d) for i,d in enumerate(incoming)]
    else:
        files=request.FILES.getlist('files')
        if not 1<=len(files)<=20 or sum(f.size for f in files)>20*1024*1024:raise ValueError('Chọn 1–20 JSON, tổng tối đa 20 MB.')
        entries=[]
        for file in files:
            if not file.name.lower().endswith('.json') or file.size>5*1024*1024:raise ValueError('Mỗi tệp JSON tối đa 5 MB.')
            try:doc=json.loads(file.read().decode('utf-8-sig'))
            except (ValueError,UnicodeDecodeError):raise ValueError(f'{file.name}: JSON không hợp lệ, cần UTF-8. Mở Tài liệu để kiểm tra và sửa nội dung.')
            entries.append((file.name,doc))
    for name,doc in entries:
        checked=validate_document(book,doc)
        previous=Chapter.objects.filter(book=book,number=checked['number']).first()
        checked.update(file=name,action='Bổ sung / cập nhật chương' if previous else 'Tạo chương mới')
        summary.append(checked);documents.append(doc)
    if len({r['number'] for r in summary})!=len(summary):raise ValueError('Số chương bị trùng giữa các tệp. Gộp các bài bổ sung của cùng chương vào một JSON.')
    BookImportBatch.objects.filter(owner=request.user,confirmed_at__isnull=True,created_at__lt=timezone.now()-timedelta(hours=1)).delete()
    batch=BookImportBatch.objects.create(book=book,owner=request.user,documents=documents,summary=summary)
    return JsonResponse({'token':str(batch.token),'chapters':summary,'documents':documents,'message':'Chưa ghi nội dung sách. Kiểm tra trước khi xác nhận.'})

@management('content.change_book')
@require_http_methods(['POST'])
@transaction.atomic
def json_confirm(request,pk):
    from content.models import BookImportBatch
    from content.ingestion import ingest_documents
    from django.utils import timezone
    from datetime import timedelta
    batch=get_object_or_404(BookImportBatch.objects.select_for_update(),token=body(request).get('token'),book_id=pk,owner=request.user)
    if batch.confirmed_at:return JsonResponse(batch.summary)
    if batch.created_at<timezone.now()-timedelta(hours=1):raise ValueError('Bản xem trước hết hạn. Hãy chọn lại tệp.')
    result=ingest_documents(batch.book,batch.documents)
    batch.confirmed_at=timezone.now();batch.summary=result;batch.documents=[];batch.save(update_fields=['confirmed_at','summary','documents'])
    audit(request,batch.book,f'Nhập {result["chapters"]} chương từ JSON tải lên.')
    return JsonResponse(result)

@management('content.view_book')
@require_http_methods(['GET'])
def json_template(request):
    from content.ingestion import TEMPLATE
    response=JsonResponse(TEMPLATE,json_dumps_params={'ensure_ascii':False,'indent':2})
    response['Content-Disposition']='attachment; filename="lernraum-chapter-v1.json"'
    return response


@management('content.view_book')
@require_http_methods(['GET','POST'])
def json_documentation(request):
    from content.schema import TYPES,ALIASES
    from content.ingestion import validate_document
    from types import SimpleNamespace
    if request.method=='POST':
        data=body(request);doc=data.get('document')
        language=data.get('language','en')
        if language not in ['en','de']:raise ValueError('Ngôn ngữ không hợp lệ.')
        result=validate_document(SimpleNamespace(language=language),doc)
        from content.ingestion import canonicalize_document
        return JsonResponse({'summary':result,'document':canonicalize_document(doc)})
    from content.importing import normalize
    types=[]
    for entry in TYPES:
        n=normalize(entry['example'])
        preview={'exercise':{**entry['example'],'presentation':n['presentation'],'check_mode':n['check_mode']},'questions':[{**q,'id':i+1,'blank_count':len(q['blanks'])} for i,q in enumerate(n['rows'])],'assets':{}}
        types.append({**entry,'preview':preview})
    return JsonResponse({'version':1,'types':types,'aliases':ALIASES})
