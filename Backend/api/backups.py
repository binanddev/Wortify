"""Versioned, account-scoped portable backups. Never deserialize arbitrary models."""
import hashlib
import io
import json
import tempfile
import uuid
import zipfile
from pathlib import PurePosixPath
from django.contrib.auth import get_user_model
from django.core import serializers
from django.core.files.base import ContentFile
from django.db import models, transaction, IntegrityError
from django.http import FileResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from cards import models as c
from practice import models as p
from users import models as u
from .common import endpoint, body

LIMIT = 512 * 1024 * 1024
JSON_LIMIT = 32 * 1024 * 1024
TABLES = [u.Theme, u.Profile, c.StudySettings, c.Folder, c.Deck, c.Card,
          p.PracticeMedia, p.PracticeNode, u.Classroom, u.ClassroomAssignment,
          c.StudyProgress, c.DeckLearningState, p.PracticeProgress,
          c.StudyAttempt, p.PracticeAttempt, c.StudySession, c.LearningEvent,
          c.ImportBatch, c.MatchRound]
REGISTRY = {m._meta.label_lower: m for m in TABLES}


def owned_rows(user):
    return [u.Theme.objects.filter(owner=user), u.Profile.objects.filter(user=user),
        c.StudySettings.objects.filter(user=user), c.Folder.objects.filter(owner=user),
        c.Deck.objects.filter(owner=user), c.Card.objects.filter(deck__owner=user),
        p.PracticeMedia.objects.filter(owner=user), p.PracticeNode.objects.filter(owner=user),
        u.Classroom.objects.filter(owner=user), u.ClassroomAssignment.objects.filter(classroom__owner=user),
        c.StudyProgress.objects.filter(user=user), c.DeckLearningState.objects.filter(user=user),
        p.PracticeProgress.objects.filter(user=user), c.StudyAttempt.objects.filter(user=user),
        p.PracticeAttempt.objects.filter(user=user), c.StudySession.objects.filter(user=user),
        c.LearningEvent.objects.filter(user=user), c.ImportBatch.objects.filter(deck__owner=user),
        c.MatchRound.objects.filter(deck__owner=user)]


def export_archive(user, workspace=None):
    output = tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024)
    checksums = {}
    total = 0
    record_count = 0
    try:
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
            def write(name, data):
                nonlocal total
                if len(checksums) >= 9998: raise ValueError('Backup contains too many files.')
                total += len(data)
                if total > LIMIT: raise ValueError('Backup exceeds the 512 MB limit.')
                archive.writestr(name, data)
                checksums[name] = hashlib.sha256(data).hexdigest()
            for model, queryset in zip(TABLES, owned_rows(user)):
                objects = list(queryset.order_by('pk'))
                record_count += len(objects)
                if record_count > 100000: raise ValueError('Backup exceeds 100,000 records.')
                records = json.loads(serializers.serialize('json', objects))
                for obj, record in zip(objects, records):
                    record['fields'].pop('members', None)
                    for field in model._meta.fields:
                        if isinstance(field, models.DateTimeField) and getattr(obj,field.name) is not None:
                            record['fields'][field.name]=getattr(obj,field.name).isoformat()
                        if isinstance(field, models.FileField):
                            file = getattr(obj, field.name)
                            if file:
                                ext = PurePosixPath(file.name).suffix.lower()
                                name = f'media/{model._meta.label_lower}/{obj.pk}/{field.name}{ext}'
                                with file.open('rb') as stream:
                                    data = stream.read(LIMIT + 1)
                                write(name, data)
                                record['fields'][field.name] = name
                data = json.dumps(records, ensure_ascii=False).encode('utf-8')
                if len(data) > JSON_LIMIT: raise ValueError('A backup data section exceeds 32 MB.')
                write(f'data/{model._meta.label_lower}.json', data)
            write('reference/workspace.json', json.dumps(workspace or {}).encode())
            memberships = list(user.classrooms.values('title', 'language'))
            write('reference/memberships.json', json.dumps(memberships).encode())
            write('README.txt', b'Wortify backup v1. data/ contains UTF-8 JSON; media/ contains uploaded files. Import from Settings > Backup. Content restores as private copies. Account credentials, roles, other users and class memberships are never restored. Generated speech can be regenerated. References to content not owned by this account are retained in the archive but skipped if unavailable during restoration. Restoring account settings is optional. Keep this archive private.')
            manifest = {'format':'wortify-backup','version':1,'created_at':timezone.now().isoformat(),
                        'files':checksums, 'languages':['de','en']}
            archive.writestr('manifest.json', json.dumps(manifest))
        output.seek(0)
        return output
    except Exception:
        output.close()
        raise


def read_archive(upload):
    if not upload or upload.size > LIMIT: raise ValueError('Choose a ZIP backup up to 512 MB.')
    try:
        archive = zipfile.ZipFile(upload)
        entries = archive.infolist()
        names = [entry.filename for entry in entries]
        if len(entries) > 10000 or len(set(names)) != len(names): raise ValueError('Invalid archive entries.')
        if sum(e.file_size for e in entries) > LIMIT: raise ValueError('Expanded backup exceeds 512 MB.')
        for entry in entries:
            path = PurePosixPath(entry.filename)
            if path.is_absolute() or '..' in path.parts or '\\' in entry.filename or entry.flag_bits & 1:
                raise ValueError('Unsafe archive path or encrypted file.')
        if archive.getinfo('manifest.json').file_size > 1024 * 1024: raise ValueError('Manifest is too large.')
        manifest = json.loads(archive.read('manifest.json'))
        if manifest.get('format') != 'wortify-backup' or manifest.get('version') != 1:
            raise ValueError('Unsupported backup format or version.')
        if set(manifest['files']) != set(names) - {'manifest.json'}: raise ValueError('Incomplete backup manifest.')
        records = []
        for name, digest in manifest['files'].items():
            if name.startswith('data/') and archive.getinfo(name).file_size > JSON_LIMIT: raise ValueError('Data section is too large.')
            raw = archive.read(name)
            if hashlib.sha256(raw).hexdigest() != digest: raise ValueError('Backup checksum does not match.')
            if name.startswith('data/'):
                label = name[5:-5]
                if label not in REGISTRY or not name.endswith('.json'): raise ValueError('Unsupported data section.')
                rows = json.loads(raw)
                if not isinstance(rows,list): raise ValueError('Invalid data section.')
                for row in rows:
                    if not isinstance(row,dict) or row.get('model') != label or not isinstance(row.get('fields'),dict):
                        raise ValueError('Invalid backup record.')
                    allowed = {f.name for f in REGISTRY[label]._meta.get_fields() if not f.auto_created}
                    if set(row['fields']) - allowed: raise ValueError('Unknown backup fields.')
                records.extend(rows)
        identities = [(r['model'], str(r['pk'])) for r in records]
        if len(records) > 100000 or len(set(identities)) != len(identities): raise ValueError('Too many or duplicate records.')
        return archive, records
    except (zipfile.BadZipFile, KeyError, AttributeError, UnicodeError, json.JSONDecodeError, RuntimeError) as exc:
        if 'archive' in locals(): archive.close()
        raise ValueError('The ZIP is corrupt or is not a Wortify backup.') from exc
    except Exception:
        if 'archive' in locals(): archive.close()
        raise


def restore_archive(user, archive, records, restore_settings=False):
    mapping, files, deferred, skipped = {}, [], [], 0
    tokens = {str(r['fields']['token']):str(uuid.uuid4()) for r in records if 'token' in r['fields']}
    media_ids = {str(r['pk']):str(uuid.uuid4()) for r in records if r['model']=='practice.practicemedia'}
    def rewrite(value):
        if isinstance(value,list): return [rewrite(v) for v in value]
        if isinstance(value,dict): return {k:rewrite(v) for k,v in value.items()}
        if isinstance(value,str):
            if value in tokens: return tokens[value]
            for old,new in media_ids.items(): value=value.replace(old,new)
        return value
    try:
        with transaction.atomic():
            get_user_model().objects.select_for_update().get(pk=user.pk)
            if u.Theme.objects.filter(owner=user).exclude(background_image='').count() + sum(bool(r['fields'].get('background_image')) for r in records if r['model']=='users.theme') > 10:
                raise ValueError('Restoring would exceed 10 backgrounds. Remove unused backgrounds first.')
            for model in TABLES:
                pending = [r for r in records if r['model']==model._meta.label_lower]
                if model in (u.Profile,c.StudySettings) and not restore_settings: continue
                while pending:
                    progressed = False
                    for record in pending[:]:
                        fields, kwargs, missing = record['fields'], {}, False
                        for field in model._meta.fields:
                            if field.primary_key: continue
                            if field.name not in fields: continue
                            value = fields[field.name]
                            if isinstance(field, models.JSONField) and not isinstance(value, type(field.get_default())): raise ValueError('Invalid JSON field shape.')
                            if field.is_relation:
                                if field.remote_field.model == get_user_model(): value = user.pk
                                elif value is not None:
                                    target = mapping.get((field.remote_field.model._meta.label_lower,str(value)))
                                    if target is None:
                                        if field.null: value = None
                                        else: missing = True; break
                                    else: value = target.pk
                                kwargs[field.attname] = value
                            elif not isinstance(field,models.FileField): kwargs[field.name] = rewrite(value)
                        # Self-parent trees must be restored parent-first, never flattened.
                        if fields.get('parent') is not None and model in (c.Folder,p.PracticeNode):
                            parent=mapping.get((model._meta.label_lower,str(fields['parent'])))
                            if not parent: missing=True
                            else: kwargs['parent_id']=parent.pk
                        if missing: continue
                        if model == p.PracticeMedia: kwargs['id']=media_ids[str(record['pk'])]
                        if model == p.PracticeNode: kwargs['visibility']='private'
                        if model == u.Theme: kwargs['shared']=False
                        if model == u.Classroom: kwargs['invite']=uuid.uuid4()
                        if model == c.Folder:
                            base=kwargs['name']; suffix=1
                            while c.Folder.objects.filter(owner=user,language=kwargs['language'],name=kwargs['name']).exists():
                                kwargs['name']=f'{base[:75]} (restored {suffix})';suffix+=1
                        if model == u.Profile:
                            obj,_=u.Profile.objects.get_or_create(user=user)
                            for key,value in kwargs.items(): setattr(obj,key,value)
                            from users.preferences import validate_preferences
                            prefs=validate_preferences(obj.preferences)
                            prefs['backgroundByInterface']={key:(mapping[('users.theme',str(value))].pk if ('users.theme',str(value)) in mapping else (0 if value == 0 and fields.get('background_image') else None)) for key,value in prefs.get('backgroundByInterface',{}).items()}
                            obj.preferences=prefs
                        elif model == c.StudySettings:
                            obj,_=c.StudySettings.objects.get_or_create(user=user,language=kwargs['language'])
                            for key,value in kwargs.items():setattr(obj,key,value)
                        else: obj=model(**kwargs)
                        for field in model._meta.fields:
                            if isinstance(field,models.FileField) and fields.get(field.name):
                                name=fields[field.name]
                                if not name.startswith('media/') or name not in archive.namelist(): raise ValueError('Missing media file.')
                                ext=PurePosixPath(name).suffix.lower()
                                if ext not in ('.jpg','.jpeg','.png','.webp','.gif','.mp3'): raise ValueError('Unsupported media file.')
                                raw=archive.read(name)
                                source=ContentFile(raw,name='backup'+ext)
                                # Decode explicitly; never allow active HTML, SVG or playlists.
                                import av
                                formats={'.jpg':'jpeg_pipe','.jpeg':'jpeg_pipe','.png':'png_pipe','.webp':'webp_pipe','.gif':'gif','.mp3':'mp3'}
                                try:
                                    with av.open(io.BytesIO(raw),format=formats[ext]) as container:
                                        stream=(container.streams.audio if ext=='.mp3' else container.streams.video)[0]
                                        if ext!='.mp3' and stream.codec_context.width*stream.codec_context.height>40000000: raise ValueError('Image too large.')
                                        next(container.decode(stream))
                                except Exception as exc: raise ValueError('Invalid media in backup.') from exc
                                getattr(obj,field.name).save(uuid.uuid4().hex+ext,source,save=False)
                                files.append((getattr(obj,field.name).storage,getattr(obj,field.name).name))
                                if model==p.PracticeMedia:
                                    obj.size=len(raw)
                                    obj.content_type={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.mp3':'audio/mpeg'}[ext]
                        obj.full_clean(exclude=[f.name for f in model._meta.fields if f.auto_created or (f.null and getattr(obj,f.attname) is None) or isinstance(f,models.JSONField) or getattr(f,'auto_now',False) or getattr(f,'auto_now_add',False)],validate_unique=False,validate_constraints=False)
                        obj.save()
                        # Preserve timestamps and progress revisions after auto_now fields run.
                        times={f.name:f.to_python(fields[f.name]) for f in model._meta.fields if (getattr(f,'auto_now',False) or getattr(f,'auto_now_add',False)) and fields.get(f.name)}
                        if times: model.objects.filter(pk=obj.pk).update(**times)
                        mapping[(model._meta.label_lower,str(record['pk']))]=obj
                        deferred.append((obj,record))
                        pending.remove(record);progressed=True
                    if not progressed:
                        if model in (c.Folder,p.PracticeNode): raise ValueError('A folder parent is missing or cyclic.')
                        skipped+=len(pending);break
            def references(value):
                if isinstance(value,list): return [references(v) for v in value]
                if not isinstance(value,dict): return value
                out={key:references(v) for key,v in value.items()}
                for key,label in [('card','cards.card'),('deck','cards.deck'),('node','practice.practicenode')]:
                    if key in out and (label,str(out[key])) in mapping: out[key]=mapping[(label,str(out[key]))].pk
                return out
            for obj,record in deferred:
                for field in obj._meta.fields:
                    if isinstance(field,models.JSONField) and field.name in ('payload','result','question'):
                        setattr(obj,field.name,references(getattr(obj,field.name)))
                        type(obj).objects.filter(pk=obj.pk).update(**{field.name:getattr(obj,field.name)})
                for field in obj._meta.many_to_many:
                    if field.remote_field.model == get_user_model(): continue
                    values=[mapping[(field.remote_field.model._meta.label_lower,str(pk))].pk for pk in record['fields'].get(field.name,[]) if (field.remote_field.model._meta.label_lower,str(pk)) in mapping]
                    getattr(obj,field.name).set(values)
                if isinstance(obj,c.DeckLearningState):
                    def card_keys(values):
                        return {str(mapping[('cards.card',str(key))].pk):value for key,value in values.items() if ('cards.card',str(key)) in mapping}
                    obj.stars=card_keys(obj.stars)
                    # Progress stores card IDs in per-mode maps.
                    obj.progress=card_keys(obj.progress)
                    obj.save()
            workspace=json.loads(archive.read('reference/workspace.json')) if 'reference/workspace.json' in archive.namelist() else {}
            restored_workspace={lang:[mapping[('practice.practicenode',str(pk))].pk for pk in ids if ('practice.practicenode',str(pk)) in mapping] for lang,ids in workspace.items() if lang in ('de','en') and isinstance(ids,list)}
            return {'restored':len(mapping),'skipped':skipped,'workspace':restored_workspace}
    except Exception:
        for storage,name in files: storage.delete(name)
        raise


@endpoint
@require_http_methods(['GET','POST'])
def export(request):
    workspace=body(request).get('workspace',{}) if request.method=='POST' else {}
    if not isinstance(workspace,dict) or any(k not in ('de','en') or not isinstance(v,list) or len(v)>10000 or any(type(i)!=int for i in v) for k,v in workspace.items()): raise ValueError('Invalid workspace preferences.')
    response=FileResponse(export_archive(request.user,workspace),as_attachment=True,filename=f'wortify-backup-{timezone.now():%Y%m%d-%H%M%S}.zip',content_type='application/zip')
    response['Cache-Control']='no-store'
    return response


@endpoint
@require_http_methods(['POST'])
def restore(request):
    archive,records=read_archive(request.FILES.get('file'))
    try:
        if request.POST.get('preview')=='true':
            counts={label:sum(r['model']==label for r in records) for label in REGISTRY}
            return JsonResponse({'counts':counts,'total':len(records)})
        if request.POST.get('confirm')!='true': raise ValueError('Review the backup before restoring it.')
        try:
            result=restore_archive(request.user,archive,records,request.POST.get('settings')=='true')
        except (IntegrityError, KeyError, AttributeError, OverflowError) as exc:
            raise ValueError('Invalid or conflicting records in this backup. Nothing was restored.') from exc
        return JsonResponse(result)
    finally: archive.close()
