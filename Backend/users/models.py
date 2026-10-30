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


class ContentImportKey(models.Model):
    """One revocable import-only key per staff account; raw secrets are never stored."""
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    digest = models.CharField(max_length=64, unique=True)
    prefix = models.CharField(max_length=12)
    created_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(null=True, blank=True)


class TeachingBoard(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='boards')
    title = models.CharField(max_length=120)
    state = models.JSONField(default=dict)
    revision = models.PositiveIntegerField(default=0)
    public_enabled = models.BooleanField(default=False)
    public_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    public_version = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

class BoardEvent(models.Model):
    board = models.ForeignKey(TeachingBoard, on_delete=models.CASCADE, related_name='events')
    revision = models.PositiveIntegerField()
    batch = models.UUIDField()
    operations = models.JSONField()
    class Meta:
        constraints = [models.UniqueConstraint(fields=['board', 'revision'], name='board_revision'), models.UniqueConstraint(fields=['board', 'batch'], name='board_batch')]

class BoardPDF(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    board = models.ForeignKey(TeachingBoard, on_delete=models.CASCADE, related_name='pdfs')
    file = models.FileField(upload_to='classes/pdfs/')
    name = models.CharField(max_length=255)
    size = models.PositiveBigIntegerField()

@receiver(post_delete, sender=BoardPDF)
def delete_board_pdf(sender, instance, **kwargs):
    if instance.file:
        storage, name = instance.file.storage, instance.file.name
        transaction.on_commit(lambda: storage.delete(name))


class FeatureAvailability(models.Model):
    """Temporary rollout switches; independent of classroom and theme data."""
    themes = models.JSONField(default=dict, blank=True)
    classes = models.BooleanField(default=True)
