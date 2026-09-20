import json
from functools import wraps
from django.core.exceptions import ValidationError
from django.http import JsonResponse, Http404, QueryDict
from django.shortcuts import get_object_or_404

def namespace(view):
    @wraps(view)
    def scoped(request, language, *args, **kwargs):
        if language not in ('de', 'en'):
            return JsonResponse({'error': 'Không gian không tồn tại.'}, status=404)
        request.language = language
        return view(request, *args, **kwargs)
    return scoped

def body(request):
    try:
        data = json.loads(request.body or b'{}')
    except (ValueError, UnicodeDecodeError):
        raise ValueError('JSON không hợp lệ.')
    if not isinstance(data, dict):
        raise ValueError('JSON phải là một đối tượng.')
    return data

def endpoint(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({'error': 'Vui lòng đăng nhập.'}, status=401)
        try:
            return view(request, *args, **kwargs)
        except Http404:
            return JsonResponse({'error': 'Không tìm thấy nội dung.'}, status=404)
        except (ValueError, TypeError, ValidationError) as exc:
            return JsonResponse({'error': '; '.join(exc.messages) if isinstance(exc, ValidationError) else str(exc)}, status=400)
    return wrapped

def legacy_json(view):
    @endpoint
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if request.content_type == 'application/json':
            post = QueryDict('', mutable=True)
            for key, value in body(request).items():
                post[key] = json.dumps(value, ensure_ascii=False) if isinstance(value, (list, dict)) else str(value)
            request.POST = post
        from cards.models import Deck, Card, StudyAttempt, MatchRound, CardAudio, StudySession
        name = view.__name__
        language = request.language
        if name == 'next_question' and request.POST.get('deck'):
            get_object_or_404(Deck, pk=request.POST['deck'], owner=request.user, language=language)
        elif name in ('match_new', 'export_deck'):
            get_object_or_404(Deck, pk=kwargs['pk'], owner=request.user, language=language)
        elif name == 'card_audio':
            get_object_or_404(Card, pk=kwargs['pk'], deck__owner=request.user, deck__language=language)
        elif name == 'tts_file':
            get_object_or_404(CardAudio, pk=kwargs['pk'], card__deck__owner=request.user, card__deck__language=language)
        elif name == 'match_submit':
            get_object_or_404(MatchRound, token=kwargs['token'], deck__owner=request.user, deck__language=language)
        elif 'token' in kwargs:
            if any(str(kwargs['token']) in tokens for tokens in StudySession.objects.filter(user=request.user,kind='test').values_list('tokens',flat=True)):
                raise ValueError('Bài kiểm tra chỉ trả kết quả tại màn hình nộp toàn bài.')
            get_object_or_404(StudyAttempt, token=kwargs['token'], user=request.user, card__deck__language=language)
        return view(request, *args, **kwargs)
    return wrapped
