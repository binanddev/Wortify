"""Explicit, ownership-scoped data tools. Never exposes auth tables or credentials."""
from types import SimpleNamespace
from datetime import timedelta
import platform
import django
from django.apps import apps
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import connection, models, transaction
from django.db.migrations.executor import MigrationExecutor
from django.forms.models import model_to_dict
from django.http import JsonResponse, Http404
from django.utils import timezone
from django.views.decorators.http import require_http_methods
from .common import body
from .management import management, managed_user, audit, revoke_sessions

# model, owner lookup, display label; no arbitrary model or lookup from the client.
DATA = {
    'folders': ('cards.Folder', 'owner', 'Folde flashcard'),
    'decks': ('cards.Deck', 'owner', 'Bộ thẻ'),
    'cards': ('cards.Card', 'deck__owner', 'Thẻ'),
    'practice': ('practice.PracticeNode', 'owner', 'Folde và bài tập'),
    'media': ('practice.PracticeMedia', 'owner', 'Media bài tập'),
    'classes': ('users.Classroom', 'owner', 'Lớp học'),
    'assignments': ('users.ClassroomAssignment', 'assigned_by', 'Bài giao'),
    'profile': ('users.Profile', 'user', 'Hồ sơ và tùy chọn'),
    'settings': ('cards.StudySettings', 'user', 'Cài đặt học'),
    'progress': ('cards.StudyProgress', 'user', 'Lịch ôn thẻ'),
    'attempts': ('cards.StudyAttempt', 'user', 'Lượt học thẻ'),
    'sessions': ('cards.StudySession', 'user', 'Phiên học'),
    'learning': ('cards.DeckLearningState', 'user', 'Tiến độ bộ thẻ'),
    'events': ('cards.LearningEvent', 'user', 'Sự kiện đồng bộ'),
    'practice-progress': ('practice.PracticeProgress', 'user', 'Tiến độ bài tập'),
    'practice-attempts': ('practice.PracticeAttempt', 'user', 'Lượt làm bài'),
    'imports': ('cards.ImportBatch', 'deck__owner', 'Bản nhập thẻ'),
    'matching': ('cards.MatchRound', 'deck__owner', 'Lượt ghép thẻ'),
    'audio': ('cards.CardAudio', 'card__deck__owner', 'Âm thanh thẻ'),
}

def collection(kind, user):
    if kind not in DATA:
        raise Http404
    name, owner, _ = DATA[kind]
    return apps.get_model(name).objects.filter(**{owner: user})

def editable_fields(model):
    return [f for f in model._meta.fields if not f.primary_key and f.editable
            and f.name not in ('owner', 'user', 'assigned_by')
            and not (model._meta.label == 'practice.PracticeMedia' and f.name != 'name')
            and not isinstance(f, models.FileField)
            and not getattr(f, 'auto_now', False) and not getattr(f, 'auto_now_add', False)]

def record(item):
    values = {}
    for f in editable_fields(type(item)):
        value = getattr(item, f.attname)
        values[f.name] = value
    if item._meta.label == 'users.Classroom': values['members'] = list(item.members.values_list('pk', flat=True))
    if item._meta.label == 'practice.PracticeNode': values['links'] = list(item.links.values_list('pk', flat=True))
    return {'id': str(item.pk), 'label': str(getattr(item, 'title', None) or getattr(item, 'name', None) or getattr(item, 'german_text', None) or f'#{item.pk}'), 'values': values}

@management('auth.change_user')
@require_http_methods(['GET', 'DELETE'])
@transaction.atomic
def user_data(request, pk):
    user = managed_user(request, pk, lock=True)
    if request.method == 'DELETE':
        if user.pk == request.user.pk or user.is_staff or user.is_superuser:
            raise ValueError('Chỉ xóa toàn bộ dữ liệu của tài khoản thường khác.')
        if body(request).get('confirm') != user.username:
            raise ValueError('Nhập đúng tên tài khoản để xác nhận.')
        # Keep credentials and audit history; remove owned and personal learning data.
        from users.models import Classroom, ClassroomAssignment, Theme
        ClassroomAssignment.objects.filter(assigned_by=user).delete()
        Classroom.members.through.objects.filter(user_id=user.pk).delete()
        counts = {kind: collection(kind, user).count() for kind in DATA}
        for kind in DATA:
            collection(kind, user).delete()
        Theme.objects.filter(owner=user).delete()
        revoke_sessions(user)
        audit(request, user, 'Xóa toàn bộ dữ liệu học tập và hồ sơ; giữ tài khoản. ' + str(counts))
        return JsonResponse({'ok': True, 'deleted': counts})
    return JsonResponse({'username': user.username, 'collections': [
        {'key': key, 'label': value[2], 'count': collection(key, user).count()}
        for key, value in DATA.items()]})

def validate_relation(field, value, user, language):
    if value is None:
        return
    target = field.remote_field.model
    match = next((k for k, (name, _, _) in DATA.items() if apps.get_model(name) == target), None)
    if not match:
        raise ValueError('Không được sửa liên kết này.')
    qs = collection(match, user)
    if language and any(f.name == 'language' for f in target._meta.fields):
        qs = qs.filter(language=language)
    if not qs.filter(pk=value).exists():
        raise ValueError('Liên kết phải thuộc cùng tài khoản và không gian ngôn ngữ.')

@management('auth.change_user')
@require_http_methods(['GET', 'POST', 'PATCH', 'DELETE'])
@transaction.atomic
def records(request, pk, kind, item_id=None):
    user = managed_user(request, pk, lock=request.method != 'GET')
    qs = collection(kind, user)
    model = qs.model
    item = None
    if item_id is not None:
        from django.shortcuts import get_object_or_404
        item = get_object_or_404(qs, pk=item_id)
    if request.method == 'GET':
        if item: return JsonResponse(record(item))
        page = max(1, int(request.GET.get('page', 1)))
        query = request.GET.get('q', '')[:100]
        names = {f.name for f in model._meta.fields}
        text_field = next((f for f in ('title', 'name', 'german_text', 'display_name') if f in names), None)
        if query and text_field: qs = qs.filter(**{text_field + '__icontains': query})
        language = request.GET.get('language')
        if language in ('en', 'de') and 'language' in names: qs = qs.filter(language=language)
        fields = [{'name': f.name, 'type': f.get_internal_type(), 'required': not (f.blank or f.null or f.has_default()),
                   'default': f.get_default() if f.has_default() else None,
                   'choices': list(f.choices or []),
                   'relation': next((key for key, (name, _, _) in DATA.items() if f.is_relation and apps.get_model(name) == f.remote_field.model), None)
                  } for f in editable_fields(model)]
        if kind in ('classes', 'practice'):
            fields.append({'name': 'members' if kind == 'classes' else 'links', 'type': 'JSONField', 'required': False, 'default': [], 'choices': []})
        return JsonResponse({'rows': [record(v) for v in qs.order_by('pk')[(page-1)*25:page*25]],
                             'total': qs.count(), 'page': page, 'fields': fields,
                             'can_create': kind not in ('media', 'audio')})
    if request.method in ('PATCH', 'DELETE') and item is None: raise Http404
    if request.method == 'POST' and item is not None: raise ValueError('Dùng danh sách để tạo dữ liệu.')
    if request.method == 'DELETE':
        audit(request, user, f'Xóa {kind} #{item.pk}.')
        item.delete()
        return JsonResponse({'ok': True})
    data = body(request)
    allowed = {f.name: f for f in editable_fields(model)}
    extra = {'members'} if kind == 'classes' else {'links'} if kind == 'practice' else set()
    if set(data) - set(allowed) - extra: raise ValueError('Có trường không được phép chỉnh sửa.')
    existing_relations = {f.name: getattr(item, f.attname) for f in allowed.values() if f.is_relation} if item else {}
    item = item or model()
    direct_owner = DATA[kind][1]
    if '__' not in direct_owner: setattr(item, direct_owner, user)
    if item.pk and 'language' in data and data['language'] != getattr(item, 'language', None):
        raise ValueError('Không chuyển dữ liệu sang ngôn ngữ khác.')
    for key, value in data.items():
        if key in extra: continue
        field = allowed[key]
        if field.is_relation: setattr(item, field.attname, value or None)
        else: setattr(item, key, value)
    language = getattr(item, 'language', None)
    for field in allowed.values():
        if field.is_relation and (field.name not in existing_relations or str(existing_relations[field.name]) != str(getattr(item, field.attname))):
            validate_relation(field, getattr(item, field.attname), user, language)
    if kind == 'sessions' and 'tokens' in data:
        tokens = data['tokens']
        if not isinstance(tokens, list) or collection('attempts', user).filter(token__in=tokens).count() != len(set(tokens)):
            raise ValueError('Phiên học chỉ chứa lượt làm bài của tài khoản này.')
    # Reuse authoring validators for content, media ownership and tree constraints.
    if kind == 'practice':
        from .practice_hub import save_node
        if item.pk: item.refresh_from_db()
        item = save_node(SimpleNamespace(user=user, language=language), data, item if item.pk else None)
    elif kind in ('folders', 'decks', 'cards', 'settings'):
        from cards.forms import FolderForm, DeckForm, CardForm, SettingsForm
        values = model_to_dict(item)
        if kind == 'folders': form = FolderForm(values, instance=item, user=user, language=language)
        elif kind == 'decks': form = DeckForm(values, instance=item, user=user, language=language)
        elif kind == 'settings': form = SettingsForm(values, instance=item)
        else:
            for key in ('accepted_answers', 'accepted_examples'):
                values[key] = '\n'.join(values.get(key) or [])
            form = CardForm(values, instance=item)
        if not form.is_valid(): raise ValueError(form.errors.as_text())
        item = form.save(commit=False)
        item.full_clean()
        item.save()
    else:
        if kind in ('media', 'audio') and request.method == 'POST':
            raise ValueError('Tệp cần được tải lên qua công cụ Media.')
        # Existing learner endpoints legitimately persist empty default JSON containers.
        empty_defaults = [f.name for f in model._meta.fields if isinstance(f, models.JSONField)
                          and f.has_default() and getattr(item, f.name) in ({}, [])]
        nullable = [f.name for f in model._meta.fields if f.null and getattr(item, f.attname) is None]
        item.full_clean(exclude=empty_defaults + nullable)
        item.save()
    if kind == 'classes' and 'members' in data:
        ids = data['members']
        if not isinstance(ids, list) or any(type(v) is not int for v in ids): raise ValueError('Thành viên cần danh sách ID.')
        members = get_user_model().objects.filter(pk__in=ids)
        if not request.user.is_superuser: members = members.filter(is_staff=False,is_superuser=False)
        if members.count() != len(set(ids)): raise ValueError('Thành viên không hợp lệ hoặc không có quyền quản lý.')
        item.members.set(members)
    audit(request, user, f'{"Tạo" if request.method == "POST" else "Sửa"} {kind} #{item.pk}.')
    return JsonResponse(record(item), status=201 if request.method == 'POST' else 200)

@management('system.view')
@require_http_methods(['GET'])
def overview(request):
    now = timezone.now()
    users = get_user_model().objects.all()
    with connection.cursor() as cursor: cursor.execute('SELECT 1'); cursor.fetchone()
    executor = MigrationExecutor(connection)
    pending = len(executor.migration_plan(executor.loader.graph.leaf_nodes()))
    from django.contrib.admin.models import LogEntry
    return JsonResponse({
        'checked_at': now.isoformat(),
        'users': {'total': users.count(), 'active': users.filter(is_active=True).count(),
                  'staff': users.filter(is_staff=True,is_superuser=False).count(), 'superusers': users.filter(is_superuser=True).count(),
                  'joined_week': users.filter(date_joined__gte=now-timedelta(days=7)).count(),
                  'seen_week': users.filter(last_login__gte=now-timedelta(days=7)).count()},
        'content': {key: apps.get_model(DATA[key][0]).objects.count() for key in ('decks','cards','practice','media','classes')},
        'system': {'database': connection.vendor, 'database_ok': True, 'pending_migrations': pending,
                   'django': django.get_version(), 'python': platform.python_version(), 'debug': settings.DEBUG},
        'logs': [{'at': l.action_time, 'actor': l.user.username, 'target': l.object_repr, 'message': l.change_message}
                 for l in LogEntry.objects.select_related('user').order_by('-action_time')[:30]],
    })
