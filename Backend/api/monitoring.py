"""Server-to-server health reports; independent of users and browser sessions."""
import uuid
import secrets
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from datetime import timedelta
from django.db import connection, transaction, DatabaseError
from django.http import JsonResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.http import require_http_methods
from content.models import BackendCheck
from .common import body
from .management import management

@require_http_methods(['GET'])
def probe(request):
    try:
        with connection.cursor() as cursor: cursor.execute('SELECT 1'); cursor.fetchone()
        response = JsonResponse({'ok': True})
    except DatabaseError:
        response = JsonResponse({'ok': False}, status=503)
    response['Cache-Control'] = 'no-store'
    return response

def server_report(view):
    from functools import wraps
    @wraps(view)
    def wrapped(request):
        expected = settings.BACKEND_MONITOR_SECRET
        supplied = request.headers.get('X-Wortify-Monitor-Key', '')
        if not expected or not secrets.compare_digest(supplied.encode('utf-8'), expected.encode('utf-8')):
            return JsonResponse({'error': 'Máy chủ giám sát chưa được xác thực.'}, status=403)
        try: return view(request)
        except (ValueError, TypeError, AttributeError):
            return JsonResponse({'error': 'Báo cáo không hợp lệ.'}, status=400)
    return wrapped

@csrf_exempt
@require_http_methods(['POST'])
@server_report
@transaction.atomic
def report(request):
    items = body(request).get('checks')
    if not isinstance(items,list) or not 1 <= len(items) <= 50: raise ValueError('Gửi 1–50 lần kiểm tra.')
    now = timezone.now()
    rows = []
    for item in items:
        if not isinstance(item,dict): raise ValueError('Log không hợp lệ.')
        stamp = parse_datetime(item.get('at',''))
        if not stamp or timezone.is_naive(stamp) or stamp > now + timedelta(minutes=5) or stamp < now - timedelta(days=7):
            raise ValueError('Thời điểm kiểm tra không hợp lệ.')
        latency = item.get('latency_ms'); ok = item.get('ok'); error = item.get('error','')
        if type(ok) is not bool or type(latency) is not int or not 0 <= latency <= 60000 or error not in ('','timeout','network','http','invalid-response'):
            raise ValueError('Log không hợp lệ.')
        rows.append(BackendCheck(token=uuid.UUID(item.get('token','')),source='frontend-server',checked_at=stamp,ok=ok,latency_ms=latency,error=error))
    # Bound intake while allowing a week of persisted server checks to catch up.
    if BackendCheck.objects.filter(source='frontend-server',received_at__gte=now-timedelta(hours=1)).count() > 5000:
        return JsonResponse({'error':'Đã đạt giới hạn nhật ký trong giờ.'},status=429)
    BackendCheck.objects.bulk_create(rows,ignore_conflicts=True)
    BackendCheck.objects.filter(checked_at__lt=now-timedelta(days=30)).delete()
    return JsonResponse({'ok':True})

@management('system.view')
@require_http_methods(['GET'])
def logs(request):
    qs = BackendCheck.objects.filter(source='frontend-server')
    if request.GET.get('failures') == '1': qs = qs.filter(ok=False)
    page = max(1,int(request.GET.get('page',1)))
    return JsonResponse({'total':qs.count(),'page':page,'logs':[
        {'id':r.pk,'source':'Máy chủ frontend','at':r.checked_at,'received_at':r.received_at,'ok':r.ok,'latency_ms':r.latency_ms,'error':r.error}
        for r in qs[(page-1)*50:page*50]]})
