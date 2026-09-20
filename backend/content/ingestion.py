"""Database-only chapter ingestion. No dependency on the book/ staging directory."""
from django.db import transaction
from practice.models import Chapter
from .importing import normalize, resources, save_exercise

MAX_ITEMS=500

def validate_theory(theory):
    if not isinstance(theory,dict):raise ValueError('theory phải là đối tượng.')
    if not isinstance(theory.get('explanation',''),str):raise ValueError('explanation phải là văn bản.')
    for key in ('rules','usage_notes'):
        if not isinstance(theory.get(key,[]),list) or not all(isinstance(v,str) for v in theory.get(key,[])):raise ValueError(f'{key} phải là danh sách văn bản.')
    if not isinstance(theory.get('tables',[]),list):raise ValueError('tables phải là danh sách.')
    for table in theory.get('tables',[]):
        if not isinstance(table,dict) or not isinstance(table.get('headers',[]),list) or not isinstance(table.get('rows',[]),list):raise ValueError('Bảng lý thuyết không hợp lệ.')
        if any(not isinstance(row,list) or any(not isinstance(v,(str,int,float)) for v in row) for row in table.get('rows',[])):raise ValueError('Mỗi hàng bảng phải là danh sách văn bản/số.')
    return theory

def validate_document(book,doc):
    if not isinstance(doc,dict):raise ValueError('Mỗi tệp phải là đối tượng chương.')
    if doc.get('schema_version',1)!=1:raise ValueError('Chỉ hỗ trợ schema_version 1.')
    metadata=doc.get('book') or {}
    if not isinstance(metadata,dict):raise ValueError('book phải là đối tượng.')
    if metadata.get('language',book.language)!=book.language:raise ValueError('Ngôn ngữ JSON không khớp sách đã chọn.')
    chapter=doc.get('chapter') or doc
    if not isinstance(chapter,dict):raise ValueError('chapter phải là đối tượng.')
    if type(chapter.get('number')) is not int or not 1<=chapter['number']<=65535:raise ValueError('chapter.number phải là số nguyên từ 1 đến 65535.')
    if not isinstance(chapter.get('title'),str) or not chapter['title'].strip() or len(chapter['title'])>150:raise ValueError('Chương cần tiêu đề, tối đa 150 ký tự.')
    exercises=doc.get('exercises',[])
    if not isinstance(exercises,list) or len(exercises)>200:raise ValueError('Mỗi chương tối đa 200 bài.')
    ids=set();warnings=[];manual=0;classification=[]
    for e in exercises:
        if not isinstance(e,dict):raise ValueError('Mỗi bài tập phải là đối tượng.')
        key=str(e.get('id') or f'{chapter["number"]}-{e.get("number","")}')
        if key.endswith('-') or len(key)>100 or key in ids:raise ValueError('Mã bài thiếu, trùng hoặc quá dài.')
        ids.add(key)
        if not isinstance(e.get('instruction'),str) or not e['instruction'].strip():raise ValueError('Mỗi bài cần instruction hướng dẫn làm bài.')
        if not isinstance(e.get('items',[]),list) or len(e.get('items',[]))>MAX_ITEMS:raise ValueError('items phải là danh sách tối đa 500 câu.')
        result=normalize(e);warnings.extend(f'{key}: {w}' for w in result['warnings']);manual+=result['check_mode']=='manual_check'
        resources(e)
        classification.append({'id':key,'source_type':e.get('type','text'),'type':result['presentation']['type'],'needs_review':result['needs_review'],'warnings':result['warnings']})
        for row in result['rows']:
            if row['kind']=='order':
                tokens=row['presentation']['tokens']
                if not isinstance(tokens,list) or not tokens or any(not isinstance(t,dict) or not isinstance(t.get('id'),str) or not isinstance(t.get('text'),str) for t in tokens):raise ValueError('Bài order cần tokens gồm id và text.')
                token_ids=[t['id'] for t in tokens]
                if len(set(token_ids))!=len(token_ids) or len(row['accepted_answers'])!=len(token_ids) or set(row['accepted_answers'])!=set(token_ids):raise ValueError('Đáp án order phải chứa mỗi id từ đúng một lần.')
    theory=validate_theory(doc.get('theory') or chapter.get('theory') or {})
    examples=doc.get('examples',theory.get('examples',[]))
    if not isinstance(examples,list) or any(not isinstance(e,str) and (not isinstance(e,dict) or not isinstance(e.get('text'),str)) for e in examples):raise ValueError('Ví dụ phải là văn bản hoặc đối tượng có text.')
    return {'number':chapter['number'],'title':chapter['title'],'exercises':len(exercises),'manual':manual,'warnings':warnings,'classification':classification,'drafts':sum(r['needs_review'] for r in classification)}

@transaction.atomic
def ingest_documents(book,documents):
    summaries=[validate_document(book,d) for d in documents]
    numbers=[s['number'] for s in summaries]
    if len(set(numbers))!=len(numbers):raise ValueError('Hai tệp trong một lượt không được có cùng số chương.')
    updated=0
    for doc,summary in zip(documents,summaries):
        source=doc.get('chapter') or doc
        existing=Chapter.objects.filter(book=book,number=summary['number']).first()
        theory=doc.get('theory',source.get('theory'))
        defaults={'title':summary['title'],'page_start':0,'source_document':doc,'metadata':{'source_id':source.get('id',''),'tags':doc.get('tags',[]),'topics':doc.get('grammar_topics',[]),'source':doc.get('source',{})}}
        if theory is not None or not existing:
            defaults['theory']={**(theory or {}),'examples':doc.get('examples',(theory or {}).get('examples',[])),'resources':resources(doc)}
        chapter,_=Chapter.objects.update_or_create(book=book,number=summary['number'],defaults=defaults)
        for source in doc.get('exercises',[]):
            _,changed=save_exercise(chapter,source);updated+=changed
    return {'chapters':len(documents),'exercises':sum(s['exercises'] for s in summaries),'updated':updated,'manual':sum(s['manual'] for s in summaries),'drafts':sum(s['drafts'] for s in summaries)}

TEMPLATE={
 'schema_version':1,
 'book':{'language':'en'},
 'chapter':{'id':'U01','number':1,'title':'Everyday learning'},
 'theory':{'explanation':'A little practice every day.','rules':['Use is with he, she and it.'],'tables':[{'title':'Be','headers':['Subject','Verb'],'rows':[['I','am'],['You','are'],['She','is']]}],'usage_notes':[]},
 'examples':[{'text':'She is learning.','type':'grammar_pattern'}],
 'resources':[{'type':'image','file':'images/U01-cover.png','description':'Minh họa chương'}],
 'exercises':[
  {'id':'U01-E01','number':'1.1','type':'fill_blank','instruction':'Điền các từ còn thiếu.','grading':{'mode':'auto','ignore_case':True,'ignore_punctuation':False},'items':[{'id':'1','text':'She {{1}} learning {{2}} day.','blanks':[{'answer':['is',"’s"]},{'answer':'every'}]}]},
  {'id':'U01-E02','number':'1.2','type':'single_choice','instruction':'Chọn nghĩa đúng.','items':[{'id':'1','text':'discover','options':[{'id':'a','text':'khám phá'},{'id':'b','text':'ghi nhớ'}],'answer':'a'}]},
  {'id':'U01-E03','number':'1.3','type':'multiple_choice','instruction':'Chọn tất cả động từ.','items':[{'id':'1','text':'Which are verbs?','options':['learn','book','grow'],'answer':['learn','grow']}]},
  {'id':'U01-E04','number':'1.4','type':'order','instruction':'Sắp xếp các từ thành câu.','items':[{'id':'1','text':'Tôi học mỗi ngày.','tokens':[{'id':'b','text':'learn'},{'id':'d','text':'day.'},{'id':'a','text':'I'},{'id':'c','text':'every'}],'answer':['a','b','c','d']}]},
  {'id':'U01-E05','number':'1.5','type':'free_text','instruction':'Viết về một điều bạn muốn học.','grading':{'mode':'manual'},'resources':[{'type':'audio','file':'audio/U01-E05.mp3','description':'Nghe gợi ý'}],'items':[{'id':'1','text':'Your learning goal','answer':None}]},
  {'id':'U01-E06','number':'1.6','type':'matching','instruction':'Ghép từ với nghĩa.','options':['nhà','nước'],'items':[{'id':'1','text':'house','answer':'nhà'},{'id':'2','text':'water','answer':'nước'}]},
  {'id':'U01-E07','number':'1.7','type':'wordset','instruction':'Nhập các từ ngăn cách bằng dấu phẩy; không cần đúng thứ tự.','items':[{'id':'1','text':'Hai động từ vừa học','answer':['learn','grow']}]}
 ]
}


def canonicalize_document(doc):
    """Export an explicit layout contract while preserving book/chapter metadata."""
    from copy import deepcopy
    result=deepcopy(doc);result['schema_version']=1
    for e in result.get('exercises',[]):
        n=normalize(e)
        if n['needs_review']:continue
        e['type']=n['presentation']['type']
        if n['presentation']['inline_passage']:e.pop('content',None);e.pop('passage',None)
        e['items']=[{'id':q['presentation']['source_item'],'type':q['kind'],'text':q['prompt'],'options':q['options'],'answer':q['accepted_answers'] if len(q['accepted_answers'])!=1 or q['kind'] in ['multi','wordset','order'] else q['accepted_answers'][0],'blanks':[{'answer':b['answers']} for b in q['blanks']],'tokens':q['presentation']['tokens'],'cells':q['presentation']['cells'],'resources':q['presentation']['resources'],'example':q['example']} for q in n['rows']]
    return result
