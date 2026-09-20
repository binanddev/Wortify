from django.contrib import admin
from .models import Chapter, Exercise, Question, Attempt

class QuestionInline(admin.StackedInline):
    model = Question
    extra = 0

@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ['chapter','number','title','decision','check_mode','reviewed']
    list_filter = ['chapter','decision','check_mode','reviewed']
    inlines = [QuestionInline]

@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ['exercise','user','created_at','status','score','total']
    list_filter = ['status','exercise']
    readonly_fields = ['exercise','session_key','created_at','answers','total']

admin.site.register(Chapter)
