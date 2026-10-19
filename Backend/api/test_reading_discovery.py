from copy import deepcopy
from django.test import TestCase
from django.contrib.auth import get_user_model
from practice.models import ReadingLesson, SystemContentPackage, PracticeMedia
from api.practice_hub import validate_payload
from api.content_packages import validate_document


class ReadingDiscoveryTests(TestCase):
    def setUp(self):
        self.author = get_user_model().objects.create_user('author')
        self.reader = get_user_model().objects.create_user('reader')
        self.payload = validate_payload('exercise', {'kind':'choice','context':'We travel by bus.', 'presentation':{'interaction':'reading','style':'split_reading'},'questions':[{'prompt':'How do we travel?','options':['Bus','Car'],'accepted_answers':['Bus']}]})
        self.lesson = ReadingLesson.objects.create(owner=self.author, language='en', title='Bus trip', payload=self.payload)
        self.client.force_login(self.author)
        self.share = f'/api/en/reading/{self.lesson.pk}/sharing/'
        self.catalog = '/api/en/reading/discover/'
        self.open = f'/api/en/reading/discover/open/?key=community:{self.lesson.pk}'

    def publish(self):
        response = self.client.patch(self.share, {'visibility':'public','level':'A2','topic':'Travel'}, content_type='application/json')
        self.assertEqual(response.status_code, 200, response.content)

    def test_private_default_publish_filter_and_revoke(self):
        self.assertEqual(self.client.get(self.catalog).json()['total'], 0)
        self.assertEqual(self.client.get(self.open).status_code, 404)
        self.publish()
        self.client.force_login(self.reader)
        self.assertEqual(self.client.get(self.catalog+'?q=bus&level=A2&topic=Travel&source=community').json()['total'], 1)
        self.assertEqual(self.client.get(self.catalog+'?level=B1').json()['total'], 0)
        self.assertEqual(self.client.get(self.catalog.replace('/en/','/de/')).json()['total'], 0)
        result = self.client.get(self.open).json()
        self.assertEqual(result['payload']['context'], 'We travel by bus.')
        self.assertNotIn('progress', result)
        self.assertNotIn('owner', result)
        self.assertEqual(self.client.patch(self.share, {'visibility':'private'}, content_type='application/json').status_code, 404)
        self.client.force_login(self.author)
        self.client.patch(self.share, {'visibility':'private'}, content_type='application/json')
        self.assertEqual(self.client.get(self.open).status_code, 404)

    def test_validation_and_revision_preservation(self):
        revision = self.lesson.updated_at
        for data in ({'visibility':'invalid'}, {'visibility':'public','level':'A9'}, {'visibility':'public','topic':'x'*81}):
            self.assertEqual(self.client.patch(self.share,data,content_type='application/json').status_code,400)
        self.publish()
        self.lesson.refresh_from_db()
        self.assertEqual(self.lesson.updated_at, revision)

    def test_system_nested_lessons_and_metadata(self):
        import uuid
        document = {'format':'wortify-content','version':1,'id':str(uuid.uuid4()),'title':'System','language':'en','reading':[{'kind':'folder','title':'Travel','children':[{'kind':'reading','title':'Train trip','level':'B1','topic':'Travel','payload':deepcopy(self.payload)}]}]}
        document, counts = validate_document(document)
        package = SystemContentPackage.objects.create(id=document['id'],title='System',language='en',document=document,counts=counts,digest='x')
        result = self.client.get(self.catalog+'?level=B1&source=system').json()
        self.assertEqual(result['total'], 1)
        self.assertEqual(result['topics'], ['Travel'])
        key=result['lessons'][0]['key']
        self.assertEqual(self.client.get('/api/en/reading/discover/open/',{'key':key}).json()['title'],'Train trip')
        self.assertEqual(self.client.get('/api/en/reading/discover/open/',{'key':f'system:{package.pk}:9'}).status_code,404)

    def test_public_media_and_revocation(self):
        item=PracticeMedia.objects.create(owner=self.author,language='en',name='photo.png',size=1,content_type='image/png',file='unused-test-path.png')
        self.lesson.payload['attachments']=[{'id':str(item.pk)}]
        self.lesson.save()
        self.publish()
        self.client.force_login(self.reader)
        url=f'/api/en/practice-hub/media/{item.pk}/'
        self.assertEqual(self.client.head(url).status_code,200)
        self.client.force_login(self.author)
        self.client.patch(self.share,{'visibility':'private'},content_type='application/json')
        self.client.force_login(self.reader)
        self.assertEqual(self.client.head(url).status_code,404)

    def test_pagination_and_staff_attribution(self):
        self.author.is_staff=True
        self.author.save()
        ReadingLesson.objects.bulk_create([ReadingLesson(owner=self.author,language='en',title=f'Lesson {i}',payload={},visibility='public') for i in range(25)])
        result=self.client.get(self.catalog+'?source=system').json()
        self.assertEqual(result['total'],25)
        self.assertEqual(len(result['lessons']),24)
        self.assertEqual(len(self.client.get(self.catalog+'?page=2').json()['lessons']),1)
        self.client.logout()
        self.assertEqual(self.client.get(self.catalog).status_code,200)

    def test_save_personal_copy_progress_and_retry(self):
        self.publish()
        self.client.force_login(self.reader)
        url='/api/en/reading/discover/save/'
        response=self.client.post(url,{'key':f'community:{self.lesson.pk}'},content_type='application/json')
        self.assertEqual(response.status_code,201,response.content)
        pk=response.json()['id']
        copy=ReadingLesson.objects.get(pk=pk)
        self.assertEqual(copy.owner,self.reader)
        self.assertEqual(copy.visibility,'private')
        self.assertEqual(copy.level,'A2')
        detail=self.client.get(f'/api/en/reading/{pk}/').json()
        self.assertEqual(self.client.post(f'/api/en/reading/{pk}/',{'revision':detail['revision'],'completed':['1']},content_type='application/json').status_code,200)
        self.lesson.refresh_from_db();self.assertEqual(self.lesson.completed,[])
        again=self.client.post(url,{'key':f'community:{self.lesson.pk}'},content_type='application/json')
        self.assertEqual(again.json()['id'],pk)
        self.assertEqual(ReadingLesson.objects.filter(owner=self.reader).count(),1)
        self.assertEqual(self.client.get(self.catalog).json()['lessons'][0]['saved_id'],pk)
        self.lesson.visibility='private';self.lesson.save()
        self.assertEqual(self.client.get(f'/api/en/reading/{pk}/').status_code,200)
        self.assertEqual(self.client.post(url,{'key':f'community:{self.lesson.pk}'},content_type='application/json').json()['id'],pk)

    def test_private_and_other_language_cannot_be_saved(self):
        self.client.force_login(self.reader)
        self.assertEqual(self.client.post('/api/en/reading/discover/save/',{'key':f'community:{self.lesson.pk}'},content_type='application/json').status_code,404)
        self.lesson.visibility='public';self.lesson.save()
        self.assertEqual(self.client.post('/api/de/reading/discover/save/',{'key':f'community:{self.lesson.pk}'},content_type='application/json').status_code,404)

    def test_saved_media_survives_source_deletion(self):
        from api.practice_media import media_data
        asset=PracticeMedia.objects.create(owner=self.author,language='en',name='pic.png',size=1,content_type='image/png',file='shared-pic.png')
        self.lesson.payload['attachments']=[media_data(asset)]
        self.lesson.payload['context']='<img src="'+media_data(asset)['url']+'">We travel by bus.'
        self.lesson.save();self.publish()
        self.client.force_login(self.reader)
        saved=self.client.post('/api/en/reading/discover/save/',{'key':f'community:{self.lesson.pk}'},content_type='application/json').json()
        copy=ReadingLesson.objects.get(pk=saved['id']);clone=copy.attachments.get()
        self.assertEqual(clone.owner,self.reader)
        self.assertNotEqual(clone.pk,asset.pk)
        self.assertIn(media_data(clone)['url'],copy.payload['context'])
        self.lesson.delete()
        self.assertEqual(self.client.head(media_data(clone)['url']).status_code,200)

    def test_save_system_then_copy_package_reuses_reading(self):
        import uuid
        document={'format':'wortify-content','version':1,'id':str(uuid.uuid4()),'title':'Travel','language':'en','reading':[{'kind':'reading','title':'Bus','payload':deepcopy(self.payload)}]}
        document,counts=validate_document(document)
        package=SystemContentPackage.objects.create(id=document['id'],title='Travel',language='en',document=document,counts=counts,digest='test')
        self.client.force_login(self.reader)
        key=f'system:{package.pk}:0'
        result=self.client.post('/api/en/reading/discover/save/',{'key':key},content_type='application/json')
        self.assertEqual(result.status_code,201,result.content)
        self.client.post(f'/api/en/system-library/{package.pk}/copy/',{},content_type='application/json')
        self.assertEqual(ReadingLesson.objects.filter(owner=self.reader).count(),1)
        self.assertEqual(self.client.post('/api/en/reading/discover/save/',{'key':key},content_type='application/json').json()['id'],result.json()['id'])
