import re
from django.core.exceptions import ValidationError
from types import SimpleNamespace
MODES={'cloze_drag_drop':'cloze','inline_selection':'cloze','inline_error_identification':'multi','short_answer':'text','sentence_building':'order','multiple_choice':'choice','categorization':'choice','audio_dictation':'text','matching':'matching','true_false_not_given':'choice'}

def validate_presentation(q,mode):
    p=q.presentation
    if not isinstance(p,dict):raise ValidationError('presentation phải là đối tượng.')
    if mode in ('sentence_building','inline_error_identification'):
        tokens=p.get('tokens',[])
        if not isinstance(tokens,list) or not tokens or any(not isinstance(t,dict) or not isinstance(t.get('id'),str) or not isinstance(t.get('text'),str) or not t['text'].strip() for t in tokens):raise ValidationError('Các mảnh từ cần id và nội dung.')
        ids=[t['id'] for t in tokens]
        if len(ids)!=len(set(ids)) or not set(q.accepted_answers).issubset(ids):raise ValidationError('Mã mảnh từ hoặc đáp án không hợp lệ.')
        if len(q.accepted_answers)!=len(set(q.accepted_answers)):raise ValidationError('Không lặp mã trong đáp án.')
    if mode=='inline_selection':
        for b in q.blanks:
            opts=b.get('options',[])
            if not isinstance(opts,list) or len(opts)<2 or not all(isinstance(x,str) and x for x in opts) or any(a not in opts for a in b['answers']):raise ValidationError('Mỗi ô chọn cần ít nhất hai lựa chọn và đáp án nằm trong đó.')
    if mode=='audio_dictation':
        audio=p.get('audio','')
        if not isinstance(audio,str) or not audio or (':' in audio and not audio.startswith(('https://','http://','data:audio/'))):raise ValidationError('Thêm URL hoặc tệp âm thanh hợp lệ.')
    if mode=='true_false_not_given' and (q.options!=['TRUE','FALSE','NOT_GIVEN'] or len(q.accepted_answers)!=1):raise ValidationError('Đáp án đọc hiểu phải là TRUE, FALSE hoặc NOT_GIVEN.')


def validate_question(self):
    import re
    if not isinstance(self.options,list) or not all(isinstance(x,str) for x in self.options):
        raise ValidationError('Lựa chọn phải là danh sách chuỗi.')
    if self.blanks:
        if not isinstance(self.blanks,list):
            raise ValidationError('Các ô trống phải là danh sách.')
        for blank in self.blanks:
            if not isinstance(blank,dict) or not isinstance(blank.get('answers'),list) or not blank['answers'] or not all(isinstance(a,str) and a.strip() for a in blank['answers']):
                raise ValidationError('Mỗi ô trống cần danh sách đáp án không rỗng.')
        if sorted(int(i) for i in re.findall(r'\{\{(\d+)\}\}',self.prompt)) != list(range(1,len(self.blanks)+1)):
            raise ValidationError('Ký hiệu ô trống phải khớp 1…n, mỗi ô xuất hiện một lần.')
    if not isinstance(self.accepted_answers,list) or not all(isinstance(x,str) and x.strip() for x in self.accepted_answers):
        raise ValidationError('Đáp án phải là danh sách chuỗi.')
    if self.exercise.check_mode == 'auto_check' and not self.accepted_answers and not self.blanks:
        raise ValidationError('Bài tự chấm phải có đáp án.')
    if (self.options or self.exercise.kind in ['choice','multi']) and not self.example and (not self.options or any(a not in self.options for a in self.accepted_answers)):
        raise ValidationError('Đáp án phải nằm trong các lựa chọn.')
