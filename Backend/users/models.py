import uuid
from django.conf import settings
from django.db import models

class Theme(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='appearance_themes')
    name = models.CharField(max_length=80)
    shared = models.BooleanField(default=False)
    preferences = models.JSONField(default=dict)
    background_image = models.FileField(upload_to='users/themes/', blank=True)
    updated_at = models.DateTimeField(auto_now=True)

class Profile(models.Model):
    use_default_background = models.BooleanField(default=True)
    theme_de = models.ForeignKey(Theme, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    theme_en = models.ForeignKey(Theme, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    background_image = models.FileField(upload_to="users/backgrounds/", blank=True)
    background_updated_at = models.DateTimeField(null=True, blank=True)
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



from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.db import transaction

@receiver(post_delete, sender=Profile)
def delete_personal_background(sender, instance, **kwargs):
    if instance.background_image:
        storage, name = instance.background_image.storage, instance.background_image.name
        transaction.on_commit(lambda: storage.delete(name))

@receiver(post_delete, sender=Theme)
def delete_theme_background(sender, instance, **kwargs):
    if instance.background_image:
        storage, name = instance.background_image.storage, instance.background_image.name
        transaction.on_commit(lambda: storage.delete(name))
