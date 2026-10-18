"""Wortify Text v1: a small container around the existing exercise text language."""
import re
from .practice_hub import validate_payload

STYLES = {
    'multiple_choice': ('dialogue_reply', 'elimination'),
    'true_false_not_given': ('evidence_judge',),
    'cloze_drag_drop': ('drag_drop', 'tap_fill'),
    'error_correction': ('click_edit', 'cross_out'),
    'matching': ('tap_match',), 'sentence_building': ('tap_build',),
    'categorization': ('drag_sort',),
    'inline_selection': ('pill_toggle', 'inline_select', 'fall_away'),
    'short_answer': ('partial_input', 'sentence_rewrite'),
    'reading': ('split_reading',),
}
KINDS = {'cloze_drag_drop':'cloze','inline_selection':'cloze','matching':'matching','sentence_building':'order','error_correction':'text','short_answer':'text'}
HEADERS = {'TYPE','STYLE','INSTRUCTIONS','CONTEXT','CONTEXT_FORMAT','GROUPS','BANK_SCOPE','COMMENT','CASE_SENSITIVE','KEEP_PUNCTUATION'}


def parse_lesson(lines):
    title = lines[0][1].split(':', 1)[1].strip()
    payload = dict(title=title, instruction='', ignore_case=True, ignore_punctuation=True, presentation={}, questions=[])
    q = None
    continuation = None
    seen_header = set()
    seen_question = set()
    line = lines[0][0]
    def fail(message): raise ValueError(f'Line {line} ({title}): {message}')
    def items(value):
        values = [v.strip() for v in value.split('|')]
        if not all(values): fail('Empty item between | separators.')
        return values
    for line, raw in lines[1:]:
        s = raw.strip()
        if not s or s.startswith('#'): continue
        if s.startswith('>'):
            if not continuation: fail('Continuation must follow a text field.')
            target, field = continuation
            target[field] += '\n' + s[1:].lstrip()
            continue
        continuation = None
        match = re.fullmatch(r'([A-Z_]+):\s*(.+)', s)
        if not match: fail('Use FIELD: value.')
        key, value = match.groups()
        if key == 'QUESTION':
            q = dict(prompt=value, accepted_answers=[], options=[], blanks=[], presentation={})
            payload['questions'].append(q)
            seen_question = set()
            continuation = (q, 'prompt')
            continue
        header = key in HEADERS
        if header and q is not None: fail('Place lesson metadata before QUESTION.')
        if not header and q is None: fail('Place this field after QUESTION.')
        seen = seen_header if header else seen_question
        if key != 'BLANK' and key in seen: fail(f'Duplicate {key}.')
        seen.add(key)
        ep = payload['presentation']
        if key in ('TYPE','STYLE','BANK_SCOPE','CONTEXT_FORMAT'):
            ep[{'TYPE':'interaction','STYLE':'style','BANK_SCOPE':'bank_scope','CONTEXT_FORMAT':'context_format'}[key]] = value
        elif key in ('INSTRUCTIONS','CONTEXT'):
            field = 'instruction' if key == 'INSTRUCTIONS' else 'context'
            payload[field] = value
            continuation = (payload, field)
        elif key == 'COMMENT': ep['comment'] = value; continuation = (ep, 'comment')
        elif key == 'GROUPS': ep['categories'] = items(value)
        elif key in ('CASE_SENSITIVE','KEEP_PUNCTUATION','EXAMPLE'):
            if value not in ('yes','no'): fail('Use yes or no.')
            if key == 'EXAMPLE': q['example'] = value == 'yes'
            else: payload['ignore_case' if key == 'CASE_SENSITIVE' else 'ignore_punctuation'] = value == 'no'
        elif key in ('ANSWER','OPTIONS'): q['accepted_answers' if key == 'ANSWER' else 'options'] = items(value)
        elif key == 'WORDS': q['presentation']['word_bank'] = items(value)
        elif key == 'PREFIX': q['presentation']['prefix'] = value
        elif key == 'EXPLANATION': q['presentation']['explanation'] = value; continuation = (q['presentation'], 'explanation')
        elif key == 'BLANK':
            parts = value.split('=>')
            if len(parts) > 2: fail('Use at most one => in BLANK.')
            q['blanks'].append({'answers':items(parts[0]),'options':items(parts[1]) if len(parts)==2 else []})
        else: fail(f'Unsupported field {key}.')
    mode = payload['presentation'].get('interaction')
    if mode not in STYLES: fail('Invalid TYPE.')
    p = payload['presentation']
    p.setdefault('style', STYLES[mode][0])
    if p['style'] not in STYLES[mode]: fail('Invalid STYLE for TYPE.')
    payload['kind'] = KINDS.get(mode, 'choice')
    questions = payload['questions']
    if not questions or all(q.get('example') for q in questions): fail('At least one non-example question is required.')
    pairs = [q['accepted_answers'][0] if q['accepted_answers'] else '' for q in questions]
    if mode == 'matching' and len(set(pairs)) != len(pairs): fail('Matching partners must be unique.')
    for q in questions:
        qp = q['presentation']
        if mode == 'sentence_building':
            words = qp.get('word_bank', [])
            qp['tokens'] = [{'id':str(i+1),'text':w} for i,w in enumerate(words)]
            q['accepted_answers'] = [t['id'] for t in qp['tokens']]
        if mode == 'categorization':
            q['options'] = p.get('categories', [])
            if len(set(q['options'])) != len(q['options']) or len(q['options']) < 2: fail('Use at least two unique GROUPS.')
        if mode == 'matching': q['options'] = pairs
        if mode in ('matching','categorization','multiple_choice','true_false_not_given') and len(q['accepted_answers']) != 1: fail('Exactly one ANSWER is required.')
        if mode == 'multiple_choice' and (len(q['options']) < 2 or len(set(q['options'])) != len(q['options'])): fail('Use at least two distinct OPTIONS.')
        if mode not in ('cloze_drag_drop','inline_selection') and q['blanks']: fail('This TYPE does not use BLANK.')
        if mode in ('cloze_drag_drop','inline_selection') and not q['blanks']: fail('BLANK is required.')
        if mode == 'cloze_drag_drop':
            bank = qp.setdefault('word_bank', [b['answers'][0] for b in q['blanks']])
            # Bipartite matching supports overlapping alternatives and repeated tokens.
            assigned = {}
            def place(blank, visited):
                for i, word in enumerate(bank):
                    if i not in visited and word in q['blanks'][blank]['answers']:
                        visited.add(i)
                        if i not in assigned or place(assigned[i], visited):
                            assigned[i] = blank
                            return True
                return False
            if not all(place(i, set()) for i in range(len(q['blanks']))): fail('WORDS cannot fill every gap; repeat tokens when needed.')
        prefix = qp.get('prefix', '')
        if mode == 'short_answer' and p['style']=='partial_input' and not prefix: fail('PREFIX is required.')
        if prefix and any(not a.startswith(prefix) for a in q['accepted_answers']): fail('Each ANSWER must start with PREFIX.')
        if mode == 'error_correction' and p['style']=='cross_out':
            def removed_only(answer):
                words=iter(q['prompt'].split()); target=answer.split()
                return len(target)<len(q['prompt'].split()) and all(any(w==part for w in words) for part in target)
            if not any(removed_only(a) for a in q['accepted_answers']): fail('Cross out must only remove words.')
    try: return validate_payload('exercise', payload)
    except Exception as exc:
        from django.core.exceptions import ValidationError
        if isinstance(exc, (ValueError, ValidationError)): fail(str(exc))
        raise


def parse_package(text):
    document = {'format':'wortify-content','version':1,'practice':[],'reading':[]}
    section = None
    folder = '/'
    level = topic = ''
    block = []
    header_seen = set()
    count = 0
    def flush():
        nonlocal block, count
        if not block: return
        start = block[0][0]
        if not section: raise ValueError(f'Line {start}: SECTION is required.')
        theory = block[0][1].startswith('THEORY:')
        title = block[0][1].split(':',1)[1].strip()
        if theory:
            if section != 'practice': raise ValueError(f'Line {start}: THEORY belongs in practice.')
            content=[]
            for n, raw in block[1:]:
                if not raw.strip() or raw.strip().startswith('#'): continue
                if raw.startswith('CONTENT:') and not content: content.append(raw.split(':',1)[1].lstrip())
                elif raw.lstrip().startswith('>') and content: content.append(raw.lstrip()[1:].lstrip())
                else: raise ValueError(f'Line {n}: Use CONTENT then > continuation lines for theory.')
            if not content: raise ValueError(f'Line {start}: Theory needs CONTENT.')
            payload={'format':'markdown','content':'\n'.join(content)}
        else: payload=parse_lesson(block)
        is_reading = payload.get('presentation',{}).get('interaction') == 'reading'
        if not theory and is_reading != (section=='reading'): raise ValueError(f'Line {start}: TYPE reading must be in SECTION reading; other exercises in practice.')
        parts=[] if folder=='/' else [p.strip() for p in folder.split('/')]
        if len(parts)>10 or any(not p or p in ('.','..') or len(p)>200 for p in parts): raise ValueError(f'Line {start}: Invalid FOLDER path (maximum 10 levels).')
        if not parts and section=='practice' and not theory: raise ValueError(f'Line {start}: Practice exercises require a FOLDER.')
        children=document[section]
        for part in parts:
            node=next((n for n in children if n['kind']=='folder' and n['title'].casefold()==part.casefold()),None)
            if node is None:
                node={'kind':'folder','title':part,'children':[]};children.append(node);count+=1
            children=node['children']
        node={'kind':'theory' if theory else 'reading' if is_reading else 'exercise','title':title,'payload':payload}
        if is_reading: node.update(level=level,topic=topic)
        children.append(node);count+=1
        if count>5000: raise ValueError(f'Line {start}: Maximum 5000 nodes.')
        block=[]
    for number, raw in enumerate(text.lstrip('\ufeff').splitlines(),1):
        s=raw.strip()
        if not s or s.startswith('#'): continue
        key, sep, value=s.partition(':');value=value.strip()
        if key in ('WORTIFY','ID','TITLE','LANGUAGE') and sep:
            if section or block: raise ValueError(f'Line {number}: Package headers must come first.')
            if key in header_seen: raise ValueError(f'Line {number}: Duplicate {key}.')
            header_seen.add(key)
            if key=='WORTIFY':
                if value!='1': raise ValueError(f'Line {number}: Use WORTIFY: 1.')
            else: document[{'ID':'id','TITLE':'title','LANGUAGE':'language'}[key]]=value
        elif key in ('SECTION','FOLDER','LEVEL','TOPIC') and sep:
            flush()
            if key=='SECTION':
                if value not in ('practice','reading'): raise ValueError(f'Line {number}: SECTION must be practice or reading.')
                section=value;folder='/';level=topic=''
            elif not section: raise ValueError(f'Line {number}: SECTION is required first.')
            elif key=='FOLDER': folder=value
            elif key=='LEVEL': level='' if value=='-' else value
            else: topic='' if value=='-' else value
        elif key in ('EXERCISE','THEORY') and sep:
            flush();block=[(number,s)]
        elif block: block.append((number,s))
        else: raise ValueError(f'Line {number}: Unexpected field; start a lesson with EXERCISE or THEORY.')
    flush()
    if header_seen != {'WORTIFY','ID','TITLE','LANGUAGE'}: raise ValueError('Required headers: WORTIFY, ID, TITLE, LANGUAGE.')
    return document
