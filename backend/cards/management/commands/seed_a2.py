from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from cards.models import Deck, Card


class Command(BaseCommand):
    help = 'Tạo bộ thẻ A2 tự soạn cho một tài khoản hiện có; chạy lại không tạo trùng.'
    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
    def handle(self, *args, **options):
        try:
            user = get_user_model().objects.get(username=options['username'])
        except get_user_model().DoesNotExist:
            raise CommandError('Tài khoản chưa tồn tại. Hãy đăng ký hoặc tạo superuser trước.')
        deck, _ = Deck.objects.get_or_create(owner=user, title='Tiếng Đức A2 · Cuộc sống mỗi ngày', defaults={'level': 'A2', 'topic': 'Đời sống', 'description': 'Những từ nhỏ cho các cuộc trò chuyện hằng ngày.'})
        rows = [
            ('der Alltag', 'cuộc sống hằng ngày', 'Mein Alltag beginnt um sieben Uhr.', 'Ngày thường của tôi bắt đầu lúc bảy giờ.', 'danh từ', 'der', ''),
            ('die Wohnung', 'căn hộ', 'Unsere Wohnung hat zwei Zimmer.', 'Căn hộ của chúng tôi có hai phòng.', 'danh từ', 'die', 'Wohnungen'),
            ('der Termin', 'cuộc hẹn', 'Ich habe morgen einen Termin.', 'Ngày mai tôi có một cuộc hẹn.', 'danh từ', 'der', 'Termine'),
            ('das Fahrrad', 'xe đạp', 'Ich fahre mit dem Fahrrad zur Arbeit.', 'Tôi đi làm bằng xe đạp.', 'danh từ', 'das', 'Fahrräder'),
            ('einkaufen', 'mua sắm', 'Wir kaufen am Samstag ein.', 'Chúng tôi mua sắm vào thứ Bảy.', 'động từ', '', ''),
            ('warten', 'chờ đợi', 'Ich warte auf den Bus.', 'Tôi đang chờ xe buýt.', 'động từ', '', ''),
            ('erzählen', 'kể chuyện', 'Sie erzählt von ihrer Reise.', 'Cô ấy kể về chuyến đi của mình.', 'động từ', '', ''),
            ('vergessen', 'quên', 'Bitte vergiss den Schlüssel nicht.', 'Xin đừng quên chìa khóa.', 'động từ', '', ''),
            ('pünktlich', 'đúng giờ', 'Der Zug kommt heute pünktlich.', 'Hôm nay tàu đến đúng giờ.', 'tính từ', '', ''),
            ('gemütlich', 'ấm cúng', 'Das Café ist sehr gemütlich.', 'Quán cà phê rất ấm cúng.', 'tính từ', '', ''),
            ('günstig', 'giá phải chăng', 'Das Ticket ist günstig.', 'Vé có giá phải chăng.', 'tính từ', '', ''),
            ('unterwegs', 'đang trên đường', 'Ich bin schon unterwegs.', 'Tôi đã đang trên đường rồi.', 'trạng từ', '', ''),
        ]
        for i, (word, meaning, example, translation, pos, article, plural) in enumerate(rows):
            Card.objects.get_or_create(deck=deck, german_text=word, defaults={'vietnamese_meaning': meaning, 'example_german': example, 'example_vietnamese': translation, 'part_of_speech': pos, 'article': article, 'plural_form': plural, 'position': i})
        self.stdout.write(self.style.SUCCESS(f'Đã chuẩn bị bộ A2: {deck.cards.count()} thẻ.'))
