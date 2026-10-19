from .common import public_endpoint
from django.db import transaction
from django.db.models import Q, Count
from django.forms.models import model_to_dict
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.views.decorators.http import require_GET,require_POST
from cards.models import Deck,Card
from .common import endpoint

@public_endpoint
@require_GET
def discover(request):
    qs=Deck.objects.filter(language=request.language,visibility='public',owner__is_active=True).select_related('owner').annotate(count=Count('cards'))
    q=request.GET.get('q','').strip()[:200]
    if q:qs=qs.filter(Q(title__icontains=q)|Q(topic__icontains=q))
    if request.GET.get('level'):qs=qs.filter(level=request.GET['level'])
    if request.GET.get('topic'):qs=qs.filter(topic__icontains=request.GET['topic'][:100])
    total=qs.count();pages=max(1,(total+23)//24);page=min(pages,max(1,int(request.GET.get('page',1))))
    saved=dict(Deck.objects.filter(owner=request.user,archived=False,source_deck__isnull=False).values_list('source_deck_id','id')) if request.user.is_authenticated else {}
    rows=[dict(id=d.pk,title=d.title,level=d.level,topic=d.topic,count=d.count,author='Wortify' if d.owner.is_staff else d.owner.get_username(),saved_id=d.pk if d.owner_id==request.user.pk and not d.archived else saved.get(d.pk)) for d in qs.order_by('-updated_at','-pk')[(page-1)*24:page*24]]
    return JsonResponse({'results':rows,'page':page,'pages':pages,'total':total})

@endpoint
@require_POST
@transaction.atomic
def copy(request,pk):
    get_user_model().objects.select_for_update().get(pk=request.user.pk)
    source=get_object_or_404(Deck,pk=pk,language=request.language,visibility='public',owner__is_active=True)
    existing=source if source.owner_id==request.user.pk else Deck.objects.filter(owner=request.user,source_deck=source).first()
    if existing:
        if existing.archived:
            existing.archived=False;existing.save(update_fields=['archived'])
        return JsonResponse({'id':existing.pk,'already_saved':True})
    deck=Deck.objects.create(owner=request.user,language=source.language,title=source.title,description=source.description,level=source.level,topic=source.topic,source_deck=source)
    Card.objects.bulk_create([Card(deck=deck,**model_to_dict(c,exclude=['id','deck'])) for c in source.cards.all()])
    return JsonResponse({'id':deck.pk},status=201)


@public_endpoint
@require_GET
def detail(request,pk):
    deck=get_object_or_404(Deck,pk=pk,language=request.language,visibility='public',owner__is_active=True)
    page=max(1,int(request.GET.get('page','1')))
    size=30 if request.GET.get('study')=='true' else 10
    cards=list(deck.cards.order_by('position','pk').values('german_text','vietnamese_meaning','example_german','example_vietnamese')[(page-1)*size:page*size])
    return JsonResponse({'id':deck.pk,'title':deck.title,'page':page,'page_size':size,'description':deck.description,'cards':cards,'count':deck.cards.count()})
