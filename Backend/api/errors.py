from django.http import JsonResponse


def csrf_failure(request, reason=""):
    return JsonResponse({'error':'Phiên bảo mật đã thay đổi. Hãy tải lại trang rồi thử lại.'}, status=403)
