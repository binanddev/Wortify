import re
from django.shortcuts import render, get_object_or_404, redirect
from django import forms
from django.db.models import Prefetch
from django.db import transaction
from django.views.decorators.http import require_http_methods, require_POST
from .models import Chapter, Exercise, Attempt, Notification
from django.http import HttpResponse
from django.urls import reverse
from django.utils import timezone
from django.template.loader import render_to_string
from django.db.models import Q
from .grading import normalize


def published():
    return Exercise.objects.filter(reviewed=True).exclude(decision='SKIP')

def home(request):
    chapters = Chapter.objects.prefetch_related(Prefetch('exercise_set',queryset=published(),to_attr='available'))
    history = Attempt.objects.filter(session_key=request.session.session_key or '').select_related('exercise').order_by('-created_at')[:10]
    return render(request,'practice/home.html',{'chapters':chapters,'history':history,'exercise_count':published().count()})

def chapter(request,number):
    chapter=get_object_or_404(Chapter,number=number)
    query=request.GET.get('q','').strip()[:100]
    mode=request.GET.get('mode','')
    qs=published().filter(chapter=chapter)
    if query: qs=qs.filter(Q(title__icontains=query)|Q(objective__icontains=query)|Q(number__iexact=query))
    if mode in ['auto_check','manual_check']:qs=qs.filter(check_mode=mode)
    exercises=list(qs)
    attempts=Attempt.objects.filter(session_key=request.session.session_key or '',exercise__chapter=chapter).order_by('-created_at')
    latest={}
    for attempt in attempts:
        latest.setdefault(attempt.exercise_id,attempt)
    for exercise in exercises:
        exercise.latest=latest.get(exercise.pk)
    return render(request,'practice/chapter.html',{'chapter':chapter,'exercises':exercises,'done':len(latest),'total':published().filter(chapter=chapter).count(),'query':query,'mode':mode})

@require_http_methods(['GET','POST'])
def exercise(request,pk):
    item = get_object_or_404(published(),pk=pk)
    questions = list(item.questions.all())
    form = forms.Form(request.POST if request.method == 'POST' else None)
    descriptors=[]
    blocks=[]
    for q in questions:
        if q.example:
            continue
        parts=[]
        if q.blanks:
            for i,b in enumerate(q.blanks):
                key=f'{q.pk}_{i}'
                form.fields[key]=forms.CharField(max_length=200, label=f'Câu {q.position}, ô {i+1}',widget=forms.TextInput(attrs={'class':'inline-gap','aria-label':f'Câu {q.position}, ô {i+1}','autocomplete':'off','spellcheck':'false'}))
                descriptors.append((key,q,b['answers'],False,f'Ô {i+1}'))
            for part in re.split(r'(\{\{\d+\}\})',q.prompt):
                if re.fullmatch(r'\{\{\d+\}\}',part):
                    idx=int(part[2:-2])-1
                    parts.append({'field':form[f'{q.pk}_{idx}']})
                else:
                    parts.append({'text':part})
        else:
            key=str(q.pk)
            kwargs={'label':q.prompt}
            if q.options and item.kind!='multi':
                field=forms.ChoiceField(choices=[('','— Chọn đáp án —')]+[(x,x) for x in q.options],**kwargs)
            elif item.kind=='multi':
                field=forms.MultipleChoiceField(choices=[(x,x) for x in q.options],widget=forms.CheckboxSelectMultiple,**kwargs)
            else:
                field=forms.CharField(max_length=2000,widget=forms.Textarea(attrs={'rows':2,'spellcheck':'false'}) if item.check_mode!='auto_check' or item.allow_review or item.kind=='wordset' else forms.TextInput(attrs={'autocomplete':'off','spellcheck':'false'}),**kwargs)
            field.widget.attrs['aria-label']=q.prompt
            form.fields[key]=field
            parts=[{'text':q.prompt},{'field':form[key]}]
            descriptors.append((key,q,q.accepted_answers,item.kind in ['multi','wordset'],''))
        blocks.append({'question':q,'parts':parts})
    if request.method == 'POST' and form.is_valid():
        if not request.session.session_key:
            request.session.create()
        answers=[]
        auto=item.check_mode=='auto_check'
        for key,q,expected,multi,suffix in descriptors:
            value=form.cleaned_data[key]
            if multi:
                submitted=value if isinstance(value,list) else [v.strip() for v in re.split(r'[,;\n]',value) if v.strip()]
                matched=(len(submitted)==len(expected) and {normalize(v,item) for v in submitted}=={normalize(v,item) for v in expected})
            else:
                matched=any(normalize(value,item)==normalize(a,item) for a in expected)
            answers.append({'prompt':q.prompt,'question_position':q.position,'label':suffix,'answer':', '.join(value) if isinstance(value,list) else value,'correct':matched if auto else None,'expected':expected})
        attempt=Attempt.objects.create(exercise=item,session_key=request.session.session_key,answers=answers,score=sum(a['correct'] for a in answers) if auto else None,total=len(answers),status='graded' if auto else ('pending_manual' if item.check_mode=='manual_check' else 'pending_ai'))
        if request.headers.get('HX-Request'):
            response=result(request,attempt.pk)
            response['HX-Push-Url']=reverse('result',args=[attempt.pk])
            return response
        return redirect('result',pk=attempt.pk)
    siblings=list(published().filter(chapter=item.chapter).values_list('pk',flat=True))
    index=siblings.index(item.pk)
    return render(request,'practice/exercise.html',{'exercise':item,'form':form,'blocks':blocks,'examples':[q for q in questions if q.example],'next_exercise':siblings[index+1] if index+1<len(siblings) else None,'position':index+1,'chapter_total':len(siblings)})

def result(request,pk):
    attempt=get_object_or_404(Attempt.objects.select_related('exercise'),pk=pk,session_key=request.session.session_key or '')
    groups={}
    for row in attempt.answers:
        key=row.get('question_position',row['prompt'])
        if key not in groups:groups[key]={'prompt':re.sub(r'\{\{\d+\}\}','…',row['prompt']),'answers':[]}
        groups[key]['answers'].append(row)
    return render(request,'practice/result.html',{'attempt':attempt,'groups':list(groups.values())})

@require_POST
def request_review(request,pk):
    attempt=get_object_or_404(Attempt,pk=pk,session_key=request.session.session_key or '',exercise__allow_review=True)
    if attempt.status=='graded':
        attempt.status='pending_manual'
        attempt.save(update_fields=['status'])
    return redirect('result',pk=pk)

@require_POST
def read_notification(request,pk):
    notification=get_object_or_404(Notification,pk=pk,session_key=request.session.session_key or '')
    notification.read_at=timezone.now();notification.save(update_fields=['read_at'])
    if request.headers.get('HX-Request'):
        count=Notification.objects.filter(session_key=request.session.session_key,read_at__isnull=True).count()
        return HttpResponse(f'<span id="notification-count" class="badge" data-count="{count}" hx-swap-oob="outerHTML">{count}</span>')
    return redirect('home')
