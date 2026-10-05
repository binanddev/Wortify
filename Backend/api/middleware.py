from django.http import JsonResponse

class PrivateResponsesMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith('/api/'):
            if response.status_code >= 400 and response.get('Content-Type', '').startswith('text/html'):
                original = response
                messages = {400:'Yêu cầu không hợp lệ.',403:'Bạn không có quyền truy cập.',404:'API không tồn tại.',405:'Phương thức không được hỗ trợ.'}
                response = JsonResponse({'error':messages.get(original.status_code,'Máy chủ chưa xử lý được yêu cầu.')}, status=original.status_code)
                if original.has_header('Allow'): response['Allow'] = original['Allow']
            response['Cache-Control'] = 'private, no-store'
        return response
