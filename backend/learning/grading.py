import re
from django.core.exceptions import ValidationError
from practice.grading import normalize

def grade(exercise, submitted):
    if not isinstance(submitted, dict):
        raise ValidationError('Câu trả lời phải là một đối tượng.')
    results = []
    for q in exercise.questions.all():
        if q.example:
            continue
        kind = q.kind or exercise.kind
        auto = not q.presentation.get('manual', exercise.check_mode != 'auto_check')
        descriptors = [(f'{q.pk}_{i}', b['answers'], f'Ô {i+1}') for i, b in enumerate(q.blanks)] if q.blanks else [(str(q.pk), q.accepted_answers, '')]
        for key, expected, label in descriptors:
            value = submitted.get(key, '')
            if kind == 'order' and not q.blanks:
                tokens={t['id']:t['text'] for t in q.presentation.get('tokens',[])}
                if not isinstance(value,list) or not all(isinstance(v,str) for v in value) or len(value)!=len(tokens) or set(value)!=set(tokens):
                    raise ValidationError('Hãy sử dụng mỗi từ đúng một lần.')
                results.append({'prompt':q.prompt,'question_position':q.position,'key':str(q.pk),'label':'','answer':' '.join(tokens[v] for v in value),'correct':value==expected if auto else None,'expected':[' '.join(tokens[v] for v in expected)] if auto else []})
                continue
            multi = not q.blanks and kind in ['multi', 'wordset']
            if kind == 'multi' and not q.blanks:
                if not isinstance(value, list) or not all(isinstance(v, str) and v in q.options for v in value):
                    raise ValidationError('Lựa chọn không hợp lệ.')
            elif not isinstance(value, str) or not value.strip() or len(value) > 2000:
                raise ValidationError('Hãy điền đủ câu trả lời, tối đa 2000 ký tự mỗi câu.')
            if q.options and kind != 'multi' and not q.blanks and value not in q.options:
                raise ValidationError('Lựa chọn không hợp lệ.')
            if multi:
                values = value if isinstance(value, list) else [v.strip() for v in re.split(r'[,;\n]', value) if v.strip()]
                if not values:
                    raise ValidationError('Hãy chọn ít nhất một đáp án.')
                matched = len(values) == len(expected) and {normalize(v, exercise) for v in values} == {normalize(v, exercise) for v in expected}
            else:
                matched = any(normalize(value, exercise) == normalize(a, exercise) for a in expected)
            results.append({'prompt': q.prompt, 'question_position': q.position, 'key':key,'label': label, 'answer': ', '.join(value) if isinstance(value, list) else value, 'correct': matched if auto else None, 'expected': expected if auto else []})
    if not results:
        raise ValidationError('Bài chưa có câu hỏi để chấm.')
    return results
