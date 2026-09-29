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
from practice.models import PracticeProgress, PracticeNode
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
            errors.append({'token':event.get('token'),'error':'; '.join(exc.messages) if isinstance(exc,ValidationError) else 'Nội dung không còn truy cập được.', 'code':'validation' if isinstance(exc,ValidationError) else 'content_unavailable'})
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
    elif kind in ('practice_progress','practice'):
        accessible=get_object_or_404(visible(request),pk=data.get('node'),kind='exercise')
        node=PracticeNode.objects.select_for_update().get(pk=accessible.pk)
        revision=node.updated_at.isoformat()
        if data.get('revision')!=revision:
            result={'outdated':True}
        else:
            if kind=='practice':
                # Translate receipts queued by older clients into progress only.
                rows=grade_payload(node.payload,data.get('answers',{}))['answers']
                completed=[]
                for question in node.payload['questions']:
                    question_rows=[row for row in rows if row['question_position']==question['position']]
                    if question_rows and all(row['correct'] for row in question_rows):completed.append(str(question['id']))
                data={**data,'completed':completed}
            completed=data.get('completed')
            valid={str(q['id']) for q in node.payload['questions'] if not q.get('example')}
            if not isinstance(completed,list) or len(completed)>100 or any(not isinstance(q,str) or q not in valid for q in completed):
                raise ValueError('Tiến độ chứa câu hỏi không hợp lệ.')
            progress,_=PracticeProgress.objects.get_or_create(user=request.user,node=node,defaults={'revision':revision})
            previous=progress.completed if progress.revision==revision else []
            progress.completed=sorted(set(previous+completed),key=int)
            progress.revision=revision
            progress.save()
            result={'completed':progress.completed,'revision':revision}
        # Keep only progress; answer content and scores are never recorded.
        log.payload={key:data[key] for key in ('node','revision','completed') if key in data}
        log.save(update_fields=['payload'])
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
                if type(data.get('correct')) is not bool or data.get('type') not in ('choice','written','truefalse','matching','flash','spell','order','write'):raise ValueError('Lượt học không hợp lệ.')
                correct=data['correct'];p=state.progress.get(key,{'hits':0,'misses':0,'streak':0,'written':False})
                p['hits']=p.get('hits',0)+int(correct);p['misses']=p.get('misses',0)+int(not correct)
                p['streak']=p.get('streak',0)+1 if correct else 0;p['written']=p.get('written',False) or (correct and data['type']=='written')
                p['stage']='mastered' if p['streak']>=3 and (data.get('goal')!='comprehensive' or p['written']) else 'familiar' if p['hits'] else 'new'
                p['lastStudied']=timezone.localtime(parse_datetime(stamp)).date().isoformat();state.progress[key]=p
                progress,_=StudyProgress.objects.get_or_create(user=request.user,card_id=card)
                from cards.services.spaced import review
                review(progress,correct,data['type'],parse_datetime(stamp),data.get('response_ms'),data.get('rating'),state.options.get('srs',{}))
                progress.save()
        elif kind=='options':
            options=data.get('options')
            if not isinstance(options,dict) or len(str(options))>10000:raise ValueError('Tùy chọn không hợp lệ.')
            # FSRS options are validated and owned by the review settings endpoint.
            options.pop('srs',None)
            if 'srs' in state.options:options['srs']=state.options['srs']
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
