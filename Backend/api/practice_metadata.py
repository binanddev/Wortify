"""Practice catalogue queries never hydrate exercise bodies or linked targets."""
from collections import defaultdict
from django.db.models import F
from practice.models import PracticeNode, PracticeProgress

LEGACY_MODES = {'cloze':'cloze_drag_drop', 'choice':'multiple_choice', 'multi':'multiple_choice',
                'text':'short_answer', 'order':'sentence_building', 'wordset':'short_answer'}


def catalogue(queryset, request, owner):
    if request.GET.get('scope') == 'workspace':
        hierarchy = list(queryset.values('id', 'parent_id', 'owner_id'))
        by_id = {row['id']:row for row in hierarchy}
        raw = request.GET.get('roots', '')
        values = raw.split(',') if raw else []
        if len(values) > 500 or any(not value.isdecimal() for value in values):
            raise ValueError('Invalid workspace roots.')
        selected = {row['id'] for row in hierarchy if row['owner_id'] == owner.pk}
        roots = {int(value) for value in values}
        current = request.GET.get('current', '')
        if current:
            if not current.isdecimal(): raise ValueError('Invalid current lesson.')
            roots.add(int(current))
        for pk in roots:
            node = by_id.get(pk)
            seen = set()
            while node and node['parent_id'] in by_id and node['id'] not in seen:
                seen.add(node['id'])
                node = by_id[node['parent_id']]
            if node: selected.add(node['id'])
        children = defaultdict(list)
        for row in hierarchy: children[row['parent_id']].append(row['id'])
        pending = list(selected)
        while pending:
            for pk in children[pending.pop()]:
                if pk not in selected:
                    selected.add(pk); pending.append(pk)
        # Keep authorized titles for the current lesson's related links.
        if current:
            for pk in PracticeNode.links.through.objects.filter(from_practicenode_id=int(current), from_practicenode_id__in=by_id).values_list('to_practicenode_id', flat=True):
                if pk in by_id: selected.add(pk)
        queryset = queryset.filter(pk__in=selected)
    if 'parent' in request.GET:
        parent = request.GET['parent']
        if parent not in ('', 'root') and not parent.isdecimal(): raise ValueError('Invalid folder.')
        queryset = queryset.filter(parent_id=int(parent) if parent not in ('', 'root') else None)
    needle = request.GET.get('q', '').strip().casefold()[:200]
    if needle: queryset = queryset.filter(title__icontains=needle)
    page_info = {}
    if 'page' in request.GET:
        page = max(1, int(request.GET['page']))
        size = max(1, min(100, int(request.GET.get('page_size', 24))))
        total = queryset.values('pk').count()
        page = min(page, max(1, (total+size-1)//size))
        queryset = queryset[(page-1)*size:page*size]
        page_info = {'total':total, 'page':page, 'page_size':size, 'has_more':page*size<total}
    rows = list(queryset.values('id', 'parent_id', 'owner_id', 'kind', 'title', 'visibility',
                               'position', 'updated_at').annotate(
        mode=F('payload__presentation__interaction'), legacy_type=F('payload__presentation__type'),
        legacy_kind=F('payload__kind'), root_tags=F('payload__tags')))
    ids = [row['id'] for row in rows]
    links = defaultdict(list)
    for source, target in PracticeNode.links.through.objects.filter(from_practicenode_id__in=ids).order_by('to_practicenode__position', 'to_practicenode_id').values_list('from_practicenode_id','to_practicenode_id'):
        links[source].append(target)
    progress = {row['node_id']:row for row in PracticeProgress.objects.filter(user=request.user,node_id__in=ids).values('node_id','revision','completed')}
    result = []
    for row in rows:
        legacy = row.pop('legacy_type') or row.pop('legacy_kind', None)
        row.pop('legacy_kind', None)
        mode = row.pop('mode') or LEGACY_MODES.get(legacy, legacy)
        tags = row.pop('root_tags')
        revision = row['updated_at'].isoformat()
        saved = progress.get(row['id'])
        parent = row.pop('parent_id')
        editable = row.pop('owner_id') == owner.pk
        result.append({**row, 'parent':parent, 'can_edit':editable,
                       'updated_at':revision, 'interaction':mode if row['kind']=='exercise' else None,
                       'tags':tags or [] if row['kind']=='folder' and not parent else [],
                       'links':links[row['id']], 'progress':{'completed':saved['completed'] if saved and saved['revision']==revision else []}})
    return {'nodes':result, **page_info}
