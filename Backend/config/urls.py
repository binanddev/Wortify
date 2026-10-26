from api import deck_management
from api import content_policy
from api import flashcard_discovery
from api import content_import_api, content_import_docs
from api import content_packages
from api import reading, reading_discovery, reading_management
from api import admin_backups, admin_restore, site_exports
from api import backups
from api import api_reference, management_center, management_data, personal_appearance, monitoring, themes, backgrounds
from django.urls import path,re_path
from django.http import JsonResponse
from api import views,sessions,community,management,practice_hub,learning_sync,practice_media,practice_copy
from api.common import legacy_json,namespace
from users.views import session, superuser_registration, interface_language
from api import card_learning as cards
def health(request):
    import hashlib
    from django.conf import settings
    identity=hashlib.sha256(str(settings.BASE_DIR).lower().encode()).hexdigest()[:16]
    import os
    response = JsonResponse({'app':'Wortify','workspace':identity,'version':'1.14.0','revision':os.environ.get('RENDER_GIT_COMMIT',''),'features':['guest-learning','flashcard-discovery','content-import','content-policy','flashcard-dictation','flexible-answer-checking','flashcard-library-management','documented-site-export']})
    response['Cache-Control']='no-store'
    return response
urlpatterns=[path("api/site/content-policy/",content_policy.current),path("api/manage/content-policy/",content_policy.settings),path("api/import/guide/",content_import_docs.guide),path("api/import/openapi/",content_import_docs.openapi),path("api/manage/import-api/",content_import_api.settings),path("api/import/content/",content_import_api.upload),path('api/me/language/',interface_language),path('api/superuser-registration/<slug:setup_key>/',superuser_registration),path('api/health/',health),path('api/session/',session),
 path('api/health/check/',monitoring.probe),
 path('api/monitor/',monitoring.report),
 path('api/manage/monitor/',monitoring.logs),
 path('api/themes/',themes.themes),
 path('api/themes/select/',themes.select_theme),
 path('api/themes/<int:pk>/',themes.themes),
 path('api/themes/<int:pk>/delete/',themes.delete_theme),
 path('api/themes/<int:pk>/image/',themes.theme_image),
 path('api/me/backup/',backups.export),
 path('api/me/backup/restore/',backups.restore),
 path('api/me/appearance/',themes.manifest),
 path('api/me/backgrounds/',backgrounds.library),
 path('api/me/backgrounds/select/',backgrounds.select),
 path('api/me/backgrounds/<int:pk>/',backgrounds.remove),
 path('api/me/background/',personal_appearance.background),
 path('api/me/background/image/',personal_appearance.image),
 path('api/manage/content-packages/',content_packages.upload),path('api/manage/backups/import/',admin_restore.restore),path('api/manage/backups/site/',site_exports.export_site),path('api/manage/backups/',admin_backups.emergency),
 path('api/manage/summary/',management_center.summary),
 path('api/manage/api-docs/',api_reference.reference),
 path('api/manage/activity/',management_center.activity),
 path('api/manage/content/',management_center.content),
 path('api/manage/content/<int:pk>/',management_center.content_detail),
 path('api/manage/content/<int:pk>/media/',management_center.content_upload),
 path('api/manage/overview/',management_data.overview),
 path('api/manage/users/<int:pk>/data/',management_data.user_data),
 path('api/manage/users/<int:pk>/data/<str:kind>/',management_data.records),
 path('api/manage/users/<int:pk>/data/<str:kind>/<str:item_id>/',management_data.records),
 path('api/manage/users/',management.users),path('api/manage/users/<int:pk>/',management.user_detail),
 path('api/manage/appearance/',management.site_appearance),path('api/site/appearance/',management.public_appearance),path('api/site/appearance/image/',management.site_appearance_image)]
def route(pattern,view):urlpatterns.append(path('api/<str:language>/'+pattern,namespace(view)))
for pattern,view in [
 ('system-library/',content_packages.library),('system-library/<uuid:pk>/copy/',content_packages.copy),('reading/discover/',reading_discovery.library),('reading/discover/open/',reading_discovery.detail),('reading/discover/save/',reading_discovery.save),('reading/folders/',reading_management.create_folder),('reading/folders/<int:pk>/',reading_management.folder_detail),('reading/<int:pk>/metadata/',reading_management.metadata),('reading/organize/',reading_management.organize),('reading/<int:pk>/sharing/',reading.sharing),('reading/',reading.library),('reading/<int:pk>/',reading.detail),
 ('profile/',community.profile),('classes/',community.classes),('classes/<int:pk>/',community.classroom),('classes/<int:pk>/assignments/',community.classroom_assignments),
 ('practice-hub/nodes/<int:pk>/copy/',practice_copy.copy_collection),
 ('practice-hub/media/',practice_media.upload),('practice-hub/media/<uuid:pk>/',practice_media.content),
 ('practice-hub/public/<int:pk>/',practice_hub.public_detail),('practice-hub/explore/',practice_hub.explore),('practice-hub/nodes/',practice_hub.nodes),('practice-hub/nodes/<int:pk>/',practice_hub.node),('practice-hub/import/',practice_hub.import_nodes),('practice-hub/organize/',practice_hub.organize),
 ('learning/sync/',learning_sync.sync),('decks/<int:pk>/learning/',learning_sync.deck_state),
 ('decks/manage/',deck_management.manage),('decks/export/',deck_management.export),('settings/',views.preferences),('decks/',views.decks),('decks/<int:pk>/',views.deck),('study-pack/',views.study_pack),
 ('decks/<int:pk>/images/',views.card_images),('decks/<int:pk>/reorder/',views.reorder_cards),('decks/<int:pk>/import/',views.import_cards),('decks/<int:deck_id>/cards/',views.card),('decks/<int:deck_id>/cards/<int:pk>/',views.card),('folders/',views.folder),('folders/<int:pk>/',views.folder),
 ('flashcard/discover/',flashcard_discovery.discover),('flashcard/discover/<int:pk>/',flashcard_discovery.detail),('flashcard/discover/<int:pk>/copy/',flashcard_discovery.copy),('sessions/',sessions.create),('sessions/<uuid:token>/',sessions.detail),('sessions/<uuid:token>/answer/',sessions.answer),('sessions/<uuid:token>/finish/',sessions.finish_test),
]:route(pattern,view)
for pattern, view in [
 ('decks/<int:pk>/export/<str:fmt>/',cards.export_deck),('next/',cards.next_question),('question/<uuid:token>/',cards.resume_question),
 ('submit/<uuid:token>/',cards.submit),('audio/<uuid:token>/',cards.audio),('audio-file/<int:pk>/',cards.tts_file),('cards/<int:pk>/audio/',cards.card_audio),
 ('speaking/<uuid:token>/',cards.speaking_check),('retry/<uuid:token>/',cards.retry),('match/<int:pk>/new/',cards.match_new),('match/<uuid:token>/submit/',cards.match_submit),
]:route(pattern,legacy_json(view))
# React owns every non-API application URL. Django only exposes APIs and admin.
urlpatterns += [re_path(r'^.*$',lambda request:JsonResponse({'error':'There is no API at this path. Open the React interface.'},status=404))]
