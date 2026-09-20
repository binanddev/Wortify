from django.core.management.base import BaseCommand
from django.db import transaction
from practice.models import Chapter, Exercise, Question

class Command(BaseCommand):
    help = 'Nhập ba bài đã đối chiếu trang 4, không ghi đè bài đã tồn tại.'
    @transaction.atomic
    def handle(self,*args,**kwargs):
        titles = ['Und was machst du?','Nach der Schulzeit','Immer online?','Große und kleine Gefühle','Leben in der Stadt','Arbeitswelten','Ganz schön mobil','Gelernt ist gelernt!','Sportlich, sportlich','Zusammen leben','Wie die Zeit vergeht!','Gute Unterhaltung!']
        for n,title in enumerate(titles,1):
            Chapter.objects.get_or_create(book_id=1, number=n,defaults={'title':title,'page_start':4+(n-1)*5})
        chapter = Chapter.objects.get(book_id=1, number=1)
        def add(number,title,instruction,kind,decision,objective,rationale,rows,options=None,**extra):
            e,created = Exercise.objects.get_or_create(chapter=chapter,number=number,defaults=dict(title=title,instruction=instruction,kind=kind,decision=decision,objective=objective,rationale=rationale,source_page=4,answer_page=64,reviewed=True,**extra))
            if not created:
                return
            for pos,(prompt,answer,example) in enumerate(rows,1):
                Question.objects.create(exercise=e,position=pos,prompt=prompt,accepted_answers=[answer],example=example,options=options or [])
        options=['A · Was ist ihre Lieblingsfarbe?','B · Was macht sie beruflich?','C · Was macht sie gern in ihrer Freizeit?','D · Welche Sprachen spricht sie?','E · Wie ist ihr Name?','F · Wo ist sie besonders gern?','G · Wo wohnt sie?']
        prompts=['Mara-Sophie Lemper','Journalistin','Heinestraße 5, Düsseldorf','lesen, reisen und reiten','Spanisch und Englisch','Blau, blau wie das Meer','Granada in Südspanien']
        add('1a','Und was machst du?','Zu welchen Angaben passen die Fragen? Ordnen Sie zu.','choice','DIGITIZE_WITH_SIMPLIFICATION','Hiểu câu hỏi W-Fragen và thông tin cá nhân.','Chuyển ghép chữ cái sang dropdown; ảnh chân dung chỉ minh họa.',[(t,options[i],False) for t,i in zip(prompts,[4,1,6,2,3,0,5])],options)
        groups={'Ausbildung':['lernen','zur Schule gehen','die Uni besuchen','studieren','ein Studium machen'],'Freizeit':['ausgehen','feiern','Freunde treffen','Spaß haben','Sport machen'],'Wohnen':['ein Apartment mieten','auf dem Land leben','das Stadtzentrum','die Wohnung renovieren','zusammenleben']}
        order=['ein Apartment mieten','zusammenleben','lernen','Freunde treffen','die Uni besuchen','auf dem Land leben','feiern','zur Schule gehen','Spaß haben','Sport machen','das Stadtzentrum','studieren','ein Studium machen','die Wohnung renovieren','ausgehen']
        add('1b','Ausbildung · Freizeit · Wohnen','Zu welchem Thema passen die Wörter und Ausdrücke? Notieren Sie.','choice','DIGITIZE_WITH_SIMPLIFICATION','Phân loại từ vựng theo học tập, giải trí và nơi ở.','Bảng ba cột đổi thành chọn nhóm cho từng từ; giữ lernen là ví dụ, không tính điểm.',[(w,next(k for k,v in groups.items() if w in v),w=='lernen') for w in order],list(groups))
        context='Meine Familie ist ziemlich groß. Ich habe zwei Geschwister, eine Schwester und einen (1) ____. Meine (2) ____ sehe ich nicht so oft, sie lebt weiter weg. Mein Bruder lebt mit seiner Partnerin ganz in der Nähe. Sie haben zwei (3) ____, Sophie und Noah. Ihre (4) ____ Sophie ist erst ein Jahr alt und total süß. Ihr (5) ____ Noah ist vier. Manchmal ist er über das Wochenende bei mir.\n\nMeine Eltern leben getrennt, sie sind seit zehn Jahren (6) ____. Ich habe viel Kontakt zu meinem (7) ____, wir sehen uns fast jede Woche. Meine (8) ____ kann ich nur im Urlaub besuchen. Sie lebt mit ihrem Partner in Frankreich.'
        add('2','Die Familie','Ergänzen Sie die Lücken.','text','DIGITIZE','Từ vựng quan hệ gia đình trong một đoạn văn.','Điền từ giữ nguyên mục tiêu; có hai cách làm có hoặc không gợi ý. Ảnh gia đình chỉ minh họa.',[(f'Lücke ({i})',a,False) for i,a in enumerate(['Bruder','Schwester','Kinder','Tochter','Sohn','geschieden','Vater','Mutter'],1)],context=context,hints='Bruder · geschieden · Kinder · Mutter · Schwester · Sohn · Tochter · Vater')
        self.stdout.write(self.style.SUCCESS('Đã nhập 12 chương và 3 bài trang 4.'))
