from django.db import models
from django.conf import settings
import uuid

class PracticeNode(models.Model):
    """Flexible folder tree for exercises and theory."""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='practice_nodes')
    language = models.CharField(max_length=2, choices=[('en','English'),('de','Deutsch')])
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='children')
    kind = models.CharField(max_length=12, choices=[('folder','Folder'),('exercise','Exercise'),('theory','Theory')])
    title = models.CharField(max_length=200)
    payload = models.JSONField(default=dict, blank=True)
    links = models.ManyToManyField('self', symmetrical=False, blank=True, related_name='linked_from')
    visibility = models.CharField(max_length=10, default='private', choices=[('private','Private'),('public','Public')])
    position = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ['position','id']

class PracticeAttempt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    node = models.ForeignKey(PracticeNode, on_delete=models.CASCADE, related_name='attempts')
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    answers = models.JSONField(default=dict)
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
