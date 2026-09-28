from django.contrib import admin
from django.urls import path,re_path
from django.http import JsonResponse
from api import views,sessions,community,management,practice_hub,learning_sync
from api.common import legacy_json,namespace
from users.views import session
from api import card_learning as cards
# The low-level admin is also superuser-only; staff is currently a normal learner.
admin.site.has_permission=lambda request: request.user.is_active and request.user.is_superuser
def health(request):
    import hashlib
    from django.conf import settings
    identity=hashlib.sha256(str(settings.BASE_DIR.parent).lower().encode()).hexdigest()[:16]
    return JsonResponse({'app':'Wortify','workspace':identity})
urlpatterns=[path('api/health/',health),path('api/session/',session),path('admin/',admin.site.urls),
 path('api/manage/users/',management.users),path('api/manage/users/<int:pk>/',management.user_detail),
 path('api/manage/appearance/',management.site_appearance),path('api/site/appearance/',management.public_appearance),path('api/site/appearance/image/',management.site_appearance_image)]
def route(pattern,view):urlpatterns.append(path('api/<str:language>/'+pattern,namespace(view)))
for pattern,view in [
 ('profile/',community.profile),('classes/',community.classes),('classes/<int:pk>/',community.classroom),('classes/<int:pk>/assignments/',community.classroom_assignments),
 ('practice-hub/explore/',practice_hub.explore),('practice-hub/nodes/',practice_hub.nodes),('practice-hub/nodes/<int:pk>/',practice_hub.node),('practice-hub/import/',practice_hub.import_nodes),('practice-hub/organize/',practice_hub.organize),
 ('learning/sync/',learning_sync.sync),('decks/<int:pk>/learning/',learning_sync.deck_state),
 ('settings/',views.preferences),('decks/',views.decks),('decks/<int:pk>/',views.deck),('study-pack/',views.study_pack),
 ('decks/<int:pk>/reorder/',views.reorder_cards),('decks/<int:pk>/import/',views.import_cards),('decks/<int:deck_id>/cards/',views.card),('decks/<int:deck_id>/cards/<int:pk>/',views.card),('folders/',views.folder),('folders/<int:pk>/',views.folder),
 ('sessions/',sessions.create),('sessions/<uuid:token>/',sessions.detail),('sessions/<uuid:token>/answer/',sessions.answer),('sessions/<uuid:token>/finish/',sessions.finish_test),
]:route(pattern,view)
for pattern, view in [
 ('decks/<int:pk>/export/<str:fmt>/',cards.export_deck),('next/',cards.next_question),('question/<uuid:token>/',cards.resume_question),
 ('submit/<uuid:token>/',cards.submit),('audio/<uuid:token>/',cards.audio),('audio-file/<int:pk>/',cards.tts_file),('cards/<int:pk>/audio/',cards.card_audio),
 ('speaking/<uuid:token>/',cards.speaking_check),('retry/<uuid:token>/',cards.retry),('match/<int:pk>/new/',cards.match_new),('match/<uuid:token>/submit/',cards.match_submit),
]:route(pattern,legacy_json(view))
# React owns every non-API application URL. Django only exposes APIs and admin.
urlpatterns += [re_path(r'^.*$',lambda request:JsonResponse({'error':'Không có API tại đường dẫn này. Hãy mở giao diện React.'},status=404))]
