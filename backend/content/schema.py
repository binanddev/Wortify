"""One taxonomy shared by ingestion, admin documentation and learner layouts."""
TYPES = [
 {'id':'cloze','label':'Điền chỗ trống','description':'Điền ngay trong câu hoặc đoạn văn, giữ nguyên ngữ cảnh.','rule':'text có {{1}}, {{2}}… và blanks có answer tương ứng; một ô có thể chấp nhận nhiều cách viết.','example':{'id':'E01','type':'cloze','instruction':'Complete the paragraph.','items':[{'text':'Every morning I {{1}} tea. My sister {{2}} coffee.','blanks':[{'answer':['drink']},{'answer':['drinks']}]}]}},
 {'id':'choice','label':'Chọn một đáp án','description':'Các lựa chọn có nút radio, chỉ chọn một.','rule':'options là danh sách chuỗi hoặc {id,text}; answer là một mã hoặc nguyên văn lựa chọn.','example':{'id':'E02','type':'choice','instruction':'Choose the correct word.','items':[{'text':'She ___ a teacher.','options':['am','is','are'],'answer':'is'}]}},
 {'id':'multi','label':'Chọn nhiều đáp án','description':'Các lựa chọn có checkbox và nhắc rõ chọn nhiều.','rule':'answer là toàn bộ các lựa chọn đúng, không phải phương án thay thế.','example':{'id':'E03','type':'multi','instruction':'Select all verbs.','items':[{'text':'Which words are verbs?','options':['learn','book','grow'],'answer':['learn','grow']}]}},
 {'id':'matching','label':'Nối hai cột','description':'Chọn câu ở cột trái rồi chọn phần tương ứng ở cột phải.','rule':'Mỗi item là một câu bên trái; options dùng chung là cột phải; answer chỉ đúng một lựa chọn. Các cặp được đánh số để dễ đối chiếu.','example':{'id':'E04','type':'matching','instruction':'Match the sentence halves.','options':[{'id':'a','text':'because it is raining.'},{'id':'b','text':'when I have time.'}],'items':[{'text':'I read','answer':'b'},{'text':'I stay inside','answer':'a'}]}},
 {'id':'order','label':'Sắp xếp từ / câu','description':'Chọn từng mảnh để tạo thứ tự, bấm lại để bỏ.','rule':'tokens gồm id và text; answer chứa mỗi id đúng một lần theo thứ tự đúng.','example':{'id':'E05','type':'order','instruction':'Put the words in order.','items':[{'text':'Tôi học mỗi ngày.','tokens':[{'id':'b','text':'learn'},{'id':'a','text':'I'},{'id':'c','text':'every day.'}],'answer':['a','b','c']}]}},
 {'id':'text','label':'Trả lời ngắn / viết lại','description':'Đề và ô nhập tách biệt; phù hợp sửa lỗi, biến đổi câu.','rule':'answer là chuỗi hoặc danh sách cách trả lời thay thế. Đáp án dài có thể tắt chấm tự động.','example':{'id':'E06','type':'text','instruction':'Correct the sentence.','items':[{'text':'She go to school.','answer':'She goes to school.'}]}},
 {'id':'writing','label':'Viết tự do','description':'Vùng viết rộng, lưu bài làm; không gán điểm tự động.','rule':'answer: null; grading.mode: manual. Chức năng gửi giáo viên đang tạm ngắt.','example':{'id':'E07','type':'writing','instruction':'Write about your weekend.','grading':{'mode':'manual'},'items':[{'text':'What did you do?','answer':None}]}},
 {'id':'wordset','label':'Liệt kê một tập từ','description':'Nhập các từ ngăn cách bằng dấu phẩy, không xét thứ tự.','rule':'answer là toàn bộ các từ cần có; không dùng cho đáp án thay thế.','example':{'id':'E08','type':'wordset','instruction':'Name two colours from the lesson.','items':[{'text':'Two colours','answer':['blue','white']}]}},
 {'id':'table','label':'Hoàn thành bảng','description':'Bảng có tiêu đề cột, ô trống nằm trong từng hàng.','rule':'columns là danh sách tiêu đề. Mỗi item có cells cùng số cột, ký hiệu {{1}}… và blanks cho riêng hàng đó.','example':{'id':'E09','type':'table','instruction':'Complete the word family.','columns':['Noun','Adjective'],'items':[{'cells':['beauty','{{1}}'],'blanks':[{'answer':'beautiful'}]},{'cells':['care','{{1}}'],'blanks':[{'answer':'careful'}]}]}}
]
TYPE_IDS={t['id'] for t in TYPES}
ALIASES={'fill_blank':'cloze','single_choice':'choice','multiple_choice':'multi','free_text':'writing','ordering':'order','table_completion':'table','word_formation':'text','rewrite':'text','correction':'text','sentence_completion':'cloze','transformation':'text','writing':'writing'}

def classify(source):
    raw=source.get('type','text')
    kind=ALIASES.get(raw,raw) if isinstance(raw,str) else 'unknown'
    if kind in TYPE_IDS:return kind,False
    if raw in ('reading','other'):
        items=source.get('items') or []
        if any(i.get('options') for i in items if isinstance(i,dict)):return 'choice',False
        if any(i.get('blanks') for i in items if isinstance(i,dict)):return 'cloze',False
    return 'text',True
