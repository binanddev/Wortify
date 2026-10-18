from django.test import TestCase
from django.contrib.auth import get_user_model
from cards.models import Deck
from practice.models import PracticeNode, ReadingLesson

class ContentPolicyTests(TestCase):
    def setUp(self):
        self.staff = get_user_model().objects.create_user('policy-staff', is_staff=True)
        self.user = get_user_model().objects.create_user('policy-user')
        self.deck = Deck.objects.create(owner=self.user, language='de', title='Private deck')
        self.practice = PracticeNode.objects.create(owner=self.user, language='de', kind='folder', title='Private folder')
        self.reading = ReadingLesson.objects.create(owner=self.user, language='de', title='Private reading')

    def change(self, mode):
        return self.client.patch('/api/manage/content-policy/', {'mode':mode}, content_type='application/json')

    def test_staff_switch_publishes_existing_and_enforces_writes(self):
        self.client.force_login(self.staff)
        response = self.change('public')
        self.assertEqual(response.status_code, 200, response.content)
        for item in [self.deck, self.practice, self.reading]:
            item.refresh_from_db(); self.assertEqual(item.visibility, 'public')
            item.visibility='private'; item.save()
            item.refresh_from_db(); self.assertEqual(item.visibility, 'public')
            type(item).objects.filter(pk=item.pk).update(visibility='private')
            item.refresh_from_db(); self.assertEqual(item.visibility, 'public')
        new = Deck.objects.create(owner=self.user, language='de', title='New', visibility='private')
        self.assertEqual(new.visibility, 'public')
        bulk = ReadingLesson(owner=self.user, language='de', title='Imported')
        ReadingLesson.objects.bulk_create([bulk])
        bulk.refresh_from_db(); self.assertEqual(bulk.visibility,'public')
        bulk.visibility='private'
        ReadingLesson.objects.bulk_update([bulk], ['visibility'])
        bulk.refresh_from_db(); self.assertEqual(bulk.visibility,'public')

    def test_choice_does_not_unpublish_but_allows_private(self):
        self.client.force_login(self.staff)
        self.change('public'); self.change('choice')
        self.deck.refresh_from_db(); self.assertEqual(self.deck.visibility,'public')
        self.deck.visibility='private'; self.deck.save()
        self.deck.refresh_from_db(); self.assertEqual(self.deck.visibility,'private')

    def test_only_staff_or_superuser_may_change(self):
        self.client.force_login(self.user)
        self.assertEqual(self.change('public').status_code,403)
        self.assertEqual(self.client.get('/api/site/content-policy/').json()['mode'],'choice')
        self.client.logout()
        self.assertEqual(self.change('public').status_code,401)
        admin=get_user_model().objects.create_user('policy-admin',is_superuser=True)
        self.client.force_login(admin)
        self.assertEqual(self.change('public').status_code,200)
        self.assertEqual(self.change('bad').status_code,400)

    def test_learner_api_cannot_override_public_policy(self):
        self.client.force_login(self.staff)
        self.change('public')
        self.client.force_login(self.user)
        created=self.client.post('/api/de/decks/', {'title':'API deck','visibility':'private'}, content_type='application/json')
        self.assertEqual(created.status_code,201,created.content)
        pk=created.json()['id']
        changed=self.client.patch(f'/api/de/decks/{pk}/', {'visibility':'private'}, content_type='application/json')
        self.assertEqual(changed.status_code,200,changed.content)
        self.assertEqual(Deck.objects.get(pk=pk).visibility,'public')
        rows=self.client.get('/api/de/decks/').json()['decks']
        self.assertEqual(next(row for row in rows if row['id']==pk)['visibility'],'public')
