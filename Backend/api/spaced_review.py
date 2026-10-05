"""Private due queue, forecasts and simple FSRS options."""
from datetime import timedelta
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.http import require_http_methods
from cards.models import Deck, DeckLearningState, StudyProgress
from cards.services.spaced import summary
from .common import endpoint, body

@endpoint
@require_http_methods(['GET','PATCH'])
def review_queue(request, pk):
    deck=get_object_or_404(Deck,pk=pk,owner=request.user,language=request.language)
    state,_=DeckLearningState.objects.get_or_create(user=request.user,deck=deck)
    config={'retention':.9,'new_limit':20,'review_limit':100,'adapt_time':True, **state.options.get('srs',{})}
    if request.method=='PATCH':
        values=body(request)
        if set(values)-set(config):raise ValueError('Tùy chọn không hợp lệ.')
        config.update(values)
        if type(config['retention']) not in (float,int) or not .8<=config['retention']<=.97:raise ValueError('Mức ghi nhớ từ 80% đến 97%.')
        if any(type(config[k]) is not int or not 0<=config[k]<=500 for k in ('new_limit','review_limit')) or type(config['adapt_time']) is not bool:raise ValueError('Giới hạn từ 0–500 thẻ.')
        state.options={**state.options,'srs':config};state.save(update_fields=['options'])
    now=timezone.now(); today=timezone.localdate()
    progress={p.card_id:p for p in StudyProgress.objects.filter(user=request.user,card__deck=deck)}
    cards=list(deck.cards.all())
    due=sorted([c for c in cards if c.pk in progress and progress[c.pk].due_at<=now],key=lambda c:progress[c.pk].due_at)
    new=[c for c in cards if c.pk not in progress]
    def reviewed_today(p):return bool(p.last_reviewed_at and timezone.localtime(p.last_reviewed_at).date()==today)
    used=sum(reviewed_today(p) for p in progress.values())
    first_today=sum(bool((first:=parse_datetime(p.memory.get('first_review',''))) and timezone.localtime(first).date()==today) for p in progress.values())
    learning=[c for c in due if progress[c.pk].interval_days<1]
    reviews=[c for c in due if progress[c.pk].interval_days>=1]
    allowance=max(0,config['review_limit']-used)
    queue=learning+reviews[:allowance]+new[:max(0,min(config['new_limit']-first_today,allowance-len(reviews)))]
    return JsonResponse({'config':config,'due':len(due),'new':len(new),'reviewed_today':used,
        'next_due':min((p.due_at for p in progress.values() if p.due_at>now),default=None),
        'forecast':[{'date':(today+timedelta(days=i)).isoformat(),'count':sum(timezone.localtime(p.due_at).date()==today+timedelta(days=i) for p in progress.values())} for i in range(7)],
        'cards':[{'id':c.pk,'front':c.german_text,'back':c.vietnamese_meaning,'example':c.example_german,**summary(progress.get(c.pk),now,config)} for c in queue[:100]],
        'difficult':[{'id':c.pk,'title':c.german_text,'lapses':progress[c.pk].lapse_count} for c in sorted([c for c in cards if c.pk in progress and progress[c.pk].lapse_count>=3],key=lambda c:-progress[c.pk].lapse_count)[:10]]})
