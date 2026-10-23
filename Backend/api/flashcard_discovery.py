from .content_workspace import content_owner, is_editor, scope
from .common import public_endpoint
from django.db import transaction
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
    from .flashcard_search import discover_data
    owner = content_owner(request) if request.user.is_authenticated else None
    return JsonResponse(discover_data(request, owner))

@endpoint
@require_POST
@transaction.atomic
def copy(request,pk):
    if is_editor(request.user) and scope(request) == 'shared':
        source = get_object_or_404(Deck,pk=pk,language=request.language,visibility='public',owner__is_active=True)
        if source.owner_id == content_owner(request).pk:
            return JsonResponse({'id':source.pk,'already_saved':True})
        raise ValueError('Switch to Personal sandbox to save a personal copy. Use Bulk import to publish reviewed content as Wortify.')
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
    cards=list(deck.cards.order_by('position','pk').values('german_text','vietnamese_meaning','example_german','example_vietnamese','image_url','image_source_url','image_credit','image_license','image_license_url')[(page-1)*size:page*size])
    return JsonResponse({'id':deck.pk,'title':deck.title,'page':page,'page_size':size,'description':deck.description,'cards':cards,'count':deck.cards.count()})
