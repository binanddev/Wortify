from pathlib import Path
from django.conf import settings
from django.core.management import BaseCommand, call_command

class Command(BaseCommand):
    help = 'Nhập toàn bộ 12 chương, không ghi đè bài đã có.'
    def handle(self, *args, **kwargs):
        call_command('seed_book')
        for chapter in range(1, 13):
            call_command('import_exercises', str(Path(settings.BASE_DIR) / f'practice/data/chapter{chapter}.json'), chapter=chapter)
