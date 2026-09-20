import logging
from django.db.models.signals import pre_save,post_save
from django.dispatch import receiver
from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Attempt,Notification

@receiver(pre_save,sender=Attempt)
def remember_status(sender,instance,**kwargs):
    instance._previous_status=sender.objects.filter(pk=instance.pk).values_list('status',flat=True).first() if instance.pk else None

@receiver(post_save,sender=Attempt)
def notify_grade(sender,instance,created,**kwargs):
    if created or instance.status!='graded' or getattr(instance,'_previous_status',None) not in ['pending_manual','pending_ai']:
        return
    Notification.objects.create(session_key=instance.session_key,attempt=instance,text=f'Giáo viên đã chấm bài {instance.exercise.number}: {instance.exercise.title}')
    key=instance.session_key
    def broadcast():
        try:
            async_to_sync(get_channel_layer().group_send)('learner.'+key,{'type':'notifications.changed'})
        except Exception:
            logging.getLogger(__name__).exception('Notification saved; live delivery unavailable')
    transaction.on_commit(broadcast)
