"""Only executed by e2e-server against its newly created temporary SQLite DB."""
import uuid
from django.contrib.auth import get_user_model
from cards.models import Deck, Card
from users.models import Profile, Classroom, TeachingBoard
from api.teaching import initial
for name in ('e2e_learner', 'e2e_other', 'e2e_offline'):
    user = get_user_model().objects.create_user(name, password='E2eOnly!Password48')
    Profile.objects.create(user=user, preferences={'uiLanguage': 'en', 'interface': 'studio'})
    deck = Deck.objects.create(owner=user, title=f'{name} private vocabulary', language='en')
    Card.objects.create(deck=deck, german_text='apple', vietnamese_meaning='quả táo', position=0)
    Card.objects.create(deck=deck, german_text='train', vietnamese_meaning='tàu hỏa', position=1)
    if name == 'e2e_learner':
        Card.objects.bulk_create([Card(deck=deck, german_text=f'fixture term {i}', vietnamese_meaning=f'nghĩa {i}', position=i+2) for i in range(55)])
        room = Classroom.objects.create(owner=user, language='en', title='Private class members')
        TeachingBoard.objects.create(id=uuid.UUID('11111111-1111-4111-8111-111111111111'), classroom=room,
            title='E2E public lesson', state=initial(), public_enabled=True,
            public_token=uuid.UUID('22222222-2222-4222-8222-222222222222'))
