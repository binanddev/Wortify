class LearningSessionMiddleware:
    def __init__(self,get_response):
        self.get_response=get_response
    def __call__(self,request):
        if not request.path.startswith(('/static/','/admin/')) and not request.session.get('learner'):
            request.session['learner'] = True
            request.session.save()
        return self.get_response(request)
