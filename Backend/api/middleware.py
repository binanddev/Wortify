from django.http import JsonResponse

class PrivateResponsesMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith('/api/'):
            if response.status_code >= 400 and response.get('Content-Type', '').startswith('text/html'):
                original = response
                messages = {400:'Invalid request.',403:'You do not have access.',404:'API endpoint not found.',405:'Method not supported.'}
                response = JsonResponse({'error':messages.get(original.status_code,'The server could not process this request.')}, status=original.status_code)
                if original.has_header('Allow'): response['Allow'] = original['Allow']
            response['Cache-Control'] = 'private, no-store'
        return response
