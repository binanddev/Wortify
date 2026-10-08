import uuid
from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone


class Folder(models.Model):
    parent = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="children")
    language = models.CharField(max_length=2, default='de', choices=[('de', 'German'), ('en', 'English')])
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    name = models.CharField('Folder name', max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    theory_format = models.CharField(max_length=10, choices=[('markdown', 'Markdown'), ('html', 'HTML')], blank=True)
    theory_content = models.TextField(blank=True)

    class Meta:
        ordering = ['name', 'id']
        constraints = [models.UniqueConstraint(fields=['owner', 'language', 'name'], name='unique_owner_language_folder')]

    def __str__(self):
        return self.name


class Deck(models.Model):
    folder = models.ForeignKey(Folder, verbose_name='Folder', null=True, blank=True, on_delete=models.SET_NULL, related_name='decks')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    title = models.CharField('Deck name', max_length=150)
    description = models.TextField('Description', blank=True)
    level = models.CharField('Level', max_length=10, default='A2')
    topic = models.CharField('Topic', max_length=100, blank=True)
    language = models.CharField(max_length=10, default='de', choices=[('de', 'German'), ('en', 'English')])
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class Card(models.Model):
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE, related_name='cards')
    german_text = models.CharField('Word / phrase', max_length=500)
    vietnamese_meaning = models.CharField('Vietnamese meaning', max_length=500)
    example_german = models.TextField('Example sentence', blank=True, max_length=2000)
    example_vietnamese = models.TextField('Example sentence meaning', blank=True, max_length=2000)
    part_of_speech = models.CharField('Part of speech', max_length=50, blank=True)
    article = models.CharField('Article', max_length=10, blank=True)
    plural_form = models.CharField('Plural', max_length=100, blank=True)
    notes = models.TextField('Notes', blank=True, max_length=2000)
    usage = models.TextField('Usage', blank=True, max_length=2000)
    accepted_answers = models.JSONField('Accepted term answers (JSON list)', default=list, blank=True)
    accepted_examples = models.JSONField('Accepted sentence answers (JSON list)', default=list, blank=True)
    position = models.PositiveIntegerField('Order', default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['position', 'id']

    def __str__(self):
        return self.german_text


class StudySettings(models.Model):
    language = models.CharField(max_length=2, default='de', choices=[('de', 'German'), ('en', 'English')])
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    autoplay = models.BooleanField('Automatically read the learning language aloud', default=False)
    ignore_case = models.BooleanField('Ignore case', default=True)
    ignore_punctuation = models.BooleanField('Ignore punctuation', default=True)
    transliteration = models.BooleanField('Accept ae/oe/ue/ss', default=False)
    new_cards_per_day = models.PositiveSmallIntegerField('New cards per day', default=20)
    session_minutes = models.PositiveSmallIntegerField('Minutes per session', default=15)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user','language'], name='unique_user_language_settings')]


class StudyProgress(models.Model):
    memory = models.JSONField(default=dict, blank=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    card = models.ForeignKey(Card, on_delete=models.CASCADE)
    state = models.CharField(max_length=20, default='learning')
    due_at = models.DateTimeField(default=timezone.now)
    interval_days = models.FloatField(default=0)
    correct_count = models.PositiveIntegerField(default=0)
    incorrect_count = models.PositiveIntegerField(default=0)
    lapse_count = models.PositiveIntegerField(default=0)
    repetition_count = models.PositiveIntegerField(default=0)
    last_reviewed_at = models.DateTimeField(null=True)
    last_mode = models.CharField(max_length=20, blank=True)
    response_time_ms = models.PositiveIntegerField(null=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'card'], name='unique_user_card_progress')]


class StudyAttempt(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    card = models.ForeignKey(Card, on_delete=models.CASCADE)
    mode = models.CharField(max_length=20)
    question = models.JSONField(default=dict)
    submitted_answer = models.TextField(blank=True)
    normalized_answer = models.TextField(blank=True)
    is_correct = models.BooleanField(null=True)
    response_time_ms = models.PositiveIntegerField(null=True)
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True)
    abandoned = models.BooleanField(default=False)
    processing_started_at = models.DateTimeField(null=True, blank=True)


class ImportBatch(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE)
    rows = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True)


class MatchRound(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE)
    pairs = models.JSONField(default=list)
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True)


class CardAudio(models.Model):
    card = models.ForeignKey(Card, on_delete=models.CASCADE)
    audio_type = models.CharField(max_length=10)
    provider = models.CharField(max_length=30)
    voice = models.CharField(max_length=100)
    content_hash = models.CharField(max_length=64, unique=True)
    audio_file = models.FileField(upload_to='tts/')
    created_at = models.DateTimeField(auto_now_add=True)


@receiver(post_delete, sender=CardAudio)
def delete_audio(sender, instance, **kwargs):
    if instance.audio_file:
        instance.audio_file.delete(save=False)


class StudySession(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    language = models.CharField(max_length=2)
    deck = models.ForeignKey(Deck, null=True, blank=True, on_delete=models.CASCADE)
    kind = models.CharField(max_length=10, choices=[('flash','Flashcards'),('learn','Learn'),('test','Test')])
    tokens = models.JSONField(default=list)
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True)


class DeckLearningState(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    deck = models.ForeignKey(Deck, on_delete=models.CASCADE)
    options = models.JSONField(default=dict)
    progress = models.JSONField(default=dict)
    stars = models.JSONField(default=dict)
    options_at = models.CharField(max_length=40, blank=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user','deck'],name='unique_deck_learning_state')]

class LearningEvent(models.Model):
    token = models.UUIDField(unique=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    language = models.CharField(max_length=2)
    kind = models.CharField(max_length=30)
    payload = models.JSONField(default=dict)
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
