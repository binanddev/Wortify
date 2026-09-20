import json
from django.test import TestCase
from django.contrib.auth import get_user_model
from users.models import Classroom, Review
from practice.models import Chapter, Exercise, Question, Attempt
from content.models import Book

@__import__('django.test',fromlist=['override_settings']).override_settings(COMMUNITY_ENABLED=True)
class CommunityTests(TestCase):
 @classmethod
 def setUpTestData(cls):
  cls.student=get_user_model().objects.create_user('student')
  cls.teacher=get_user_model().objects.create_user('teacher')
  cls.stranger=get_user_model().objects.create_user('stranger')
  c=Chapter.objects.create(book=Book.objects.get(slug='english-a1'),number=1,title='Writing',page_start=1)
  cls.exercise=Exercise.objects.create(chapter=c,number='1',title='Introduce yourself',source_page=1,reviewed=True,check_mode='manual_check')
  Question.objects.create(exercise=cls.exercise,position=1,prompt='Write',accepted_answers=[])
  cls.attempt=Attempt.objects.create(user=cls.student,exercise=cls.exercise,total=1,answers=[{'prompt':'Write','answer':'Hello','correct':None,'expected':[],'label':''}],status='pending_manual')
 def send(self,path,data,method='post'):
  return getattr(self.client,method)(path,json.dumps(data),content_type='application/json')
 def test_every_user_can_create_join_and_language_scope(self):
  self.client.force_login(self.teacher)
  c=self.send('/api/en/classes/',{'title':'English club'}).json()
  detail=self.client.get(f'/api/en/classes/{c["id"]}/').json()
  self.client.force_login(self.student)
  self.assertEqual(self.send('/api/en/classes/',{'title':'My own class'}).status_code,201)
  self.assertEqual(self.send('/api/de/classes/',{'invite':detail['invite']}).status_code,404)
  self.assertEqual(self.send('/api/en/classes/',{'invite':detail['invite']}).status_code,201)
  member=self.client.get(f'/api/en/classes/{c["id"]}/').json()
  self.assertIsNone(member['invite']);self.assertEqual(member['members'],[])
  self.assertEqual(self.send(f'/api/en/classes/{c["id"]}/',{'title':'Hijack'},'patch').status_code,403)
 def test_grade_permissions_range_and_snapshot(self):
  self.client.force_login(self.student)
  r=self.send('/api/en/reviews/',{'attempt':self.attempt.pk,'reviewer':'teacher'}).json()
  url=f'/api/en/reviews/{r["id"]}/'
  self.assertEqual(self.send(url,{'score':8},'patch').status_code,403)
  self.client.force_login(self.stranger)
  self.assertEqual(self.client.get(url).status_code,404)
  self.client.force_login(self.teacher)
  self.assertEqual(self.client.get(url).json()['answers'][0]['answer'],'Hello')
  self.assertEqual(self.client.get(url.replace('/en/','/de/')).status_code,404)
  for score in ['NaN',11,-1,'bad']:
   self.assertEqual(self.send(url,{'score':score},'patch').status_code,400)
  self.assertEqual(self.send(url,{'score':'8.5','feedback':'Good'},'patch').status_code,200)
  self.attempt.refresh_from_db();self.assertEqual(self.attempt.status,'graded')
  self.assertEqual(self.attempt.answers[0]['answer'],'Hello')
  self.client.force_login(self.student)
  self.assertEqual(self.client.get(f'/api/en/results/{self.attempt.pk}/').json()['review']['score'],'8.50')
  self.assertEqual(self.send('/api/en/reviews/',{'attempt':self.attempt.pk,'reviewer':'teacher'}).json()['id'],r['id'])
 def test_class_submission_requires_membership(self):
  c=Classroom.objects.create(owner=self.teacher,language='en',title='Class')
  self.client.force_login(self.student)
  self.assertEqual(self.send('/api/en/reviews/',{'attempt':self.attempt.pk,'classroom':c.pk}).status_code,404)
  c.members.add(self.student)
  self.assertEqual(self.send('/api/en/reviews/',{'attempt':self.attempt.pk,'classroom':c.pk}).status_code,201)
  self.client.force_login(self.stranger)
  self.assertEqual(self.client.get(f'/api/en/classes/{c.pk}/').status_code,404)
 def test_profile_only_own_language_history(self):
  self.client.force_login(self.student)
  self.assertEqual(len(self.client.get('/api/en/profile/').json()['history']),1)
  self.assertEqual(self.client.get('/api/de/profile/').json()['history'],[])
  self.assertEqual(self.send('/api/en/profile/',{'display_name':'Student','bio':'Learning'},'patch').status_code,200)
  self.client.force_login(self.stranger)
  self.assertEqual(self.client.get('/api/en/profile/').json()['history'],[])
  self.assertEqual(self.client.get('/api/en/profile/').json()['display_name'],'')
