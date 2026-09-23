"""Idempotent batch writes; learner interaction never waits for this endpoint."""
import uuid
from datetime import timedelta
from types import SimpleNamespace
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.views.decorators.http import require_http_methods
from cards.models import Deck, DeckLearningState, LearningEvent, StudyProgress
from practice.models import PracticeAttempt
from learning.grading import grade
from .common import endpoint, body
from .practice_hub import visible


def state_payload(state):
    return {'options':state.options, 'progress':state.progress,
            'stars':[int(k) for k,v in state.stars.items() if v['value']]}


@endpoint
@require_http_methods(['GET'])
def deck_state(request, pk):
    deck=get_object_or_404(Deck,pk=pk,owner=request.user,language=request.language)
    state,_=DeckLearningState.objects.get_or_create(user=request.user,deck=deck)
    return JsonResponse(state_payload(state))


def grade_payload(payload, submitted):
    questions=[SimpleNamespace(**{**q,'pk':q['id']}) for q in payload['questions']]
    exercise=SimpleNamespace(**{**payload,'ignore_case':payload.get('ignore_case',True),
        'ignore_punctuation':payload.get('ignore_punctuation',True),
        'questions':SimpleNamespace(all=lambda:questions)})
    rows=grade(exercise,submitted)
    return {'score':sum(r['correct'] for r in rows),'total':len(rows),'answers':rows}


@endpoint
@require_http_methods(['POST'])
def sync(request):
    events=body(request).get('events')
    if not isinstance(events,list) or not 1<=len(events)<=100:
        raise ValueError('Gửi 1–100 thay đổi mỗi đợt.')
    accepted=[];errors=[]
    for event in events:
        try:
            with transaction.atomic():
                result=apply_event(request,event)
            accepted.append({'token':event['token'],'result':result})
        except (ValueError,TypeError,KeyError) as exc:
            errors.append({'token':event.get('token') if isinstance(event,dict) else None,'error':str(exc)})
        except Exception as exc:
            from django.core.exceptions import ValidationError
            from django.http import Http404
            if not isinstance(exc,(ValidationError,Http404)):raise
            errors.append({'token':event.get('token'),'error':'; '.join(exc.messages) if isinstance(exc,ValidationError) else 'Nội dung không còn truy cập được.'})
    return JsonResponse({'accepted':accepted,'errors':errors})


def apply_event(request,event):
    if not isinstance(event,dict):raise ValueError('Thay đổi không hợp lệ.')
    token=uuid.UUID(event['token']);kind=event['kind'];data=event['payload']
    if not isinstance(data,dict):raise ValueError('payload phải là đối tượng.')
    log,created=LearningEvent.objects.get_or_create(token=token,defaults={
        'user':request.user,'language':request.language,'kind':kind,'payload':data})
    if log.user_id!=request.user.pk or log.language!=request.language:raise ValueError('Mã đồng bộ không hợp lệ.')
    if not created:return log.result
    if kind=='preferences':
        from users.models import Profile
        from users.preferences import validate_preferences
        changes=validate_preferences(data)
        profile,_=Profile.objects.get_or_create(user=request.user)
        profile=Profile.objects.select_for_update().get(pk=profile.pk)
        stamp=parse_datetime(event.get('at',''))
        if not stamp or timezone.is_naive(stamp):raise ValueError('Thời gian không hợp lệ.')
        stamp=min(stamp,timezone.now()).isoformat()
        for key,value in changes.items():
            if stamp>=profile.preferences_at.get(key,''):
                profile.preferences[key]=value;profile.preferences_at[key]=stamp
        profile.save(update_fields=['preferences','preferences_at'])
        result={'preferences':profile.preferences}
    elif kind=='study_settings':
        from cards.models import StudySettings
        from cards.forms import SettingsForm
        from django.forms.models import model_to_dict
        settings,_=StudySettings.objects.get_or_create(user=request.user,language=request.language)
        form=SettingsForm({**model_to_dict(settings),**data},instance=settings)
        if not form.is_valid():raise ValueError(form.errors.as_text())
        form.save();result={'saved':True}
    elif kind=='practice':
        node=get_object_or_404(visible(request),pk=data.get('node'),kind='exercise')
        if data.get('revision')!=node.updated_at.isoformat():
            raise ValueError('Bài đã được sửa. Mở lại bài và nộp theo nội dung mới; bản cũ vẫn ở thiết bị.')
        result=grade_payload(node.payload,data.get('answers',{}))
        attempt=PracticeAttempt.objects.create(user=request.user,node=node,token=token,answers=data['answers'],result=result)
        result={**result,'id':attempt.pk}
    else:
        deck=get_object_or_404(Deck,pk=data.get('deck'),owner=request.user,language=request.language)
        state,_=DeckLearningState.objects.get_or_create(user=request.user,deck=deck)
        state=DeckLearningState.objects.select_for_update().get(pk=state.pk)
        stamp=parse_datetime(event.get('at',''))
        if not stamp or timezone.is_naive(stamp):raise ValueError('Thời gian thay đổi không hợp lệ.')
        stamp=min(stamp,timezone.now()).isoformat()
        card_ids=set(deck.cards.values_list('id',flat=True))
        if kind=='reset':
            state.progress={}
            StudyProgress.objects.filter(user=request.user,card__deck=deck).delete()
            state.save(update_fields=['progress'])
            result={'reset':True}
        elif kind in ('star','review'):
            card=int(data['card'])
            if card not in card_ids:raise ValueError('Thẻ không thuộc bộ này.')
            key=str(card)
            if kind=='star':
                if type(data.get('value')) is not bool:raise ValueError('Trạng thái sao không hợp lệ.')
                if stamp>=state.stars.get(key,{}).get('at',''):state.stars[key]={'value':data['value'],'at':stamp}
            else:
                if type(data.get('correct')) is not bool or data.get('type') not in ('choice','written','truefalse'):raise ValueError('Lượt học không hợp lệ.')
                correct=data['correct'];p=state.progress.get(key,{'hits':0,'misses':0,'streak':0,'written':False})
                p['hits']=p.get('hits',0)+int(correct);p['misses']=p.get('misses',0)+int(not correct)
                p['streak']=p.get('streak',0)+1 if correct else 0;p['written']=p.get('written',False) or (correct and data['type']=='written')
                p['stage']='mastered' if p['streak']>=3 and (data.get('goal')!='comprehensive' or p['written']) else 'familiar' if p['hits'] else 'new'
                p['lastStudied']=timezone.localtime(parse_datetime(stamp)).date().isoformat();state.progress[key]=p
                progress,_=StudyProgress.objects.get_or_create(user=request.user,card_id=card)
                progress.correct_count+=int(correct);progress.incorrect_count+=int(not correct)
                progress.state='mastered' if p['stage']=='mastered' else 'learning' if correct else 'weak'
                progress.interval_days=min(30,2**min(p['streak']-2,5)) if p['stage']=='mastered' else 0
                progress.due_at=timezone.now()+timedelta(days=progress.interval_days,minutes=0 if progress.interval_days else 10 if correct else 1)
                progress.repetition_count+=1;progress.lapse_count+=int(not correct)
                progress.last_reviewed_at=timezone.now();progress.last_mode='learn';progress.save()
        elif kind=='options':
            options=data.get('options')
            if not isinstance(options,dict) or len(str(options))>10000:raise ValueError('Tùy chọn không hợp lệ.')
            if stamp>=state.options_at:state.options=options;state.options_at=stamp
        elif kind=='test':
            results=data.get('results')
            if not isinstance(results,list) or not results or len(results)>len(card_ids) or any(type(x) is not bool for x in results):raise ValueError('Kết quả bài kiểm tra không hợp lệ.')
            result={'correct':sum(results),'total':len(results),'deck':deck.pk,'title':deck.title}
        else:raise ValueError('Loại đồng bộ không hợp lệ.')
        state.save()
        if kind!='test':result={'saved':True,'deck':deck.pk}
    log.result=result;log.save(update_fields=['result'])
    return result
