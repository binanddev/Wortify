from django.db import models
import uuid

class BookAsset(models.Model):
    book = models.ForeignKey('content.Book', on_delete=models.CASCADE, related_name='assets')
    key = models.CharField(max_length=240)
    file = models.FileField(upload_to='books/%Y/%m/')
    kind = models.CharField(max_length=10, choices=[('image','Hình ảnh'),('audio','Âm thanh')])
    description = models.CharField(max_length=300, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['book','key'], name='unique_book_asset_key')]
    def __str__(self):
        return f'{self.book}: {self.key}'
