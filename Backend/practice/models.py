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

class PracticeNode(models.Model):
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
            raise ValidationError({'parent': 'Bài tập phải nằm trong một thư mục.'})
        if self.parent_id:
            parent = self.parent
            if parent.kind != 'folder' or parent.language != self.language or parent.owner_id != self.owner_id:
                raise ValidationError({'parent': 'Chọn thư mục cùng ngôn ngữ và thuộc sở hữu của bạn.'})

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
