"""Documented, bounded site exports. Deliberately separate from portable imports."""
import hashlib
import json
import re
from itertools import chain, islice
from copy import deepcopy
import tempfile
import zipfile
from datetime import date
from pathlib import PurePosixPath
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.admin.models import LogEntry
from django.core import serializers
from django.db import connection, models, transaction
from django.db.migrations.recorder import MigrationRecorder
from django.http import FileResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from cards import models as c
from practice import models as p
from users import models as u
from content import models as s
from .admin_backups import selection, MAX_TOTAL
from .common import body
from .management import management, audit

MODULES = ('cards', 'practice', 'reading')
MAX_RECORDS = 500000
WARNINGS = [
    'This is a documented data export, not a server snapshot. Source code, deployment secrets, sessions and import API keys are excluded.',
    'External image/audio URLs are retained as links; remote files are not downloaded. Generated card speech is included only when media is enabled.',
    'Filtered exports may have references outside the selection; inspect reference/unresolved.json before restoring.',
    'Restore this format through an operator into an isolated database; the existing ZIP import screens accept different portable/emergency formats.',
]


def options(data):
    allowed = {'scope','ids','q','role','status','dataset','visibility','identity','include_media','include_progress','include_audit','include_credentials','modules','language','date_from','date_to','preview','confirm'}
    if set(data) - allowed:
        raise ValueError('Unknown export option.')
    out = {'scope': data.get('scope','all'), 'dataset': data.get('dataset','learning'),
           'visibility': data.get('visibility','all'), 'identity': data.get('identity','anonymous'),
           'modules': data.get('modules',list(MODULES)), 'language': data.get('language',''),
           'date_from': data.get('date_from',''), 'date_to': data.get('date_to','')}
    for key, choices in [('dataset',('learning','accounts','full')),('visibility',('all','public','private')),('identity',('anonymous','linked'))]:
        if out[key] not in choices: raise ValueError('Invalid '+key+'.')
    if not isinstance(out['modules'],list) or not out['modules'] or any(x not in MODULES for x in out['modules']):
        raise ValueError('Select supported learning modules.')
    out['modules'] = sorted(set(out['modules']))
    if out['language'] not in ('','de','en'): raise ValueError('Invalid language.')
    for key in ('date_from','date_to'):
        value = out[key]
        if not isinstance(value,str): raise ValueError('Invalid date.')
        if value:
            try:
                if date.fromisoformat(value).isoformat() != value: raise ValueError()
            except ValueError: raise ValueError('Dates must use YYYY-MM-DD.')
    if out['date_from'] and out['date_to'] and out['date_from'] > out['date_to']: raise ValueError('Invalid date range.')
    for key, default in [('include_media',True),('include_progress',False),('include_audit',False),('include_credentials',False),('preview',False)]:
        if type(data.get(key,default)) is not bool: raise ValueError('Invalid '+key+'.')
        out[key] = data.get(key,default)
    if out['identity']=='anonymous' and (out['dataset']!='learning' or out['include_progress'] or out['include_credentials']):
        raise ValueError('Account data and learner progress require linked identity.')
    if out['include_credentials'] and out['dataset']=='learning': raise ValueError('Credentials require account export.')
    if out['include_audit'] and out['dataset']!='full': raise ValueError('Audit requires full export.')
    for key in ('ids','q','role','status'):
        if key in data: out[key]=data[key]
    return out


def filtered(qs, opts, visibility=False):
    names = {f.name for f in qs.model._meta.fields}
    if opts['language'] and 'language' in names: qs=qs.filter(language=opts['language'])
    if visibility and opts['visibility']!='all': qs=qs.filter(visibility=opts['visibility'])
    stamp = 'updated_at' if 'updated_at' in names else 'created_at' if 'created_at' in names else None
    if stamp:
        for key,lookup in [('date_from','gte'),('date_to','lte')]:
            if opts[key]: qs=qs.filter(**{f'{stamp}__date__{lookup}':date.fromisoformat(opts[key])})
    return qs


def ancestors(model, ids):
    """Retain structural ancestors, but do not pull hidden folder contents."""
    values=ids.iterator(chunk_size=1000) if hasattr(ids,'iterator') else iter(ids)
    found=set(islice(values,MAX_RECORDS+1))
    if len(found)>MAX_RECORDS: raise ValueError('Too many folders. Narrow the selection.')
    pending=set(found)
    while pending:
        parents=set(model.objects.filter(pk__in=pending).exclude(parent=None).values_list('parent_id',flat=True)) - found
        found.update(parents); pending=parents
        if len(found)>MAX_RECORDS: raise ValueError('Too many folder ancestors. Narrow the selection.')
    return found


def plan(opts, users):
    tables={}
    def add(model, qs):
        related=[f.name for f in model._meta.many_to_many]
        tables[model]=qs.order_by('pk').distinct().prefetch_related(*related)
    if opts['dataset']!='accounts':
        decks=filtered(c.Deck.objects.filter(owner__in=users),opts,True) if 'cards' in opts['modules'] else c.Deck.objects.none()
        nodes=filtered(p.PracticeNode.objects.filter(owner__in=users),opts,True) if 'practice' in opts['modules'] else p.PracticeNode.objects.none()
        lessons=filtered(p.ReadingLesson.objects.filter(owner__in=users),opts,True) if 'reading' in opts['modules'] else p.ReadingLesson.objects.none()
        # With no visibility/date restriction, include empty folders and unattached uploads too.
        complete=opts['visibility']=='all' and not opts['date_from'] and not opts['date_to']
        folders=filtered(c.Folder.objects.filter(owner__in=users),opts) if opts['visibility']=='all' and 'cards' in opts['modules'] else c.Folder.objects.filter(pk__in=decks.values('folder_id'))
        reading_folders=filtered(p.ReadingFolder.objects.filter(owner__in=users),opts) if opts['visibility']=='all' and 'reading' in opts['modules'] else p.ReadingFolder.objects.filter(pk__in=lessons.values('folder_id'))
        folders=folders | c.Folder.objects.filter(pk__in=decks.values('folder_id'))
        reading_folders=reading_folders | p.ReadingFolder.objects.filter(pk__in=lessons.values('folder_id'))
        add(c.Folder,c.Folder.objects.filter(pk__in=ancestors(c.Folder,folders.values_list('pk',flat=True))))
        add(c.Deck,decks); add(c.Card,c.Card.objects.filter(deck__in=decks))
        add(c.CardAudio,c.CardAudio.objects.filter(card__deck__in=decks))
        add(p.PracticeNode,p.PracticeNode.objects.filter(pk__in=ancestors(p.PracticeNode,nodes.values_list('pk',flat=True))))
        add(p.ReadingFolder,p.ReadingFolder.objects.filter(pk__in=ancestors(p.ReadingFolder,reading_folders.values_list('pk',flat=True))))
        add(p.ReadingLesson,lessons)
        media_ids=set(p.PracticeMedia.objects.filter(models.Q(nodes__in=nodes)|models.Q(readings__in=lessons)).values_list('pk',flat=True))
        # Historical documents sometimes reference uploads in payload URLs without an M2M attachment.
        if nodes.count()+lessons.count()>MAX_RECORDS: raise ValueError('Too many lessons. Narrow the selection.')
        embedded=set()
        for payload in chain(nodes.values_list('payload',flat=True).iterator(),lessons.values_list('payload',flat=True).iterator()):
            embedded.update(re.findall(r'/api/(?:de|en)/(?:practice-hub/media|practice-media)/([0-9a-fA-F-]{36})/',json.dumps(payload)))
            for attachment in payload.get('attachments',[]):
                if isinstance(attachment,dict) and re.fullmatch(r'[0-9a-fA-F-]{36}',str(attachment.get('id',''))): embedded.add(attachment['id'])
        # Embedded references are restricted to selected owners/language; explicit M2M remains authoritative.
        legacy=filtered(p.PracticeMedia.objects.filter(pk__in=embedded,owner__in=users),{**opts,'date_from':'','date_to':''})
        media=p.PracticeMedia.objects.filter(models.Q(pk__in=media_ids)|models.Q(pk__in=legacy.values('pk')))
        if complete and set(opts['modules'])==set(MODULES): media=media | filtered(p.PracticeMedia.objects.filter(owner__in=users),opts)
        add(p.PracticeMedia,media)
        if opts['include_progress']:
            # History belongs to the learner even when the lesson belongs to the shared publisher.
            history_decks=filtered(c.Deck.objects.all(),opts,True) if 'cards' in opts['modules'] else c.Deck.objects.none()
            history_nodes=filtered(p.PracticeNode.objects.all(),opts,True) if 'practice' in opts['modules'] else p.PracticeNode.objects.none()
            history_lessons=filtered(p.ReadingLesson.objects.all(),opts,True) if 'reading' in opts['modules'] else p.ReadingLesson.objects.none()
            for model,qs in [
                (c.StudyProgress,c.StudyProgress.objects.filter(user__in=users,card__deck__in=history_decks)),
                (c.StudyAttempt,c.StudyAttempt.objects.filter(user__in=users,card__deck__in=history_decks)),
                (c.DeckLearningState,c.DeckLearningState.objects.filter(user__in=users,deck__in=history_decks)),
                (c.StudySession,c.StudySession.objects.filter(user__in=users).filter(models.Q(deck__in=history_decks)|models.Q(deck=None))),
                (p.PracticeProgress,p.PracticeProgress.objects.filter(user__in=users,node__in=history_nodes)),
                (p.PracticeAttempt,p.PracticeAttempt.objects.filter(user__in=users,node__in=history_nodes)),
                (p.ReadingProgress,p.ReadingProgress.objects.filter(user__in=users,lesson__in=history_lessons)),
                (c.LearningEvent,c.LearningEvent.objects.filter(user__in=users)),
                (c.ImportBatch,c.ImportBatch.objects.filter(deck__in=decks)),
                (c.MatchRound,c.MatchRound.objects.filter(deck__in=decks)),
            ]: add(model,filtered(qs,opts))
        # Package documents also serve the live public reading catalogue before materialization.
        if opts['scope']=='all' and opts['visibility']!='private':
            packages=filtered(p.SystemContentPackage.objects.all(),opts)
            if opts['visibility']=='public':
                packages=packages.exclude(document__has_key='mode').exclude(packagereceipt__user__username='wortify-publisher') if 'reading' in opts['modules'] else packages.none()
            add(p.SystemContentPackage,packages)
            if opts['dataset']=='full': add(p.PackageReceipt,p.PackageReceipt.objects.filter(package__in=packages,user__in=users))
        if opts['dataset']=='full':
            classes=filtered(u.Classroom.objects.filter(owner__in=users),opts)
            add(c.DeckOperation,filtered(c.DeckOperation.objects.filter(user__in=users),opts))
            add(u.Classroom,classes)
            boards = u.TeachingBoard.objects.filter(classroom__in=classes)
            add(u.TeachingBoard,boards)
            add(u.BoardPDF,u.BoardPDF.objects.filter(board__in=boards))
            add(u.BoardEvent,u.BoardEvent.objects.filter(board__in=boards))
            add(u.ClassroomAssignment,u.ClassroomAssignment.objects.filter(classroom__in=classes,node__in=nodes))
            add(s.SiteAppearance,s.SiteAppearance.objects.all()); add(s.ContentPolicy,s.ContentPolicy.objects.all())
    if opts['dataset'] in ('accounts','full'):
        add(get_user_model(),users)
        add(u.Profile,u.Profile.objects.filter(user__in=users))
        add(u.Theme,u.Theme.objects.filter(owner__in=users))
        add(c.StudySettings,filtered(c.StudySettings.objects.filter(user__in=users),opts))
        add(Group,Group.objects.filter(user__in=users))
        add(Permission,Permission.objects.all())
        from django.contrib.contenttypes.models import ContentType
        add(ContentType,ContentType.objects.all())
    if opts['include_audit']:
        add(LogEntry,LogEntry.objects.filter(user__in=users))
        add(s.BackendCheck,filtered(s.BackendCheck.objects.filter(user__in=users),opts))
    return tables


def documentation(opts):
    return {
        'README.md': '''# Wortify — gói xuất dữ liệu / data export v1
Dữ liệu UTF-8 trong data/ là danh sách {model, pk, fields}. PK gốc được giữ để nối bảng. SCHEMA.json mô tả kiểu trường và quan hệ; manifest.json ghi lựa chọn, số bản ghi, migrations và SHA-256 của từng tệp. INDEX.csv là mục lục để phân tích.

Đọc RESTORE.md trước khi khôi phục và ANALYSIS.md trước khi phân tích. Đây là định dạng wortify-site-export, không nhập bằng chức năng ZIP cá nhân hoặc emergency. Giữ gói có dữ liệu riêng tư ở nơi an toàn.
''',
        'RESTORE.md': '''# Khôi phục có kiểm soát
1. Giữ bản gốc; kiểm tra SHA-256 toàn bộ tệp theo manifest.json. Kiểm tra counts, options và reference/unresolved.json. Thiếu media làm quá trình xuất thất bại, không tạo gói thành công thiếu tệp.
2. Dùng mã nguồn cùng phiên bản migrations ghi trong manifest; tạo database và media storage cô lập. Không nạp trực tiếp lên hệ thống đang dùng. Gói lọc chỉ là một phần dữ liệu, không thay thế database/server backup.
3. Tạo tài khoản đích trước nếu gói learning không chứa auth.user. Với identity=anonymous, owner/user bị bỏ: gán cho một tài khoản đích do người vận hành chọn. PK nội dung vẫn giữ; không coi đây là ẩn danh hoàn toàn vì văn bản, URL hoặc tên tệp có thể chứa thông tin cá nhân.
4. Lập mapping (model, PK cũ) -> PK mới. Tạo thư mục cha trước con, rồi bộ thẻ/thẻ, media, bài tập/bài đọc, cấu hình và tiến độ nếu có. SCHEMA.json ghi FK/M2M; gắn M2M sau khi mọi đích đã tồn tại. Các liên kết ngoài gói không bắt buộc bị cắt; FK bắt buộc và liên kết tài khoản được giữ để mapping, tất cả liệt kê trong reference/unresolved.json; giải quyết chúng trước khi chuyển hệ thống.
5. media/ chứa byte tệp; reference/media.json ánh xạ tên storage gốc sang đường dẫn gói. Khôi phục qua storage API, cập nhật FileField. Payload giữ UUID media và URL gốc; cần thay URL/UUID nếu thay định danh hoặc miền. Ảnh/âm thanh từ URL ngoài không được tải; kiểm tra riêng. Tệp không chọn tải có tên gốc nhưng không có byte.
6. Mapping permissions theo (app_label, model, codename), không theo số PK. Không bật lại đặc quyền tự động. Mật khẩu bị thay bằng unusable hash khi không chọn include_credentials; đặt lại mật khẩu. Không có sessions, reset tokens hay import API keys. Đổi invitation/token nghiệp vụ khi phục hồi trên môi trường khác.
7. Kiểm tra số bản ghi, thứ tự, đáp án/chấp nhận đáp án, payload/HTML/Markdown, audio/image, cây thư mục, visibility, revision tiến độ, quyền và liên kết chéo. Chạy thử đăng nhập/học trên môi trường cô lập, sao lưu hệ thống hiện tại rồi mới chuyển đổi.

Không có trình nhập tự động cho định dạng này. Muốn dùng chức năng khôi phục tài khoản sẵn có hãy xuất emergency ZIP ở mục tương ứng. Full chỉ có toàn bộ dữ liệu học khi chọn mọi module, mọi visibility, mọi tài khoản, không lọc ngôn ngữ/ngày và bật progress/media. Mã nguồn, assets tĩnh, cấu hình triển khai, database engine metadata phải sao lưu riêng.
''',
        'ANALYSIS.md': '''# Phân tích dữ liệu
Giải nén ZIP; đọc manifest.json/options trước để biết phạm vi. INDEX.csv liệt kê model, tệp, số bản ghi. JSON giữ đầy đủ payload lồng nhau, đáp án, giải thích, vị trí, revision và timestamp; không chuyển payload thành chuỗi mất cấu trúc.

Mỗi data/<model>.json là JSON array; nạp bằng json.load(), chuẩn hóa fields thành cột, giữ model và pk. Nối Card.fields.deck với Deck.pk, PracticeNode.fields.parent với PracticeNode.pk, ReadingLesson.fields.folder với ReadingFolder.pk. SCHEMA.json ghi tất cả FK/M2M. IDs chỉ có ý nghĩa trong cùng lần xuất; không cộng số thư mục vào số bài học.

Ngày lọc áp dụng updated_at nếu có, nếu không thì created_at; các con/phụ thuộc và thư mục tổ tiên được giữ để bảo toàn cấu trúc. Bảng không có ngày không được lọc theo ngày. Tiến độ lấy theo người học đã chọn, kể cả học liệu công khai của tác giả khác nếu phù hợp module/ngôn ngữ/visibility/ngày; tham chiếu đến học liệu không sở hữu được giữ và liệt kê trong unresolved; LearningEvent là sự kiện cấp tài khoản, có thể chứa tham chiếu ngoài gói. SystemContentPackage gồm học liệu nguồn và bài đọc hệ thống chưa lưu vào tài khoản. Package chỉ đi kèm scope=all; private loại package; public chỉ giữ reading công khai chưa materialize, bỏ các section khác; lọc module chỉ giữ section đã chọn. reference/package-projections.json ghi digest gốc khi có biến đổi; chúng có thể trùng với bản nội dung đã nhập, không cộng hai lần. Các thư mục tổ tiên ngoài bộ lọc chỉ giữ cấu trúc và tên, phần lý thuyết/payload bị xóa.

identity=anonymous bỏ quan hệ tài khoản và token nghiệp vụ, không xuất hồ sơ/quyền/lịch sử; không tự xóa tên riêng trong nội dung tự do. Liên kết tài khoản chỉ xuất khi identity=linked. Học liệu thuần bỏ ReadingLesson.completed; chọn include_progress để giữ trạng thái học. Không dùng gói lọc hoặc tách tài khoản để suy luận tổng số dữ liệu toàn web.
''',
    }


@management('system.backup')
@require_http_methods(['POST'])
def export_site(request):
    opts=options(body(request))
    users=selection(opts) if opts['scope']!='all' else get_user_model().objects.all().order_by('pk')
    # A consistent database snapshot; storage bytes must still be read separately.
    with transaction.atomic():
        if connection.vendor=='postgresql':
            with connection.cursor() as cursor: cursor.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ')
        tables=plan(opts,users)
        counts={m._meta.label_lower:qs.count() for m,qs in tables.items()}
        if sum(counts.values())>MAX_RECORDS: raise ValueError('Export exceeds 500,000 records. Narrow the selection.')
        warnings=list(WARNINGS)
        if opts['identity']=='anonymous': warnings.append('Account links are removed; free text, URLs and original content IDs are retained. Review before sharing.')
        if not opts['include_media']: warnings.append('Uploaded file bytes are excluded; this archive alone cannot restore media.')
        if opts['dataset']=='full': warnings.append('System packages are excluded from account-scoped/private exports; module-filtered packages contain selected sections only. Public exports contain unmaterialized public reading sections only.')
        result={'count':users.count(),'counts':[{'model':key,'count':value} for key,value in counts.items()],'warnings':warnings,'options':opts}
        if opts['preview']:
            response=JsonResponse(result); response['Cache-Control']='no-store'; return response
        if body(request).get('confirm')!='EXPORT': raise ValueError('Confirm the export with EXPORT.')
        output=tempfile.SpooledTemporaryFile(max_size=8*1024*1024)
        try:
            checksums={}; total=0; unresolved=[]; media_map=[]; schema={}; package_projections=[]
            saved_options={key:value for key,value in opts.items() if key not in ('preview','ids','q','confirm')} if opts['identity']=='anonymous' else {key:value for key,value in opts.items() if key not in ('preview','confirm')}
            ids={m._meta.label_lower:set(str(pk) for pk in qs.values_list('pk',flat=True)) for m,qs in tables.items()}
            with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,allowZip64=True) as archive:
                def write(name,raw):
                    nonlocal total
                    if isinstance(raw,str): raw=raw.encode('utf-8')
                    total+=len(raw)
                    if total>MAX_TOTAL or len(checksums)>=99998: raise ValueError('Export exceeds 2 GiB or file limit. Narrow the selection.')
                    archive.writestr(name,raw); checksums[name]=hashlib.sha256(raw).hexdigest()
                def write_json(name,value): write(name,json.dumps(value,ensure_ascii=False,default=str,indent=2))
                for model, qs in tables.items():
                    label=model._meta.label_lower
                    schema[label]=[]
                    for field in model._meta.get_fields():
                        if field.auto_created and not field.concrete: continue
                        schema[label].append({'name':field.name,'type':field.get_internal_type(),'nullable':field.null,'primary_key':field.primary_key,'many_to_many':field.many_to_many,'target':field.related_model._meta.label_lower if field.is_relation else None})
                    # JSON arrays are streamed record-by-record into the ZIP, not built in memory.
                    name=f'data/{label}.json'; digest=hashlib.sha256()
                    with archive.open(name,'w',force_zip64=True) as target:
                        def chunk(raw):
                            nonlocal total
                            total+=len(raw)
                            if total>MAX_TOTAL: raise ValueError('Export exceeds 2 GiB. Narrow the selection.')
                            target.write(raw);digest.update(raw)
                        chunk(b'['); first=True
                        # Media writes must happen after closing this entry (ZipFile permits one writer).
                        pending_media=[]
                        for obj in qs.iterator(chunk_size=500):
                            record=json.loads(serializers.serialize('json',[obj]))[0]
                            fields=record['fields']
                            if model==p.SystemContentPackage:
                                sections={'cards':'flashcards','practice':'practice','reading':'reading'}
                                keep={'reading'} if opts['visibility']=='public' else {sections[key] for key in opts['modules']}
                                if keep!=set(sections.values()):
                                    document=deepcopy(fields['document'])
                                    for section in set(sections.values())-keep: document.pop(section,None)
                                    package_projections.append({'pk':str(obj.pk),'original_digest':fields['digest'],'sections':sorted(keep),'projection':True})
                                    fields['document']=document
                                    fields['digest']=hashlib.sha256(json.dumps(document,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
                                    fields['counts']={'projected':True}
                            structural=False
                            if model==p.PracticeNode:
                                structural=(opts['visibility']!='all' and obj.visibility!=opts['visibility'])
                                if opts['date_from'] and obj.updated_at.date()<date.fromisoformat(opts['date_from']): structural=True
                                if opts['date_to'] and obj.updated_at.date()>date.fromisoformat(opts['date_to']): structural=True
                            if structural:
                                fields['payload']={};fields['attachments']=[];fields['links']=[]
                            if model==c.Folder:
                                folder_outside_date=(opts['date_from'] and obj.created_at.date()<date.fromisoformat(opts['date_from'])) or (opts['date_to'] and obj.created_at.date()>date.fromisoformat(opts['date_to']))
                                if opts['visibility']!='all' or folder_outside_date: fields['theory_content']='';fields['theory_format']=''
                            if model==p.ReadingLesson and not opts['include_progress']: fields['completed']=[]
                            if model==get_user_model() and not opts['include_credentials']: fields['password']='!site-export-password-reset-required'
                            for field in model._meta.get_fields():
                                if field.name not in fields: continue
                                if opts['identity']=='anonymous' and ((field.is_relation and field.related_model==get_user_model()) or field.name in ('token','invite')):
                                    fields.pop(field.name);continue
                                if field.is_relation:
                                    related=field.related_model._meta.label_lower
                                    value=fields[field.name]; values=value if field.many_to_many else [] if value is None else [value]
                                    missing=[v for v in values if str(v) not in ids.get(related,set())]
                                    if missing:
                                        retain=(not field.many_to_many and (not field.null or field.related_model==get_user_model()))
                                        unresolved.append({'model':label,'pk':record['pk'],'field':field.name,'target':related,'ids':missing,'action':'retained_external' if retain else 'trimmed'})
                                        if retain: continue
                                        if field.many_to_many: fields[field.name]=[v for v in values if str(v) in ids.get(related,set())]
                                        elif field.null: fields[field.name]=None
                                        else: fields.pop(field.name)
                                if isinstance(field,models.FileField) and getattr(obj,field.name):
                                    file=getattr(obj,field.name)
                                    path=f'media/{label}/{obj.pk}/{field.name}{PurePosixPath(file.name).suffix.lower()}'
                                    media_map.append({'model':label,'pk':record['pk'],'field':field.name,'storage_name':file.name,'archive_path':path if opts['include_media'] else None})
                                    if opts['include_media']: fields[field.name]=path;pending_media.append((path,file))
                            if not first: chunk(b',')
                            chunk(json.dumps(record,ensure_ascii=False).encode('utf-8'));first=False
                        chunk(b']')
                    checksums[name]=digest.hexdigest()
                    for path,file in pending_media:
                        try:
                            with file.open('rb') as stream:
                                with archive.open(path,'w',force_zip64=True) as target:
                                    digest=hashlib.sha256()
                                    while True:
                                        raw=stream.read(1024*1024)
                                        if not raw: break
                                        total+=len(raw)
                                        if total>MAX_TOTAL: raise ValueError('Export exceeds 2 GiB. Narrow the selection.')
                                        target.write(raw);digest.update(raw)
                            checksums[path]=digest.hexdigest()
                            if len(checksums)>99998: raise ValueError('Too many files. Narrow the selection.')
                        except (OSError,FileNotFoundError) as exc: raise ValueError('An uploaded file is missing or unavailable. Repair storage or export without media.') from exc
                for name,content in documentation(opts).items(): write(name,content)
                write_json('SCHEMA.json',schema)
                write_json('reference/unresolved.json',unresolved)
                write_json('reference/media.json',media_map)
                write_json('reference/package-projections.json',package_projections)
                write('INDEX.csv','model,file,records\n'+''.join(f'{label},data/{label}.json,{count}\n' for label,count in counts.items()))
                manifest={'format':'wortify-site-export','version':1,'created_at':timezone.now().isoformat(),'options':saved_options,'counts':counts,'warnings':warnings,'unresolved_references':len(unresolved),'files':checksums,'migrations':list(MigrationRecorder.Migration.objects.order_by('app','name').values_list('app','name'))}
                archive.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,default=str,indent=2).encode())
            audit(request,request.user,f'Site export: dataset={opts["dataset"]}; identity={opts["identity"]}; scope={opts["scope"]}; records={sum(counts.values())}; credentials={opts["include_credentials"]}')
            output.seek(0)
            response=FileResponse(output,as_attachment=True,filename=f'wortify-site-{timezone.now():%Y%m%d-%H%M%S}.zip',content_type='application/zip')
            response['Cache-Control']='no-store';response['X-Content-Type-Options']='nosniff'
            return response
        except Exception:
            output.close();raise
