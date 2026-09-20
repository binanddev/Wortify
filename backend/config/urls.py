from django.contrib import admin
from django.urls import path, re_path
from django.http import JsonResponse
from api import views, sessions, community, management
from api.common import legacy_json, namespace
from users.views import session
from cards import views as cards
urlpatterns = [path('admin/', admin.site.urls), path('api/session/', session),
 path('api/manage/users/',management.users), path('api/manage/users/<int:pk>/',management.user_detail),
 path('api/manage/documentation/',management.json_documentation), path('api/manage/books/',management.admin_books), path('api/manage/json-template/',management.json_template),
 path('api/manage/books/<int:pk>/json/preview/',management.json_preview), path('api/manage/books/<int:pk>/json/confirm/',management.json_confirm), path('api/manage/books/<int:pk>/',management.admin_book),
 path('api/manage/books/<int:pk>/assets/',management.upload_assets),path('api/manage/exercises/<int:pk>/',management.admin_exercise),path('api/manage/chapters/<int:pk>/',management.admin_chapter),path('manage',views.shell)]
def route(pattern, view):
    urlpatterns.append(path('api/<str:language>/' + pattern, namespace(view)))
for pattern, view in [
 ('book-assets/<int:pk>/',management.book_asset),('profile/',community.profile),('classes/',community.classes),('classes/<int:pk>/',community.classroom),('reviews/',community.reviews),('reviews/<int:pk>/',community.review),
 ('dashboard/',views.dashboard),('settings/',views.preferences),('decks/',views.decks),('decks/<int:pk>/',views.deck),
 ('decks/<int:pk>/reorder/',views.reorder_cards),('decks/<int:pk>/import/',views.import_cards),('decks/<int:deck_id>/cards/',views.card),('decks/<int:deck_id>/cards/<int:pk>/',views.card),
 ('folders/',views.folder),('folders/<int:pk>/',views.folder),('books/',views.books),('books/<slug:slug>/',views.book),
 ('books/<slug:slug>/lessons/<int:pk>/progress/',views.chapter_progress),('books/<slug:slug>/lessons/<int:pk>/',views.lesson),('books/<slug:slug>/exercises/<int:pk>/',views.exercise),('results/<int:pk>/',views.result),
 ('sessions/',sessions.create),('sessions/<uuid:token>/',sessions.detail),('sessions/<uuid:token>/answer/',sessions.answer),('sessions/<uuid:token>/finish/',sessions.finish_test),
]:route(pattern,view)
for pattern, view in [
 ('decks/<int:pk>/export/<str:fmt>/',cards.export_deck),('next/',cards.next_question),('question/<uuid:token>/',cards.resume_question),
 ('submit/<uuid:token>/',cards.submit),('audio/<uuid:token>/',cards.audio),('audio-file/<int:pk>/',cards.tts_file),('cards/<int:pk>/audio/',cards.card_audio),
 ('speaking/<uuid:token>/',cards.speaking_check),('retry/<uuid:token>/',cards.retry),('match/<int:pk>/new/',cards.match_new),('match/<uuid:token>/submit/',cards.match_submit),
]:route(pattern,legacy_json(view))
urlpatterns += [re_path(r'^api/.*$',lambda request:JsonResponse({'error':'API không tồn tại.'},status=404)),path('',views.shell),path('login',views.shell),re_path(r'^(?:de|en)(?:/.*)?$',views.shell)]
