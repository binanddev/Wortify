from django.db import models

LANGUAGES = [('de', 'Tiếng Đức'), ('en', 'Tiếng Anh')]
LEVELS = [(x, x) for x in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']]

class Book(models.Model):
    metadata = models.JSONField(default=dict, blank=True)
    source_directory = models.CharField(max_length=240, blank=True)
    slug = models.SlugField(unique=True)
    title = models.CharField(max_length=200)
    language = models.CharField(max_length=2, choices=LANGUAGES)
    level = models.CharField(max_length=2, choices=LEVELS, blank=True)
    author = models.CharField(max_length=150, blank=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.title

from .assets import BookAsset
from .batches import BookImportBatch
