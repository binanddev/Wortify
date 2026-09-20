from .models import Notification

def notifications(request):
    key=request.session.session_key or ''
    qs=Notification.objects.filter(session_key=key,read_at__isnull=True).order_by('-created_at')
    return {'notifications':list(qs[:10]),'notification_count':qs.count()}
