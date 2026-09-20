from django.db import models
from django.conf import settings
import uuid
from django.core.exceptions import ValidationError

class Chapter(models.Model):
    metadata = models.JSONField(default=dict, blank=True)
    source_document = models.JSONField(default=dict, blank=True)
    theory = models.JSONField(default=dict, blank=True)
    book = models.ForeignKey('content.Book', on_delete=models.PROTECT, default=1, related_name='chapters')
    number = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=150)
    page_start = models.PositiveSmallIntegerField()
    class Meta:
        ordering = ['number']
        constraints = [models.UniqueConstraint(fields=['book', 'number'], name='unique_book_chapter')]
    def __str__(self):
        return f'{self.number}. {self.title}'

class Exercise(models.Model):
    presentation = models.JSONField(default=dict, blank=True)
    source_id = models.CharField(max_length=100, blank=True)
    source_document = models.JSONField(default=dict, blank=True)
    source_type = models.CharField(max_length=40, blank=True)
    import_warnings = models.JSONField(default=list, blank=True)
    DECISIONS = [(x,x) for x in ['DIGITIZE','DIGITIZE_WITH_SIMPLIFICATION','SKIP']]
    CHECKS = [(x,x) for x in ['auto_check','manual_check','ai_assisted_check']]
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE)
    number = models.CharField(max_length=100)
    title = models.CharField(max_length=200)
    instruction = models.TextField()
    source_page = models.PositiveSmallIntegerField()
    answer_page = models.PositiveSmallIntegerField(null=True, blank=True)
    decision = models.CharField(max_length=40, choices=DECISIONS)
    rationale = models.TextField()
    objective = models.TextField()
    cefr = models.CharField(max_length=30, default='A2 (suy luận)')
    difficulty = models.CharField(max_length=30, default='Thấp')
    kind = models.CharField(max_length=20, choices=[('choice','Chọn / ghép / phân nhóm'),('text','Điền từ / câu ngắn'),('cloze','Điền trực tiếp trong câu'),('multi','Chọn nhiều đáp án'),('wordset','Tìm tập từ / cụm từ')])
    check_mode = models.CharField(max_length=30, choices=CHECKS, default='auto_check')
    reviewed = models.BooleanField(default=False)
    context = models.TextField(blank=True)
    hints = models.TextField(blank=True)
    allow_review = models.BooleanField(default=False)
    image_path = models.CharField(max_length=200,blank=True)
    image_description = models.TextField(blank=True)
    ignore_case = models.BooleanField(default=False)
    ignore_punctuation = models.BooleanField(default=False)
    class Meta:
        ordering = ['chapter__number','id']
        constraints = [models.UniqueConstraint(fields=['chapter','number'],name='unique_book_exercise')]
    def __str__(self):
        return f'{self.chapter.number} / {self.number}: {self.title}'
    def clean(self):
        if self.reviewed and self.decision == 'SKIP':
            raise ValidationError('Bài SKIP không được xuất bản.')

class Question(models.Model):
    kind = models.CharField(max_length=30, blank=True)
    presentation = models.JSONField(default=dict, blank=True)
    exercise = models.ForeignKey(Exercise,on_delete=models.CASCADE,related_name='questions')
    position = models.PositiveSmallIntegerField()
    prompt = models.TextField()
    options = models.JSONField(default=list, blank=True)
    accepted_answers = models.JSONField(default=list, blank=True)
    blanks = models.JSONField(default=list,blank=True)
    example = models.BooleanField(default=False)
    class Meta:
        ordering = ['position']
        constraints = [models.UniqueConstraint(fields=['exercise','position'],name='unique_question_position')]
    def clean(self):
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
        if not isinstance(self.accepted_answers,list) or not all(isinstance(x,str) for x in self.accepted_answers):
            raise ValidationError('Đáp án phải là danh sách chuỗi.')
        if self.exercise.check_mode == 'auto_check' and not self.accepted_answers and not self.blanks:
            raise ValidationError('Bài tự chấm phải có đáp án.')
        if (self.options or self.exercise.kind in ['choice','multi']) and not self.example and (not self.options or any(a not in self.options for a in self.accepted_answers)):
            raise ValidationError('Đáp án phải nằm trong các lựa chọn.')

class Attempt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    exercise = models.ForeignKey(Exercise,on_delete=models.PROTECT)
    session_key = models.CharField(max_length=40,db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    answers = models.JSONField()
    score = models.PositiveSmallIntegerField(null=True,blank=True)
    total = models.PositiveSmallIntegerField()
    status = models.CharField(max_length=30,default='graded',choices=[('graded','Đã chấm'),('pending_manual','Chờ giáo viên'),('pending_ai','Chờ AI hỗ trợ')])
    teacher_feedback = models.TextField(blank=True)
    def clean(self):
        if self.score is not None and self.score > self.total:
            raise ValidationError('Điểm không thể vượt tổng số câu.')

class Notification(models.Model):
    session_key=models.CharField(max_length=40,db_index=True)
    attempt=models.ForeignKey(Attempt,on_delete=models.CASCADE)
    text=models.CharField(max_length=300)
    created_at=models.DateTimeField(auto_now_add=True)
    read_at=models.DateTimeField(null=True,blank=True)


class ChapterProgress(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE)
    completed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user','chapter'],name='unique_user_chapter_progress')]
