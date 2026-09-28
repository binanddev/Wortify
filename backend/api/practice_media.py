"""Private exercise assets, authorized using the same visibility rules as exercises."""
import re
import uuid
import av
from django.http import JsonResponse, FileResponse, StreamingHttpResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.http import require_http_methods
from practice.models import PracticeMedia
from .common import endpoint

MAX_BYTES = 200 * 1024 * 1024

def media_data(item):
    return {'id':str(item.pk),'name':item.name,'size':item.size,'type':item.content_type,
            'url':f'/api/{item.language}/practice-hub/media/{item.pk}/'}

def validated_attachments(request, payload):
    values = payload.get('attachments', [])
    if not isinstance(values,list) or len(values)>20:raise ValueError('Tối đa 20 tệp, tổng dung lượng 200 MB mỗi bài.')
    try: ids = [uuid.UUID(str(item['id'])) for item in values]
    except (ValueError,TypeError,KeyError,AttributeError):raise ValueError('Tệp đính kèm không hợp lệ.')
    if len(set(ids))!=len(ids):raise ValueError('Tệp đính kèm bị lặp.')
    rows = {item.pk:item for item in PracticeMedia.objects.filter(pk__in=ids,owner=request.user,language=request.language)}
    if len(rows)!=len(ids):raise ValueError('Tệp không thuộc tài khoản hoặc ngôn ngữ hiện tại.')
    items=[rows[pk] for pk in ids]
    if sum(item.size for item in items)>MAX_BYTES:raise ValueError('Tổng tệp đính kèm tối đa 200 MB mỗi bài.')
    if values or 'attachments' in payload:payload['attachments']=[media_data(item) for item in items]
    return items

@endpoint
@require_http_methods(['POST'])
def upload(request):
    files=request.FILES.getlist('file')
    if len(files)!=1:raise ValueError('Chọn một tệp MP3 hoặc hình ảnh, tối đa 200 MB.')
    source=files[0]
    if not 0 < source.size <= MAX_BYTES:raise ValueError('Tệp tối đa 200 MB.')
    extension=source.name.rsplit('.',1)[-1].lower()
    allowed={'mp3':'audio/mpeg','png':'image/png','jpg':'image/jpeg','jpeg':'image/jpeg','webp':'image/webp','gif':'image/gif'}
    if extension not in allowed:raise ValueError('Chỉ nhận MP3, PNG, JPG, WebP hoặc GIF.')
    try:
        formats={'mp3':'mp3','png':'png_pipe','jpg':'jpeg_pipe','jpeg':'jpeg_pipe','webp':'webp_pipe','gif':'gif'}
        # Force the expected demuxer; never auto-detect playlists or network formats.
        with av.open(source,format=formats[extension]) as container:
            streams=container.streams.audio if extension=='mp3' else container.streams.video
            if not streams:raise ValueError('Không đọc được tệp.')
            stream=streams[0]
            codecs={'mp3':{'mp3','mp3float'},'png':{'png'},'jpg':{'mjpeg'},'jpeg':{'mjpeg'},'webp':{'webp'},'gif':{'gif'}}
            if stream.codec_context.name not in codecs[extension]:raise ValueError('Định dạng tệp không khớp phần mở rộng.')
            if extension!='mp3' and stream.codec_context.width*stream.codec_context.height>40_000_000:raise ValueError('Hình ảnh tối đa 40 triệu điểm ảnh.')
            next(container.decode(stream))
    except Exception as exc:
        raise ValueError('Tệp bị lỗi hoặc không đúng định dạng MP3/hình ảnh.') from exc
    source.seek(0)
    item=PracticeMedia(owner=request.user,language=request.language,name=source.name[:255],size=source.size,content_type=allowed[extension])
    try:
        item.file.save(f'{uuid.uuid4().hex}.{extension}',source,save=False)
        item.save()
    except Exception:
        if item.file.name:item.file.delete(save=False)
        raise
    return JsonResponse({'media':media_data(item)},status=201)

@endpoint
@require_http_methods(['GET','HEAD'])
def content(request,pk):
    from .practice_hub import visible
    item=get_object_or_404(PracticeMedia,pk=pk,language=request.language)
    if item.owner_id!=request.user.pk and not visible(request).filter(attachments=item).exists():
        from django.http import Http404
        raise Http404
    start,end=0,item.size-1
    range_header=request.headers.get('Range')
    if range_header:
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',range_header)
        if not match or not any(match.groups()):return HttpResponse(status=416,headers={'Content-Range':f'bytes */{item.size}'})
        left,right=match.groups()
        if left:start=int(left);end=min(int(right),end) if right else end
        else:start=max(0,item.size-int(right))
        if start>end or start>=item.size:return HttpResponse(status=416,headers={'Content-Range':f'bytes */{item.size}'})
    def chunks():
        with item.file.open('rb') as file:
            file.seek(start);remaining=end-start+1
            while remaining:
                chunk=file.read(min(65536,remaining))
                if not chunk:break
                remaining-=len(chunk);yield chunk
    response=StreamingHttpResponse([] if request.method=='HEAD' else chunks(),status=206 if range_header else 200,content_type=item.content_type)
    response['Content-Length']=end-start+1
    response['Accept-Ranges']='bytes'
    response['X-Content-Type-Options']='nosniff'
    response['Cache-Control']='private, no-store'
    if range_header:response['Content-Range']=f'bytes {start}-{end}/{item.size}'
    return response
