from django.contrib import admin
from .models import Deck, Card, StudyProgress, StudyAttempt, CardAudio, StudySettings, Folder


@admin.register(Deck)
class DeckAdmin(admin.ModelAdmin):
    list_display = ['title', 'owner', 'language', 'level', 'topic']
    search_fields = ['title', 'owner__username']
    list_filter = ['language', 'level']


@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    list_display = ['german_text', 'vietnamese_meaning', 'deck', 'position']
    search_fields = ['german_text', 'deck__title']
    list_filter = ['part_of_speech']


@admin.register(StudyProgress)
class ProgressAdmin(admin.ModelAdmin):
    list_display = ['user', 'card', 'state', 'due_at', 'correct_count', 'incorrect_count']
    search_fields = ['user__username', 'card__german_text']
    list_filter = ['state', 'last_mode', 'due_at']


@admin.register(StudyAttempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ['user', 'card', 'mode', 'is_correct', 'created_at']
    search_fields = ['user__username', 'card__german_text']
    list_filter = ['mode', 'is_correct', 'created_at']


admin.site.register(CardAudio)
admin.site.register(StudySettings)

admin.site.register(Folder)

