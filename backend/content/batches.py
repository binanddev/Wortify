from django.db import models
import uuid
from django.conf import settings

class BookImportBatch(models.Model):
    token=models.UUIDField(default=uuid.uuid4,unique=True,editable=False)
    book=models.ForeignKey('content.Book',on_delete=models.CASCADE)
    owner=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
    documents=models.JSONField()
    summary=models.JSONField(default=dict)
    created_at=models.DateTimeField(auto_now_add=True)
    confirmed_at=models.DateTimeField(null=True,blank=True)
