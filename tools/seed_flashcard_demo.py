"""Seed isolated flashcard UI data. Run with the project's virtualenv Python.
Repeat runs reuse this batch; existing decks and learning progress are untouched.
"""
import os
from pathlib import Path
import random
import sys
import json

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count
from cards.models import Folder, Deck, Card

TAG = 'flashcard-ui-20260928-v1'
# English | German | Vietnamese. German nouns retain their articles.
TOPICS = [
 ('Food and drinks', 'Essen und Trinken', '''water|das Wasser|nước
bread|das Brot|bánh mì
milk|die Milch|sữa
tea|der Tee|trà
coffee|der Kaffee|cà phê
rice|der Reis|gạo
cheese|der Käse|phô mai
soup|die Suppe|súp
sugar|der Zucker|đường
salt|das Salz|muối'''),
 ('Fruit basket', 'Obstkorb', '''apple|der Apfel|quả táo
banana|die Banane|quả chuối
orange|die Orange|quả cam
pear|die Birne|quả lê
grape|die Traube|quả nho
strawberry|die Erdbeere|quả dâu tây
lemon|die Zitrone|quả chanh vàng
peach|der Pfirsich|quả đào
cherry|die Kirsche|quả anh đào
pineapple|die Ananas|quả dứa'''),
 ('Animal friends', 'Tierfreunde', '''cat|die Katze|con mèo
dog|der Hund|con chó
bird|der Vogel|con chim
horse|das Pferd|con ngựa
rabbit|das Kaninchen|con thỏ
fish|der Fisch|con cá
mouse|die Maus|con chuột
bear|der Bär|con gấu
lion|der Löwe|con sư tử
elephant|der Elefant|con voi'''),
 ('School essentials', 'In der Schule', '''book|das Buch|quyển sách
pen|der Stift|cây bút
pencil|der Bleistift|bút chì
notebook|das Heft|quyển vở
school|die Schule|trường học
classroom|das Klassenzimmer|phòng học
homework|die Hausaufgabe|bài tập về nhà
ruler|das Lineal|thước kẻ
eraser|der Radiergummi|cục tẩy
backpack|der Rucksack|ba lô'''),
 ('Around the city', 'In der Stadt', '''street|die Straße|đường phố
park|der Park|công viên
bridge|die Brücke|cây cầu
station|der Bahnhof|nhà ga
museum|das Museum|bảo tàng
cinema|das Kino|rạp chiếu phim
library|die Bibliothek|thư viện
hospital|das Krankenhaus|bệnh viện
supermarket|der Supermarkt|siêu thị
pharmacy|die Apotheke|hiệu thuốc'''),
 ('A place called home', 'Zu Hause', '''house|das Haus|ngôi nhà
room|das Zimmer|căn phòng
kitchen|die Küche|nhà bếp
door|die Tür|cánh cửa
window|das Fenster|cửa sổ
table|der Tisch|cái bàn
chair|der Stuhl|cái ghế
bed|das Bett|cái giường
lamp|die Lampe|cái đèn
garden|der Garten|khu vườn'''),
 ('Nature and weather', 'Natur und Wetter', '''sun|die Sonne|mặt trời
rain|der Regen|mưa
snow|der Schnee|tuyết
wind|der Wind|gió
cloud|die Wolke|đám mây
tree|der Baum|cây
flower|die Blume|bông hoa
mountain|der Berg|ngọn núi
river|der Fluss|dòng sông
forest|der Wald|khu rừng'''),
 ('Travel light', 'Unterwegs', '''train|der Zug|tàu hỏa
bus|der Bus|xe buýt
bicycle|das Fahrrad|xe đạp
car|das Auto|ô tô
airplane|das Flugzeug|máy bay
ticket|die Fahrkarte|vé đi tàu xe
suitcase|der Koffer|va li
passport|der Reisepass|hộ chiếu
hotel|das Hotel|khách sạn
airport|der Flughafen|sân bay'''),
 ('Everyday actions', 'Jeden Tag', '''learn|lernen|học
read|lesen|đọc
write|schreiben|viết
speak|sprechen|nói
listen|zuhören|lắng nghe
eat|essen|ăn
drink|trinken|uống
sleep|schlafen|ngủ
play|spielen|chơi
work|arbeiten|làm việc'''),
 ('Little descriptions', 'So ist es', '''big|groß|to lớn
small|klein|nhỏ
fast|schnell|nhanh
slow|langsam|chậm
warm|warm|ấm
cold|kalt|lạnh
new|neu|mới
old|alt|cũ
beautiful|schön|đẹp
important|wichtig|quan trọng'''),
]

def main():
    owner = get_user_model().objects.get(username='minhtien', is_active=True)
    reports = []
    with transaction.atomic():
        for language in ('en', 'de'):
            rng = random.Random(20260928 + (1 if language == 'en' else 2))
            folder_ids = []
            created = {'folders': 0, 'decks': 0, 'cards': 0}
            for i in range(20):
                en, de, raw = TOPICS[i % len(TOPICS)]
                title = en if language == 'en' else de
                if i >= 10:
                    title += ' — Review and discover' if language == 'en' else ' — Wiederholen und entdecken'
                name = f'[TEST FC] {i + 1:02d} · {title}'
                folder, new = Folder.objects.get_or_create(owner=owner, language=language, name=name)
                created['folders'] += int(new)
                folder_ids.append(folder.pk)
                words = [row.split('|') for row in raw.splitlines()]
                for j in range(rng.randint(5, 15)):
                    count = rng.randint(5, 10)
                    chosen = rng.sample(words, count)
                    deck_title = f'{title} · {j + 1:02d}'
                    deck, new = Deck.objects.get_or_create(
                        owner=owner, language=language, folder=folder,
                        title=deck_title, topic=TAG,
                        defaults={'level': 'A1' if i < 10 else 'A2',
                                  'description': f'{count} từ vựng · {"Khởi động" if i < 10 else "Ôn tập"} · Dữ liệu thử giao diện.'})
                    if not new:
                        continue
                    created['decks'] += 1
                    cards = []
                    for pos, (english, german, meaning) in enumerate(chosen):
                        term = english if language == 'en' else german
                        article = german.split()[0] if language == 'de' and german.startswith(('der ', 'die ', 'das ')) else ''
                        card = Card(deck=deck, german_text=term, vietnamese_meaning=meaning,
                                    position=pos, article=article,
                                    part_of_speech='noun' if i % 10 < 8 else 'verb' if i % 10 == 8 else 'adjective',
                                    notes=TAG)
                        card.full_clean()
                        cards.append(card)
                    Card.objects.bulk_create(cards)
                    created['cards'] += len(cards)
            folders = Folder.objects.filter(pk__in=folder_ids).annotate(total=Count('decks'))
            decks = Deck.objects.filter(folder_id__in=folder_ids, topic=TAG).annotate(total=Count('cards'))
            assert folders.count() == 20
            assert all(5 <= f.total <= 15 for f in folders)
            assert all(5 <= d.total <= 10 and d.owner_id == owner.pk and d.language == language for d in decks)
            cards = Card.objects.filter(deck__in=decks)
            assert not cards.filter(german_text='').exists()
            assert not cards.filter(vietnamese_meaning='').exists()
            reports.append({'language': language, 'owner': owner.username, 'folders': folders.count(),
                            'decks': decks.count(), 'cards': cards.count(),
                            'decks_per_folder': [min(f.total for f in folders), max(f.total for f in folders)],
                            'cards_per_deck': [min(d.total for d in decks), max(d.total for d in decks)],
                            'created': created})
    print(json.dumps(reports, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
