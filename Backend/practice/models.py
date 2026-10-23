from content.sharing import SharedContent
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
import uuid

class PracticeMedia(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    language = models.CharField(max_length=2, choices=[('en','English'),('de','Deutsch')])
    file = models.FileField(upload_to='practice_media/%Y/%m/')
    name = models.CharField(max_length=255)
    size = models.PositiveBigIntegerField()
    content_type = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)

class PracticeNode(SharedContent):
    """Flexible folder tree for exercises and theory."""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='practice_nodes')
    language = models.CharField(max_length=2, choices=[('en','English'),('de','Deutsch')])
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    kind = models.CharField(max_length=12, choices=[('folder','Folder'),('exercise','Exercise'),('theory','Theory')])
    attachments = models.ManyToManyField(PracticeMedia, blank=True, related_name="nodes")
    title = models.CharField(max_length=200)
    payload = models.JSONField(default=dict, blank=True)
    links = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='linked_from')
    visibility = models.CharField(max_length=10, default='private', choices=[('private','Private'),('public','Public')])
    position = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    def clean(self):
        super().clean()
        if self.kind == 'exercise' and not self.parent_id:
            raise ValidationError({'parent': 'Exercises must be inside a folder.'})
        if self.parent_id:
            parent = self.parent
            if parent.kind != 'folder' or parent.language != self.language or parent.owner_id != self.owner_id:
                raise ValidationError({'parent': 'Choose a folder you own in the same language.'})

    class Meta:
        constraints = [models.CheckConstraint(condition=~models.Q(kind='exercise') | models.Q(parent__isnull=False), name='practice_exercise_requires_folder')]
        ordering = ['position','id']

class PracticeAttempt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    node = models.ForeignKey(PracticeNode, on_delete=models.CASCADE, related_name='attempts')
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    answers = models.JSONField(default=dict)
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

class PracticeProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    node = models.ForeignKey(PracticeNode, on_delete=models.CASCADE, related_name='learning_progress')
    revision = models.CharField(max_length=64)
    completed = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'node'], name='unique_practice_progress')]


class ReadingLesson(SharedContent):
    folder = models.ForeignKey("ReadingFolder", null=True, blank=True, on_delete=models.SET_NULL)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    language = models.CharField(max_length=2, choices=[('en','English'),('de','German')])
    source_key = models.CharField(max_length=160, blank=True, default='')
    title = models.CharField(max_length=200)
    payload = models.JSONField(default=dict)
    visibility = models.CharField(max_length=10, default='private', choices=[('private','Private'),('public','Public')])
    level = models.CharField(max_length=2, blank=True, default='')
    topic = models.CharField(max_length=80, blank=True, default='')
    attachments = models.ManyToManyField(PracticeMedia, blank=True, related_name='readings')
    completed = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    class Meta:
        constraints = [models.UniqueConstraint(fields=['owner','language','source_key'], condition=~models.Q(source_key=''), name='unique_saved_reading_source')]


class ReadingProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    lesson = models.ForeignKey(ReadingLesson, on_delete=models.CASCADE)
    revision = models.CharField(max_length=64)
    completed = models.JSONField(default=list)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'lesson'], name='unique_reading_progress')]


class ReadingFolder(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    language = models.CharField(max_length=2)
    title = models.CharField(max_length=200)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE)


class SystemContentPackage(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    language = models.CharField(max_length=2)
    digest = models.CharField(max_length=64)
    document = models.JSONField()
    counts = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)


class PackageReceipt(models.Model):
    package = models.ForeignKey(SystemContentPackage, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    result = models.JSONField(default=dict)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['package','user'], name='unique_package_user')]
