from django.http import JsonResponse


def csrf_failure(request, reason=""):
    return JsonResponse({'error':'Your security session has changed. Reload the page and try again.'}, status=403)
