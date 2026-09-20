import json
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from practice.models import Chapter,Exercise,Question

class Command(BaseCommand):
    help='Nhập bài đã được kiểm tra từ JSON; mặc định không ghi đè.'
    def add_arguments(self,parser):
        parser.add_argument('file')
        parser.add_argument('--chapter',type=int,required=True)
    @transaction.atomic
    def handle(self,*args,**kwargs):
        chapter=Chapter.objects.get(book_id=1, number=kwargs['chapter'])
        data=json.loads(Path(kwargs['file']).read_text(encoding='utf-8'))
        count=0
        for row in data:
            questions=row.pop('questions')
            if Exercise.objects.filter(chapter=chapter,number=row['number']).exists():
                continue
            exercise=Exercise(chapter=chapter,**row)
            exercise.full_clean();exercise.save()
            for i,item in enumerate(questions,1):
                q=Question(exercise=exercise,position=i,**item)
                q.full_clean();q.save()
            count+=1
        self.stdout.write(f'Imported {count} exercises.')
