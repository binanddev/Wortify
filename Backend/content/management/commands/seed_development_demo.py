import json
from copy import deepcopy
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from cards.models import Deck, Card, Folder
from practice.models import PracticeNode
from api.practice_hub import validate_payload

class Command(BaseCommand):
    help = 'Create repeatable local demo data for UI and learning tests.'
    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('Demo data is only available in development (DEBUG).')
        user, created = get_user_model().objects.get_or_create(username='demo')
        if created:
            user.set_password('WortifyDemo2026!')
            user.is_staff = True
            user.is_superuser = True
            user.save()
        for name,staff in [('learner',False),('staff',True)]:
            account,fresh=get_user_model().objects.get_or_create(username=name)
            if fresh:account.set_password('WortifyDemo2026!');account.is_staff=staff;account.save()
        samples = settings.BASE_DIR/'sample_data'
        template = {'nodes': [{'children': json.loads((samples/'practice-hub-v2.json').read_text(encoding='utf-8'))['nodes']}]}
        ux_demo = json.loads((samples/'practice-hub-v2.json').read_text(encoding='utf-8'))
        for lang in ('en','de'):
            root,created_root=PracticeNode.objects.get_or_create(owner=user,language=lang,title='Practice Hub · Bảy dạng bài mới',kind='folder',defaults={'visibility':'public'})
            if created_root:
                nested=PracticeNode.objects.create(owner=user,language=lang,title='Bài luyện cơ bản',kind='folder',parent=root,visibility='public')
                nodes=[]
                for entry in template['nodes'][0]['children']:
                    if entry['kind']!='exercise':continue
                    e=entry['payload']
                    nodes.append(PracticeNode.objects.create(owner=user,language=lang,title=e['title'],kind='exercise',parent=nested,payload=validate_payload('exercise',e),visibility='public'))
                theory=PracticeNode.objects.create(owner=user,language=lang,title='Lý thuyết · Chào hỏi',kind='theory',parent=root,payload={'format':'markdown','content':'# Chào hỏi\n\n**Hello** nghĩa là xin chào. Hãy chọn bài luyện bên dưới để thực hành.'},visibility='public')
                theory.links.set([nested,nodes[2]]);nodes[2].links.add(theory)

            playground,_=PracticeNode.objects.get_or_create(owner=user,language=lang,title='Sân tập UI/UX',kind='folder',parent=root,defaults={'visibility':'public'})
            for entry in ux_demo['nodes']:
                payload=validate_payload('exercise',deepcopy(entry['payload']))
                PracticeNode.objects.get_or_create(owner=user,language=lang,title=entry['title'],kind='exercise',parent=playground,defaults={'payload':payload,'visibility':'public'})

            folder,_=Folder.objects.get_or_create(owner=user,language=lang,name='Bộ thẻ thử nghiệm')
            deck,_=Deck.objects.get_or_create(owner=user,language=lang,title=f'{lang.upper()} · Từ vựng mỗi ngày',defaults={'folder':folder,'level':'A1'})
            words=[('hello','Hallo','xin chào'),('book','Buch','quyển sách'),('water','Wasser','nước'),('house','Haus','ngôi nhà'),('learn','lernen','học'),('friend','Freund','người bạn'),('apple','Apfel','quả táo'),('sun','Sonne','mặt trời'),('school','Schule','trường học'),('day','Tag','ngày'),('read','lesen','đọc'),('write','schreiben','viết')]
            for i,(en,de,meaning) in enumerate(words):
                Card.objects.get_or_create(deck=deck,position=i,defaults={'german_text':en if lang=='en' else de,'vietnamese_meaning':meaning,'example_german':f'I like the word {en}.' if lang=='en' else f'Ich lerne das Wort {de}.','example_vietnamese':f'Tôi học từ {meaning}.'})
        self.stdout.write(self.style.SUCCESS('Demo ready: demo / WortifyDemo2026! (password set only on first creation).'))
