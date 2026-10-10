"""Superuser-only emergency exports. No restore endpoint or credential changes."""
import json
import hashlib
import tempfile
import zipfile
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.admin.models import LogEntry
from django.core import serializers
from django.db.models import Q
from django.http import FileResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from .management import management, audit
from .common import body
from .backups import export_archive, owned_rows
from users.models import Classroom

MAX_TOTAL = 2 * 1024 * 1024 * 1024

def selection(data):
    users=get_user_model().objects.all().order_by('pk')
    mode=data.get('scope','selected')
    if mode=='selected':
        ids=data.get('ids',[])
        if not isinstance(ids,list) or not ids or len(ids)>10000 or any(type(i)!=int for i in ids):raise ValueError('Select 1–10,000 accounts.')
        users=users.filter(pk__in=ids)
        if users.count()!=len(set(ids)):raise ValueError('Some selected accounts no longer exist.')
    elif mode=='filtered':
        q=data.get('q','');role=data.get('role','');status=data.get('status','')
        if not isinstance(q,str) or len(q)>100:raise ValueError('Invalid search.')
        users=users.filter(Q(username__icontains=q)|Q(email__icontains=q))
        if role=='user':users=users.filter(is_staff=False,is_superuser=False)
        elif role=='staff':users=users.filter(is_staff=True,is_superuser=False)
        elif role=='superuser':users=users.filter(is_superuser=True)
        elif role:raise ValueError('Invalid role.')
        if status in ('active','inactive'):users=users.filter(is_active=status=='active')
        elif status:raise ValueError('Invalid status.')
    elif mode!='all':raise ValueError('Invalid scope.')
    if not users.exists():raise ValueError('No matching accounts.')
    return users

@management('system.backup')
@require_http_methods(['POST'])
def emergency(request):
    data=body(request)
    users=selection(data)
    for key in ('include_credentials','include_audit','include_media'):
        if key in data and type(data[key]) is not bool:raise ValueError('Invalid backup option.')
    count=users.count()
    if data.get('preview') is True:return JsonResponse({'count':count,'accounts':list(users.values('id','username','email','is_active','is_staff','is_superuser')[:20])})
    if data.get('confirm')!='EXPORT':raise ValueError('Confirm the emergency export.')
    output=tempfile.SpooledTemporaryFile(max_size=8*1024*1024)
    manifest={};total=0
    try:
        with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
            def write(name,raw):
                nonlocal total
                total+=len(raw)
                if total>MAX_TOTAL:raise ValueError('Export exceeds 2 GB. Export smaller account groups.')
                archive.writestr(name,raw);manifest[name]=hashlib.sha256(raw).hexdigest()
            # Retain full account identity and privilege data for emergency recovery.
            identities=json.loads(serializers.serialize('json',users))
            if not data.get('include_credentials',False):
                for row in identities:row['fields']['password']='!backup-password-reset-required'
            write('accounts.json',json.dumps(identities,ensure_ascii=False).encode())
            write('groups.json',serializers.serialize('json',Group.objects.all()).encode())
            memberships=list(Classroom.objects.filter(Q(owner__in=users)|Q(members__in=users)).distinct().values('id','owner_id','title','language','invite'))
            for row in memberships:row['members']=list(Classroom.objects.get(pk=row['id']).members.values_list('pk',flat=True))
            write('class-memberships.json',json.dumps(memberships,default=str).encode())
            for user in users.iterator():
                if data.get('include_media',True):
                    with export_archive(user) as personal:write(f'users/{user.pk}/portable.zip',personal.read())
                # Original IDs and all relations: for operator-led database recovery.
                records=[]
                for queryset in owned_rows(user):records.extend(json.loads(serializers.serialize('json',queryset)))
                write(f'users/{user.pk}/database-records.json',json.dumps(records,ensure_ascii=False).encode())
            if data.get('include_audit',True):
                logs=LogEntry.objects.filter(Q(user__in=users)|Q(content_type__app_label='auth',content_type__model='user',object_id__in=[str(x['pk']) for x in identities]))
                write('audit.json',serializers.serialize('json',logs).encode())
            write('README.txt',b'Wortify emergency export v1. ADMINISTRATOR DATA: keep encrypted and private. accounts.json retains account identity, roles and permissions; password hashes are optional (omitted hashes require password reset). No sessions, reset tokens, deployment secrets or API keys are included. users/<id>/portable.zip can be imported using Settings > Backup & restore; this creates private copies and does not restore account privileges. database-records.json retains original IDs/relations for operator-led recovery: never load directly into a live database. Restore to an isolated database of the same schema, map cross-account foreign keys and verify before cutover. Media is inside portable ZIPs; metadata-only exports omit media. Class membership and audit files are reference records and may reference accounts outside a filtered selection. This archive is not a whole-server/database snapshot; deployment configuration and global site assets must be backed up separately.')
            archive.writestr('manifest.json',json.dumps({'format':'wortify-admin-emergency','version':1,'created_at':timezone.now().isoformat(),'accounts':count,'options':{key:data.get(key,default) for key,default in [('include_credentials',False),('include_audit',True),('include_media',True)]},'files':manifest}))
        audit(request,request.user,f'Emergency backup exported: {count} accounts; scope={data.get("scope")}; credentials={data.get("include_credentials",False)}; media={data.get("include_media",True)}')
        output.seek(0)
        response=FileResponse(output,as_attachment=True,filename=f'wortify-emergency-{timezone.now():%Y%m%d-%H%M%S}.zip',content_type='application/zip')
        response['Cache-Control']='no-store';return response
    except Exception:
        output.close();raise
