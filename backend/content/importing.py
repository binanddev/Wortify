"""Normalize chapter JSON once on the server; never ship answer keys to the learner."""
import json
import re
from pathlib import Path, PurePosixPath
from django.conf import settings
from django.db import transaction
from django.utils.text import slugify
from content.models import Book
from practice.models import Chapter, Exercise, Question

BOOK_ROOT = settings.BASE_DIR.parent / 'book'
SUPPORTED = {'matching','fill_blank','word_formation','rewrite','free_text','single_choice','reading','ordering','correction','multiple_choice','other','table_completion','sentence_completion','transformation','text','choice','multi','cloze','writing','wordset','order'}

def strings(value):
    if value is None: return []
    if isinstance(value, (str,int,float)): return [str(value)] if str(value).strip() else []
    if isinstance(value,list) and all(isinstance(v,(str,int,float)) for v in value): return [str(v) for v in value if str(v).strip()]
    raise ValueError('Đáp án phải là chuỗi hoặc danh sách chuỗi.')

def asset_key(value):
    if not isinstance(value,str) or not value or len(value)>240 or '\\' in value or ':' in value: raise ValueError('Đường dẫn tài nguyên không hợp lệ.')
    p=PurePosixPath(value)
    if p.is_absolute() or '..' in p.parts or '.' in p.parts: raise ValueError('Đường dẫn tài nguyên không hợp lệ.')
    return str(p)

def resources(data):
    rows=[]
    for key,kind in [('image','image'),('audio','audio')]:
        value=data.get(key)
        if isinstance(value,str) and value: rows.append({'type':kind,'file':asset_key(value)})
    for r in data.get('resources') or []:
        if isinstance(r,dict) and r.get('type') in ['image','audio'] and r.get('file'):
            rows.append({'type':r['type'],'file':asset_key(r['file']),'description':str(r.get('description',''))[:300]})
    return rows

def options_for(raw):
    options=[];mapping={}
    if raw is not None and not isinstance(raw,list):raise ValueError('options phải là danh sách.')
    for opt in raw or []:
        if isinstance(opt,dict):
            text=str(opt.get('text',''));key=str(opt.get('id',text))
        else:
            text=str(opt);match=re.match(r'^([a-zA-Z])(?:[.\)]|\s)\s*(.+)',text);key=match[1] if match else text
        if text not in options:options.append(text)
        mapping[key]=text;mapping[text]=text
    return options,mapping

def normalize(source):
    from .schema import classify
    if not isinstance(source,dict) or not isinstance(source.get('items',[]),list):raise ValueError('Bài tập phải có danh sách items.')
    if any(not isinstance(i,dict) for i in source.get('items',[])):raise ValueError('Mỗi item phải là một đối tượng.')
    if not isinstance(source.get('grading',{}),dict):raise ValueError('grading phải là đối tượng.')
    layout,unknown=classify(source);typ=source.get('type','text');warnings=[]
    if unknown:warnings.append(f'Chưa nhận diện type "{typ}". Chọn loại bài trong quản trị; bài được lưu nháp.')
    items=source.get('items',[])
    columns=source.get('columns',[])
    if typ=='table_completion' or ('table' in str(source.get('instruction','')).lower() and layout=='cloze'):
        sizes={len(i.get('blanks') or []) for i in items}
        if not columns and len(sizes)==1 and sizes and min(sizes)>0:
            columns=['Đề mục']+[f'Ô {i+1}' for i in range(next(iter(sizes)))]
            layout='table'
            items=[{**i,'type':'table','cells':[str(i.get('text',i.get('question','')))]+['{{'+str(j+1)+'}}' for j in range(len(i['blanks']))]} for i in items]
    if typ=='ordering' and items and all(type(i.get('answer')) is int for i in items):
        indices=sorted(range(len(items)),key=lambda i:items[i]['answer'])
        items=[{'text':source.get('instruction',''),'tokens':[{'id':str(i),'text':r.get('text',r.get('question',''))} for i,r in enumerate(items)],'answer':[str(i) for i in indices]}]
    marker=r'\{\{\d+\}\}|_{2,}|\.{3,}|…'
    passage=source.get('passage') or source.get('content') or ''
    # Legacy passage + one answer per item: put inputs back into their context.
    if layout=='cloze' and isinstance(passage,str) and len(re.findall(marker,passage))==len(items) and items and all(strings(i.get('answer')) for i in items):
        items=[{'text':passage,'blanks':[{'answer':i['answer']} for i in items]}]
        passage_inline=True
    else:passage_inline=False
    shared=source.get('options') or []
    if layout=='matching' and not shared:
        shared=next((i.get('options') for i in items if i.get('options')),[])
        if not shared:
            candidates=[i.get('answer') for i in items]
            if candidates and all(isinstance(v,str) and v for v in candidates):shared=sorted(set(candidates))
    rows=[];needs_review=unknown
    for position,item in enumerate(items,1):
        item_layout,item_unknown=classify({'type':item.get('type',typ),'items':[item]})
        if item_unknown:needs_review=True
        manual=item_layout=='writing' or unknown or item_unknown or source.get('grading',{}).get('mode')=='manual'
        prompt=str(item.get('text',item.get('question','')) or '')
        cells=item.get('cells',[])
        if item_layout=='table' and cells:
            if not isinstance(cells,list) or any(not isinstance(v,str) for v in cells):raise ValueError('cells phải là danh sách văn bản.')
            prompt=' | '.join(cells)
        raw_blanks=item.get('blanks') or []
        if not isinstance(raw_blanks,list):raise ValueError('blanks phải là danh sách.')
        raw_blanks=[{'answer':b} if isinstance(b,str) else b for b in raw_blanks]
        if any(not isinstance(b,dict) for b in raw_blanks):raise ValueError('Mỗi blank cần đối tượng có answer.')
        try:expected=strings(item.get('answer'))
        except ValueError:expected=[];manual=True;warnings.append(f'Câu {position}: đáp án đặc biệt, cần kiểm tra.')
        if len(raw_blanks)==1:expected=strings(raw_blanks[0].get('answer'))
        opts,mapping=options_for(item.get('options') or (shared if item_layout in ['choice','multi','matching'] else []))
        expected=[mapping.get(v,v) for v in expected]
        example=item.get('example') is True
        blanks=[];count=len(re.findall(marker,prompt))
        filled=re.fullmatch(r'(.*?)\.{3,}\s*(.*?)\s*\.{3,}(.*)',prompt,re.S)
        if item_layout=='cloze' and filled and filled[2].strip() in expected:
            example=True;prompt=filled[1]+filled[2]+filled[3];raw_blanks=[];count=0
        if item_layout in ['cloze','table'] and not example:
            if not raw_blanks and count==1 and expected:raw_blanks=[{'answer':expected}]
            if raw_blanks:
                blanks=[{'answers':strings(b.get('answer'))} for b in raw_blanks]
                if any(not b['answers'] for b in blanks):manual=True
                if count==len(blanks):
                    indices=iter(range(1,len(blanks)+1));prompt=re.sub(marker,lambda m:'{{'+str(next(indices))+'}}',prompt)
                elif count==0:
                    # Legacy word-formation rows have a prompt and several named answer slots.
                    prompt+=' '+ ' '.join('{{'+str(i+1)+'}}' for i in range(len(blanks)))
                    if item_layout=='table' and not cells:item_layout='cloze'
                else:
                    warnings.append(f'Câu {position}: số vị trí trống không khớp đáp án; cần sửa bố cục.');needs_review=True
            elif count:
                # Never guess how to split a full sentence answer across several holes.
                warnings.append(f'Câu {position}: cần blanks riêng cho {count} ô; hiện chưa đủ thông tin.');needs_review=True;manual=True
            else:item_layout='text'
        if item_layout in ['choice','multi','matching'] and (not opts or not expected or any(v not in opts for v in expected)):
            warnings.append(f'Câu {position}: đáp án không khớp lựa chọn; kiểm tra trong quản trị.');manual=True
            if not opts:item_layout='text'
        if item_layout=='matching' and len(expected)!=1:
            warnings.append(f'Câu {position}: mỗi cặp nối cần đúng một đáp án.');needs_review=True
        if item_layout=='table' and (not columns or not cells or len(cells)!=len(columns)):
            warnings.append(f'Câu {position}: bảng cần columns và cells cùng số cột.');needs_review=True
        if not expected and not blanks and not example:
            manual=True
            if item_layout!='writing':warnings.append(f'Câu {position}: chưa có đáp án cố định.')
        if len(expected)>1 and typ in ['correction','word_formation'] and not opts:
            warnings.append(f'Câu {position}: kiểm tra đáp án là các phương án thay thế hay nhiều phần.');manual=True
        rows.append({'kind':item_layout,'position':position,'prompt':prompt,'options':opts,'accepted_answers':expected,'blanks':blanks,'example':example,'presentation':{'manual':manual,'tokens':item.get('tokens',[]) if item_layout=='order' else [],'cells':cells,'resources':resources(item),'hint':item.get('example') if isinstance(item.get('example'),str) else '', 'source_item':str(item.get('id',item.get('item_number',position)))}})
    manual=any(q['presentation']['manual'] for q in rows)
    return {'kind':'multi' if layout=='multi' else 'wordset' if layout=='wordset' else 'text','check_mode':'manual_check' if manual else 'auto_check','rows':rows,'warnings':warnings,'source_type':str(typ)[:40],'needs_review':needs_review,'presentation':{'type':layout,'columns':columns,'inline_passage':passage_inline,'version':2}}

@transaction.atomic
def save_exercise(chapter,source,existing=None):
    normalized=normalize(source)
    key=str(source.get('id') or f'{chapter.number}-{source.get("number","")}')
    if not key or len(key)>100:raise ValueError('Mã bài không hợp lệ.')
    item=existing or Exercise.objects.filter(chapter=chapter,source_id=key).first()
    if item and item.source_document==source and not existing and item.presentation.get('version')==2:return item,False
    if item is None:item=Exercise(chapter=chapter,number=key)
    item.source_id=key;item.source_document=source;item.source_type=normalized['source_type'];item.import_warnings=normalized['warnings'];item.presentation=normalized['presentation']
    item.title=str(source.get('title') or source.get('instruction') or key)[:200]
    item.instruction=str(source.get('instruction') or '')
    item.context='' if normalized['presentation']['inline_passage'] else str(source.get('passage') or source.get('content') or '')
    notes=source.get('notes') or []
    item.hints='\n'.join(str(v) for v in notes) if isinstance(notes,list) else str(notes)
    if source.get('options') and normalized['source_type'] not in ['single_choice','multiple_choice','matching']:
        item.hints+='\nTừ gợi ý: '+' · '.join(options_for(source['options'])[0])
    provenance=source.get('source') or {}
    if not isinstance(provenance,dict):raise ValueError('source phải là đối tượng.')
    pages=provenance.get('pages') or [0]
    if not isinstance(pages,list) or any(type(p) is not int or p<0 or p>65535 for p in pages):raise ValueError('source.pages phải là danh sách số trang từ 0 đến 65535.')
    item.source_page=pages[0]
    item.decision='DIGITIZE';item.rationale='Nhập từ JSON; chuẩn hóa phía máy chủ.'
    item.objective=item.instruction or 'Luyện tập';item.cefr=chapter.book.level or 'Không phân cấp';item.kind=normalized['kind'];item.ignore_case=bool((source.get('grading') or {}).get('ignore_case',False));item.ignore_punctuation=bool((source.get('grading') or {}).get('ignore_punctuation',False));item.check_mode=normalized['check_mode'];item.reviewed=not normalized['needs_review'];item.allow_review=False
    item.full_clean();item.save()
    # Preserve Attempt snapshots; questions are only the current editable content.
    item.questions.all().delete()
    Question.objects.bulk_create([Question(exercise=item,**row) for row in normalized['rows']])
    return item,True

def catalog():
    return [{'directory':str(p.relative_to(BOOK_ROOT)).replace('\\','/'),'title':p.name,'language':p.parent.name.lower(),'files':len(list(p.glob('*.json')))} for p in sorted(BOOK_ROOT.glob('*/*')) if p.is_dir() and p.parent.name.lower() in ['en','de']]

@transaction.atomic
def import_book(directory):
    relative=asset_key(directory);folder=(BOOK_ROOT/relative).resolve()
    if not folder.is_relative_to(BOOK_ROOT.resolve()) or not folder.is_dir():raise ValueError('Không tìm thấy thư mục sách.')
    language=folder.parent.name.lower()
    if language not in ['en','de']:raise ValueError('Thư mục sách cần nằm trong EN hoặc DE.')
    files=sorted(folder.glob('*.json'))
    if not files:raise ValueError('Thư mục chưa có JSON.')
    documents=[]
    for path in files:
        if path.stat().st_size>5*1024*1024:raise ValueError('JSON quá lớn.')
        doc=json.loads(path.read_text(encoding='utf-8-sig'))
        if not isinstance(doc,dict):raise ValueError(f'{path.name}: JSON phải là đối tượng.')
        documents.append((path,doc))
    metadata=documents[0][1].get('book') or {}
    if metadata.get('language',language)!=language:raise ValueError('Ngôn ngữ JSON không khớp thư mục.')
    title=metadata.get('title',folder.name)
    book=Book.objects.filter(source_directory=relative).first()
    if not book and language=='de' and metadata.get('level')=='A2' and 'Netzwerk' in title:
        book=Book.objects.filter(language='de',title__icontains='Netzwerk',level='A2').first()
    if not book:book=Book(slug=slugify(title)[:45]+'-'+language)
    book.title=title;book.language=language;book.level=metadata.get('level','');book.source_directory=relative;book.save()
    counts={'book':book.pk,'title':book.title,'chapters':0,'exercises':0,'updated':0,'manual':0,'warnings':[]}
    chapter_seen={}
    for path,doc in documents:
        chapter_data=doc.get('chapter') or doc
        chapter_number=int(chapter_data.get('number',0))
        if chapter_number<1:raise ValueError(f'{path.name}: thiếu số chương.')
        chapter,_=Chapter.objects.update_or_create(book=book,number=chapter_number,defaults={'title':str(chapter_data.get('title',path.stem))[:150],'page_start':0,'theory':{**(doc.get('theory') or {}),'examples':doc.get('examples') or [],'resources':resources(doc)}})
        seen=chapter_seen.setdefault(chapter.pk,set())
        for source in doc.get('exercises',[]):
            item,changed=save_exercise(chapter,source);seen.add(item.pk);counts['exercises']+=1;counts['updated']+=changed;counts['manual']+=item.check_mode!='auto_check'
            counts['warnings'] += [f'{path.name} / {item.source_id}: {w}' for w in item.import_warnings]
    for chapter_id,seen in chapter_seen.items():
        Exercise.objects.filter(chapter_id=chapter_id).exclude(pk__in=seen).update(reviewed=False)
    counts['chapters']=len(chapter_seen)
    return counts
