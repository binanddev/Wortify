from django.db import models

class SiteAppearance(models.Model):
    background_image = models.FileField(upload_to='site/backgrounds/', blank=True)
    updated_at = models.DateTimeField(auto_now=True)
