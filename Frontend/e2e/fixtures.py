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

# Practice scenarios own their user and use only this disposable test database.
from practice.models import PracticeNode
from api.content_text import parse_lesson
practice_user = get_user_model().objects.create_user('e2e_practice', password='E2eOnly!Password48')
Profile.objects.create(user=practice_user, preferences={'uiLanguage': 'en', 'interface': 'studio'})
practice_folder = PracticeNode.objects.create(owner=practice_user, language='en', kind='folder', title='E2E Practice folder')
practice_sources = [
'''EXERCISE: E2E grouped repeated words
TYPE: cloze_drag_drop
STYLE: tap_fill
BANK_SCOPE: exercise
QUESTION: She {{1}} a teacher.
BLANK: is => is | was
WORDS: is | was
HINT: Use the present tense.
EXPLANATION: She takes is in the present tense.
QUESTION: He {{1}} a doctor.
BLANK: is => is | were
WORDS: is | were
EXPLANATION: He takes is in the present tense.
''',
'''EXERCISE: E2E self check
TYPE: multiple_choice
STYLE: dialogue_reply
QUESTION: What would you like to drink?
OPTIONS: Tea | Yesterday | At home
ANSWER: Tea
HINT: Choose a drink.
EXPLANATION: Tea is a drink.
DISTRACTOR_EXPLANATION: Yesterday is a time and at home is a place.
QUESTION: Where do you live?
OPTIONS: In London | Tomorrow | Coffee
ANSWER: In London
EXPLANATION: London is a place.
''',
'''EXERCISE: E2E legacy judgment
TYPE: true_false_not_given
STYLE: evidence_judge
CONTEXT: Mia lives in Berlin.
QUESTION: Mia lives in Berlin.
OPTIONS: TRUE | FALSE | NOT_GIVEN
ANSWER: TRUE
''',
]
for source in practice_sources:
    payload = parse_lesson(list(enumerate(source.strip().splitlines(), 1)))
    PracticeNode.objects.create(owner=practice_user, language='en', kind='exercise', parent=practice_folder,
                                title=payload['title'], payload=payload)
