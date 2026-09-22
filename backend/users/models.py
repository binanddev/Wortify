import uuid
from django.conf import settings
from django.db import models

class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    display_name = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)
    preferences = models.JSONField(default=dict, blank=True)
    preferences_at = models.JSONField(default=dict, blank=True)

class Classroom(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_classes')
    language = models.CharField(max_length=2, choices=[('de','Deutsch'),('en','English')])
    title = models.CharField(max_length=120)
    invite = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='classrooms', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class ClassroomAssignment(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='assignments')
    node = models.ForeignKey('practice.PracticeNode', on_delete=models.CASCADE, related_name='class_assignments')
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_assignments')
    due_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['classroom', 'node'], name='unique_classroom_assignment')]

