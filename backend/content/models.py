from django.db import models
from django.conf import settings

class SiteAppearance(models.Model):
    background_image = models.FileField(upload_to='site/backgrounds/', blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class BackendCheck(models.Model):
    """Browser observations, distinct from server error/audit logs."""
    token = models.UUIDField(unique=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    checked_at = models.DateTimeField(db_index=True)
    received_at = models.DateTimeField(auto_now_add=True)
    ok = models.BooleanField()
    latency_ms = models.PositiveIntegerField()
    error = models.CharField(max_length=32, blank=True)

    class Meta:
        ordering = ['-checked_at', '-pk']
