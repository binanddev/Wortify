import json
from django.core.management.base import BaseCommand
from content.importing import catalog, import_book
class Command(BaseCommand):
    help='Đồng bộ sách JSON trong book/EN và book/DE; không thay bản nộp cũ.'
    def add_arguments(self,parser):parser.add_argument('--directory')
    def handle(self,*args,**options):
        for row in ([{'directory':options['directory']}] if options['directory'] else catalog()):
            result=import_book(row['directory'])
            self.stdout.write(json.dumps({k:v for k,v in result.items() if k!='warnings'},ensure_ascii=False))
            self.stdout.write(f"Cần đối chiếu: {len(result['warnings'])} ghi chú (xem trang quản trị).")
