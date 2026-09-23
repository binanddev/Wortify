import json
import uuid
from datetime import datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from cards.models import Deck, Card, LearningEvent, StudyAttempt, StudySession, StudyProgress
from practice.models import PracticeNode, PracticeAttempt
from users.models import Profile
from .profile_data import streaks


class ProfileDashboardTests(TestCase):
    def setUp(self):
        self.user=get_user_model().objects.create_user('profile-learner')
        self.other=get_user_model().objects.create_user('different-learner')
        self.client.force_login(self.user)
        self.deck=Deck.objects.create(owner=self.user,language='de',title='Deutsch')
        self.card=Card.objects.create(deck=self.deck,german_text='Wasser',vietnamese_meaning='nước')
        self.now=datetime(2026,9,22,5,tzinfo=dt_timezone.utc)

    def event(self,kind,day=22,language='de',user=None,payload=None,result=None):
        event=LearningEvent.objects.create(user=user or self.user,language=language,token=uuid.uuid4(),kind=kind,payload=payload or {},result=result or {})
        LearningEvent.objects.filter(pk=event.pk).update(created_at=self.now.replace(day=day))
        return event

    def dashboard(self):
        with patch('api.profile_data.timezone.now',return_value=self.now):
            response=self.client.get('/api/de/profile/')
        self.assertEqual(response.status_code,200,response.content)
        return response.json()

    def test_counts_real_activity_once_and_keeps_accounts_languages_separate(self):
        self.event('review',payload={'correct':True})
        self.event('test',result={'correct':2,'total':3,'deck':self.deck.pk,'title':'Deutsch'})
        self.event('practice',result={'score':1,'total':2})
        self.event('star')
        self.event('review',language='en',payload={'correct':True})
        self.event('review',user=self.other,payload={'correct':True})
        node=PracticeNode.objects.create(owner=self.user,language='de',title='Grüße',kind='exercise')
        attempt=PracticeAttempt.objects.create(user=self.user,node=node,token=uuid.uuid4(),answers={},result={'score':1,'total':2})
        PracticeAttempt.objects.filter(pk=attempt.pk).update(created_at=self.now)
        StudyAttempt.objects.create(user=self.user,card=self.card,mode='write',completed_at=self.now,is_correct=True)
        StudySession.objects.create(user=self.user,language='de',kind='learn',deck=self.deck,completed_at=self.now,result={'correct':1,'total':1})
        data=self.dashboard()
        self.assertEqual(data['today_questions'],7)
        self.assertEqual(data['periods']['7'],{'questions':7,'correct':5,'accuracy':71,'active_days':1,'completed':3})
        self.assertEqual(len(data['timeline']),3)
        self.assertEqual(data['streak'],1)

    def test_streak_uses_local_day_and_does_not_count_settings(self):
        for day in (19,20,21):self.event('review',day=day,payload={'correct':True})
        self.event('preferences')
        # UTC Sunday evening belongs to Monday in Vietnam.
        event=self.event('review',payload={'correct':True})
        LearningEvent.objects.filter(pk=event.pk).update(created_at=datetime(2026,9,20,18,tzinfo=dt_timezone.utc))
        data=self.dashboard()
        self.assertEqual(data['today_questions'],0)
        self.assertEqual(data['streak'],3)
        monday=next(d for d in data['calendar'] if d['date']=='2026-09-21')
        self.assertEqual(monday['total'],2)
        self.assertTrue(any(d['future'] for d in data['calendar']))
        self.assertEqual(streaks({self.now.date()-timedelta(days=3)},self.now.date()),(0,1))

    def test_goal_patch_preserves_profile_and_is_per_language(self):
        Profile.objects.create(user=self.user,display_name='Tên cũ',bio='Giới thiệu',preferences={'sound':True})
        response=self.client.patch('/api/de/profile/',json.dumps({'daily_goal':12}),content_type='application/json')
        self.assertEqual(response.status_code,200,response.content)
        p=Profile.objects.get(user=self.user)
        self.assertEqual(p.display_name,'Tên cũ');self.assertEqual(p.bio,'Giới thiệu')
        self.assertEqual(p.preferences['sound'],True)
        self.assertEqual(self.client.get('/api/de/profile/').json()['daily_goal'],12)
        self.assertEqual(self.client.get('/api/en/profile/').json()['daily_goal'],20)
        for value in (0,501,True,'12'):
            self.assertEqual(self.client.patch('/api/de/profile/',json.dumps({'daily_goal':value}),content_type='application/json').status_code,400)

    def test_empty_account_and_bounded_queries_with_many_decks(self):
        empty=self.dashboard()
        self.assertEqual(empty['periods']['30']['accuracy'],None)
        self.assertEqual(empty['streak'],0)
        self.assertEqual(empty['timeline'],[])
        for i in range(12):
            deck=Deck.objects.create(owner=self.user,language='de',title=f'Deck {i}')
            card=Card.objects.create(deck=deck,german_text='Hallo',vietnamese_meaning='xin chào')
            StudyProgress.objects.create(user=self.user,card=card,state='mastered',due_at=self.now-timedelta(days=1))
        with CaptureQueriesContext(connection) as queries:
            data=self.dashboard()
        self.assertLessEqual(len(queries),24)
        self.assertEqual(len(data['decks']),3)
        self.assertEqual(data['cards']['mastered'],12)
        self.assertEqual(data['cards']['due'],12)
        self.assertEqual(data['cards']['new'],1)
