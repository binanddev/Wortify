from django.urls import path
from . import views
urlpatterns = [path('notifications/<int:pk>/read/',views.read_notification,name='read_notification'),path('chapter/<int:number>/',views.chapter,name='chapter'),path('result/<int:pk>/review/',views.request_review,name='request_review'),path('',views.home,name='home'),path('exercise/<int:pk>/',views.exercise,name='exercise'),path('result/<int:pk>/',views.result,name='result')]
