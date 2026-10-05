"""Bounded public folder discovery, with lightweight local relevance ranking."""
import hashlib
from difflib import SequenceMatcher
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from practice.models import PracticeNode


def browse(request):
    from .practice_hub import search_text, PUBLIC_MODES
    query = request.GET.get('q', '').strip()[:200]
    mode = request.GET.get('mode', '')
    sort = request.GET.get('sort', 'relevance')
    if mode and mode not in PUBLIC_MODES: raise ValueError('Dạng bài không hợp lệ.')
    if sort not in ('relevance', 'newest'): raise ValueError('Thứ tự không hợp lệ.')
    page = max(1, int(request.GET.get('page', 1)))
    parent = int(request.GET.get('folder') or 0)
    seed = request.GET.get('seed', 'daily')[:80]
    interests = request.GET.get('interests', '')[:600]
    rows = list(PracticeNode.objects.filter(language=request.language, visibility='public').select_related('owner'))
    by_id = {n.pk:n for n in rows}
    def path(node):
        result, seen = [], set()
        while node:
            if node.pk in seen: return []
            seen.add(node.pk); result.insert(0, node)
            if not node.parent_id: return result
            node = by_id.get(node.parent_id)
        return []  # Do not expose descendants of private parents.
    paths = {n.pk:path(n) for n in rows}
    rows = [n for n in rows if paths[n.pk]]
    if parent:
        current = get_object_or_404(PracticeNode, pk=parent, language=request.language, visibility='public', kind='folder')
        if not paths.get(current.pk):
            from django.http import Http404
            raise Http404
    else: current = None
    aliases = [('thi hien tai don','present simple','prasens'), ('thi qua khu don','past simple','prateritum'),
               ('thi hien tai tiep dien','present continuous'), ('tu vung','vocabulary','wortschatz'),
               ('do an','food','essen'), ('du lich','travel','reise'), ('ngu phap','grammar','grammatik')]
    def terms(text):
        text = search_text(text)
        expanded = text
        for group in aliases:
            if any(alias in text for alias in group): expanded += ' ' + ' '.join(group)
        return set(expanded.split()) - {'thi','the','a','an','va','and','und','der','die','das'}
    wanted, hints = terms(query), terms(interests)
    def score(tokens, text):
        words = text.split()
        return sum(1 if token in text else 0.5 if len(token) >= 4 and any(SequenceMatcher(None, token, w).ratio() >= .8 for w in words) else 0 for token in tokens)
    candidates = {n.pk:n for n in rows if n.parent_id == (parent or None) and (parent or n.kind == 'folder')}
    ranks = {pk:0 for pk in candidates}
    matched = set()
    for n in rows:
        chain = paths[n.pk]
        target = next((x for x in chain if x.pk in candidates), None)
        if not target: continue
        interaction = n.payload.get('presentation', {}).get('interaction', 'short_answer') if n.kind == 'exercise' else ''
        if mode and interaction != mode: continue
        if n.kind == 'exercise' and interaction not in PUBLIC_MODES: continue
        root = chain[0]
        tags = root.payload.get('tags', [])
        text = search_text(' '.join([n.title, root.title, ' '.join(tags), str(n.payload.get('instruction', '')), str(n.payload.get('context', '')), str(n.payload.get('content', ''))[:2000], ' '.join(str(q.get('prompt','')) for q in n.payload.get('questions',[]))[:3000], n.owner.get_username()]))
        relevance = score(wanted, text) if wanted else 0
        if wanted and relevance == 0: continue
        matched.add(target.pk)
        ranks[target.pk] = max(ranks[target.pk], relevance * 10 + score(hints, text))
    def summary(n):
        root = paths[n.pk][0]
        return {'id':n.pk,'parent':n.parent_id,'root_id':root.pk,'kind':n.kind,'title':n.title,
                'tags':n.payload.get('tags',[]) if not n.parent_id and n.kind=='folder' else [],
                'visibility':'public','position':n.position,'can_edit':n.owner_id==request.user.pk,
                'author':n.owner.get_full_name().strip() or n.owner.get_username(),
                'updated_at':n.updated_at.isoformat(), 'question_count':len(n.payload.get('questions',[])),
                'child_count':sum(c.parent_id==n.pk for c in rows)}
    selected = [n for pk,n in candidates.items() if pk in matched]
    selected.sort(key=lambda n: (n.updated_at.isoformat(),n.pk) if sort=='newest' else (ranks[n.pk], hashlib.sha256(f'{seed}:{n.pk}'.encode()).hexdigest()), reverse=True)
    total = len(selected)
    suggestions = list(dict.fromkeys(tag for n in selected[:24] for tag in paths[n.pk][0].payload.get('tags', [])))[:6]
    return JsonResponse({'results':[summary(n) for n in selected[(page-1)*12:page*12]],
                         'suggestions':suggestions, 'page':page,'has_more':page*12<total,'total':total,
                         'ancestors':[summary(n) for n in paths.get(parent,[])],
                         'current':summary(current) if current else None})
