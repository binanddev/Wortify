"""Restore new accounts and their portable data; never overwrite existing identities."""
import hashlib
import json
import zipfile
from contextlib import ExitStack
from pathlib import PurePosixPath
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.contrib.auth.hashers import identify_hasher
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError
from django.db import transaction, models, IntegrityError
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from .management import management, audit
from .backups import LIMIT, JSON_LIMIT, read_archive, restore_archive, owned_rows


@management('system.backup')
@require_http_methods(['POST'])
def restore(request):
    upload = request.FILES.get('file')
    if not upload or upload.size > LIMIT:
        raise ValueError('Choose an emergency ZIP up to 512 MB. Split larger exports by account.')
    media_files = []
    try:
        with ExitStack() as stack:
            outer = stack.enter_context(zipfile.ZipFile(upload))
            entries = outer.infolist()
            names = [e.filename for e in entries]
            if len(names) > 10000 or len(set(names)) != len(names) or sum(e.file_size for e in entries) > LIMIT:
                raise ValueError('Archive exceeds import limits or has duplicate entries.')
            for e in entries:
                path = PurePosixPath(e.filename)
                if path.is_absolute() or '..' in path.parts or '\\' in e.filename or e.flag_bits & 1:
                    raise ValueError('Unsafe archive entry.')
            if outer.getinfo('manifest.json').file_size > 1024 * 1024:
                raise ValueError('Manifest is too large.')
            manifest = json.loads(outer.read('manifest.json'))
            if manifest.get('format') != 'wortify-admin-emergency' or manifest.get('version') != 1:
                raise ValueError('Use an emergency export from Manage. Personal ZIPs belong in Settings > Backup.')
            if set(manifest['files']) != set(names) - {'manifest.json'}:
                raise ValueError('Incomplete manifest.')
            for name, digest in manifest['files'].items():
                if name.endswith('.json') and outer.getinfo(name).file_size > JSON_LIMIT:
                    raise ValueError('JSON section is too large.')
                with outer.open(name) as source:
                    actual = hashlib.file_digest(source, 'sha256').hexdigest()
                if actual != digest:
                    raise ValueError('Archive checksum mismatch.')
            accounts = json.loads(outer.read('accounts.json'))
            groups = json.loads(outer.read('groups.json'))
            permission_rows = json.loads(outer.read('permissions.json')) if 'permissions.json' in names else []
            if not isinstance(accounts, list) or not accounts or len(accounts) > 1000:
                raise ValueError('Import 1–1000 accounts at a time.')
            User = get_user_model()
            plans, usernames, identities = [], set(), set()
            total_expanded = 0
            for record in accounts:
                if record['model'] != 'auth.user': raise ValueError('Invalid account record.')
                f = record['fields']
                username = f['username']
                if not isinstance(username, str) or username in usernames or record['pk'] in identities:
                    raise ValueError('Duplicate or invalid account identity.')
                User._meta.get_field('username').clean(username, None)
                usernames.add(username); identities.add(record['pk'])
                for flag in ('is_active', 'is_staff', 'is_superuser'):
                    if type(f.get(flag)) is not bool: raise ValueError('Invalid account role.')
                password = f.get('password', '')
                if not isinstance(password, str): raise ValueError('Invalid password hash.')
                has_password = bool(password and not password.startswith('!'))
                if has_password: identify_hasher(password)
                source = f'users/{record["pk"]}/portable.zip'
                if source not in names:
                    raise ValueError('Export again with uploaded media and portable ZIPs enabled.')
                archive, records = read_archive(SimpleUploadedFile('portable.zip', outer.read(source)))
                stack.callback(archive.close)
                total_expanded += sum(e.file_size for e in archive.infolist())
                if total_expanded > LIMIT: raise ValueError('Expanded account data exceeds 512 MB.')
                plans.append((f, archive, records, has_password))
            collisions = list(User.objects.filter(username__in=usernames).values_list('username', flat=True))
            # Permission IDs differ between databases; resolve by natural identity.
            permission_map = {}
            for row in permission_rows:
                permission = Permission.objects.filter(codename=row['codename'], content_type__app_label=row['content_type__app_label'], content_type__model=row['content_type__model']).first()
                if permission: permission_map[row['id']] = permission.pk
            group_map = {g['pk']: g['fields'] for g in groups if g['model'] == 'auth.group'}
            used_groups = {pk for f, *_ in plans for pk in f.get('groups', [])}
            used_permissions = {pk for f, *_ in plans for pk in f.get('user_permissions', [])}
            for pk in used_groups:
                if pk not in group_map: raise ValueError('Missing group in backup.')
                used_permissions.update(group_map[pk].get('permissions', []))
            if used_permissions - permission_map.keys():
                raise ValueError('Permission mapping missing. Export again using the latest version.')
            for pk in used_groups:
                group = Group.objects.filter(name=group_map[pk]['name']).first()
                expected = {permission_map[i] for i in group_map[pk].get('permissions', [])}
                if group and set(group.permissions.values_list('pk', flat=True)) != expected:
                    raise ValueError('An existing group has different permissions. Resolve the group name before importing.')
            summary = {'accounts': [{'username': f['username'], 'role': 'Admin' if f['is_superuser'] else 'Staff' if f['is_staff'] else 'User', 'active': f['is_active'], 'password_restored': password} for f, _, _, password in plans], 'collisions': collisions, 'records': sum(len(r) for _, _, r, _ in plans)}
            if request.POST.get('preview') == 'true': return JsonResponse(summary)
            if request.POST.get('confirm') != 'RESTORE': raise ValueError('Preview and confirm the account restore.')
            if collisions: raise ValueError('Existing usernames cannot be overwritten: ' + ', '.join(collisions[:10]))
            with transaction.atomic():
                restored_groups = {}
                for pk in used_groups:
                    group, created = Group.objects.get_or_create(name=group_map[pk]['name'])
                    if created: group.permissions.set([permission_map[i] for i in group_map[pk].get('permissions', [])])
                    restored_groups[pk] = group
                total, skipped = 0, 0
                for f, archive, records, has_password in plans:
                    user = User(username=f['username'], email=f.get('email', ''), first_name=f.get('first_name', ''), last_name=f.get('last_name', ''), is_active=f['is_active'], is_staff=f['is_staff'], is_superuser=f['is_superuser'])
                    if has_password: user.password = f['password']
                    else: user.set_unusable_password()
                    user.full_clean(exclude=['password']); user.save()
                    user.groups.set([restored_groups[i] for i in f.get('groups', [])])
                    user.user_permissions.set([permission_map[i] for i in f.get('user_permissions', [])])
                    result = restore_archive(user, archive, records, restore_settings=True)
                    for queryset in owned_rows(user):
                        fields = [field for field in queryset.model._meta.fields if isinstance(field, models.FileField)]
                        if fields:
                            for obj in queryset:
                                for field in fields:
                                    file = getattr(obj, field.name)
                                    if file: media_files.append((file.storage, file.name))
                    total += result['restored']; skipped += result['skipped']
                    audit(request, user, 'Restore account, role and private content from emergency ZIP.', True)
            return JsonResponse({'accounts': len(plans), 'restored': total, 'skipped': skipped})
    except (zipfile.BadZipFile, KeyError, TypeError, AttributeError, UnicodeError, RuntimeError, ValidationError, IntegrityError) as exc:
        for storage, name in media_files: storage.delete(name)
        raise ValueError('Invalid or conflicting backup. No accounts were restored.') from exc
    except Exception:
        for storage, name in media_files: storage.delete(name)
        raise
