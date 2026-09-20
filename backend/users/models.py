import uuid
from django.conf import settings
from django.db import models

class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    display_name = models.CharField(max_length=100, blank=True)
    bio = models.TextField(blank=True)

class Classroom(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_classes')
    language = models.CharField(max_length=2, choices=[('de','Deutsch'),('en','English')])
    title = models.CharField(max_length=120)
    invite = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='classrooms', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class Review(models.Model):
    attempt = models.OneToOneField('practice.Attempt', on_delete=models.CASCADE, related_name='peer_review')
    reviewer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='reviews_to_grade')
    classroom = models.ForeignKey(Classroom, null=True, blank=True, on_delete=models.SET_NULL)
    score = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    feedback = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    graded_at = models.DateTimeField(null=True, blank=True)
