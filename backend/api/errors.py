from django.http import JsonResponse
from django.views.csrf import csrf_failure as admin_csrf_failure


def csrf_failure(request, reason=""):
    if request.path.startswith('/admin/'):
        return admin_csrf_failure(request, reason=reason)
    return JsonResponse({'error':'Phiên bảo mật đã thay đổi. Hãy tải lại trang rồi thử lại.'}, status=403)
