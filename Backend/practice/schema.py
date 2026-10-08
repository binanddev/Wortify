import re
from django.core.exceptions import ValidationError
from types import SimpleNamespace
MODES={'error_correction':'text','cloze_drag_drop':'cloze','inline_selection':'cloze','inline_error_identification':'multi','short_answer':'text','sentence_building':'order','multiple_choice':'choice','categorization':'choice','audio_dictation':'text','matching':'matching','true_false_not_given':'choice'}

def validate_presentation(q,mode):
    p=q.presentation
    if not isinstance(p,dict):raise ValidationError('presentation must be an object.')
    if mode in ('sentence_building','inline_error_identification'):
        tokens=p.get('tokens',[])
        if not isinstance(tokens,list) or not tokens or any(not isinstance(t,dict) or not isinstance(t.get('id'),str) or not isinstance(t.get('text'),str) or not t['text'].strip() for t in tokens):raise ValidationError('Word tokens require an id and text.')
        ids=[t['id'] for t in tokens]
        if len(ids)!=len(set(ids)) or not set(q.accepted_answers).issubset(ids):raise ValidationError('Invalid word token IDs or answers.')
        if len(q.accepted_answers)!=len(set(q.accepted_answers)):raise ValidationError('Answer IDs must not repeat.')
    if mode=='inline_selection':
        for b in q.blanks:
            opts=b.get('options',[])
            if not isinstance(opts,list) or len(opts)<2 or not all(isinstance(x,str) and x for x in opts) or any(a not in opts for a in b['answers']):raise ValidationError('Each selection gap requires at least two options including its answer.')
    if mode=='audio_dictation':
        audio=p.get('audio','')
        if not isinstance(audio,str) or not audio or (':' in audio and not audio.startswith(('https://','http://','data:audio/'))):raise ValidationError('Add a valid audio URL or file.')
    if mode=='true_false_not_given' and (q.options!=['TRUE','FALSE','NOT_GIVEN'] or len(q.accepted_answers)!=1):raise ValidationError('Reading answers must be TRUE, FALSE or NOT_GIVEN.')


def validate_question(self):
    import re
    if not isinstance(self.options,list) or not all(isinstance(x,str) for x in self.options):
        raise ValidationError('Options must be a list of strings.')
    if self.blanks:
        if not isinstance(self.blanks,list):
            raise ValidationError('Blanks must be a list.')
        for blank in self.blanks:
            if not isinstance(blank,dict) or not isinstance(blank.get('answers'),list) or not blank['answers'] or not all(isinstance(a,str) and a.strip() for a in blank['answers']):
                raise ValidationError('Each gap requires a nonempty answer list.')
        if sorted(int(i) for i in re.findall(r'\{\{(\d+)\}\}',self.prompt)) != list(range(1,len(self.blanks)+1)):
            raise ValidationError('Gap markers must match 1…n, with each appearing once.')
    if not isinstance(self.accepted_answers,list) or not all(isinstance(x,str) and x.strip() for x in self.accepted_answers):
        raise ValidationError('Answers must be a list of strings.')
    if self.exercise.check_mode == 'auto_check' and not self.accepted_answers and not self.blanks:
        raise ValidationError('Automatically graded exercises require answers.')
    if (self.options or self.exercise.kind in ['choice','multi']) and not self.example and (not self.options or any(a not in self.options for a in self.accepted_answers)):
        raise ValidationError('The answer must be one of the options.')
