from django.core.management.base import BaseCommand
from django.db import transaction
from content.models import Book
from practice.models import Chapter, Exercise, Question

class Command(BaseCommand):
    help = 'Thêm ba bài tiếng Anh A1 tự soạn; không ghi đè nội dung đã có.'
    @transaction.atomic
    def handle(self, *args, **options):
        book, _ = Book.objects.get_or_create(slug='english-a1', defaults={'title':'Everyday English — Practice Book','language':'en','level':'A1','description':'Sách bài tập tiếng Anh tự soạn.'})
        chapter, _ = Chapter.objects.get_or_create(book=book, number=1, defaults={'title': 'Hello, world!', 'page_start': 1})
        rows = [
            ('1', 'Introducing yourself', 'Complete each sentence with am, is or are.', 'cloze', 'auto_check', [dict(prompt='I {{1}} a student. My name {{2}} Alex.', blanks=[{'answers': ['am']}, {'answers': ['is']}]), dict(prompt='We {{1}} friends.', blanks=[{'answers': ['are']}])]),
            ('2', 'Everyday words', 'Choose the correct plural form.', 'choice', 'auto_check', [dict(prompt='one child → two …', options=['childs', 'children', 'childes'], accepted_answers=['children']), dict(prompt='one book → three …', options=['books', 'bookes', 'book'], accepted_answers=['books'])]),
            ('3', 'A little about you', 'Write three sentences about yourself. Your teacher will review your writing.', 'text', 'manual_check', [dict(prompt='What is your name? Where do you live? What do you like?')]),
        ]
        for number, title, instruction, kind, check_mode, questions in rows:
            exercise, created = Exercise.objects.get_or_create(chapter=chapter, number=number, defaults={'title': title, 'instruction': instruction, 'kind': kind, 'check_mode': check_mode, 'source_page': 1, 'decision': 'DIGITIZE', 'reviewed': True, 'cefr': 'A1', 'objective': 'Practice basic English vocabulary and sentence structure.', 'rationale': 'Nội dung tự soạn cho nền tảng hợp nhất.', 'ignore_case': False})
            if created:
                for i, data in enumerate(questions, 1):
                    question = Question(exercise=exercise, position=i, **data); question.full_clean(); question.save()
        self.stdout.write('English A1 sample content is ready.')
