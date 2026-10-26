from copy import deepcopy

from django.contrib.auth import get_user_model
from django.test import TestCase

from content.models import ContentPolicy
from practice.models import ReadingFolder, ReadingLesson, ReadingProgress, PracticeMedia
from .content_merge import publisher
from .practice_hub import validate_payload
from .practice_media import media_data


class ReadingManagementTests(TestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_user('reading-library-owner')
        self.other = get_user_model().objects.create_user('reading-library-other')
        self.client.force_login(self.owner)
        self.base = '/api/en/reading/'
        self.payload = validate_payload('exercise', {
            'kind': 'choice', 'context': 'We travel by bus.',
            'presentation': {'interaction': 'reading', 'style': 'split_reading'},
            'questions': [{'prompt': 'How?', 'options': ['Bus', 'Car'], 'accepted_answers': ['Bus']}],
        })
        self.root = self.folder('Root')
        self.child = self.folder('Child', self.root)
        self.target = self.folder('Target')
        self.lesson = self.reading('Original', self.child)
        self.foreign = ReadingFolder.objects.create(owner=self.other, language='en', title='Other')
        self.german = ReadingFolder.objects.create(owner=self.owner, language='de', title='German')

    def folder(self, title, parent=None):
        return ReadingFolder.objects.create(owner=self.owner, language='en', title=title, parent=parent)

    def reading(self, title, folder=None, **extra):
        return ReadingLesson.objects.create(owner=self.owner, language='en', title=title,
            folder=folder, payload=deepcopy(self.payload), completed=['1'], **extra)

    def post(self, path, data, **headers):
        return self.client.post(self.base + path, data, content_type='application/json', **headers)

    def patch(self, path, data, **headers):
        return self.client.patch(self.base + path, data, content_type='application/json', **headers)

    def test_batch_import_selected_folder_and_metadata(self):
        response = self.post('', {'folder_id': self.child.pk, 'lessons': [
            {'title': 'One', 'payload': self.payload}, {'title': 'Two', 'payload': self.payload}]})
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual({row['folder_id'] for row in response.json()['lessons']}, {self.child.pk})
        rows = self.client.get(self.base).json()['lessons']
        self.assertIn('visibility', rows[0]); self.assertIn('level', rows[0]); self.assertIn('topic', rows[0])
        detail = self.client.get(self.base + f'{self.lesson.pk}/').json()
        self.assertEqual(detail['folder_id'], self.child.pk)
        for folder in [self.foreign.pk, self.german.pk, True, '1', 0]:
            before = ReadingLesson.objects.count()
            rejected = self.post('', {'folder_id': folder, 'lessons': [{'title': 'Forbidden', 'payload': self.payload}]})
            self.assertIn(rejected.status_code, [400, 404])
            self.assertEqual(ReadingLesson.objects.count(), before)

    def test_import_bad_lesson_rolls_back_entire_folder_batch(self):
        before = ReadingLesson.objects.count()
        response = self.post('', {'folder_id': self.target.pk, 'lessons': [
            {'title': 'Valid', 'payload': self.payload}, {'title': 'Invalid', 'payload': {}}]})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(ReadingLesson.objects.count(), before)

    def test_folder_create_rename_move_and_cycle_guard(self):
        response = self.post('folders/', {'title': '  New  ', 'parent_id': self.child.pk})
        self.assertEqual(response.status_code, 201, response.content)
        created = response.json()['folder']
        self.assertEqual(created['title'], 'New'); self.assertEqual(created['parent_id'], self.child.pk)
        response = self.patch(f"folders/{created['id']}/", {'title': 'Renamed', 'parent_id': self.target.pk})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['folder']['parent_id'], self.target.pk)
        for parent in [self.root.pk, self.child.pk]:
            response = self.patch(f'folders/{self.root.pk}/', {'title': 'Should rollback', 'parent_id': parent})
            self.assertEqual(response.status_code, 400)
            self.root.refresh_from_db(); self.assertEqual(self.root.title, 'Root')
            self.assertIsNone(self.root.parent_id)

    def test_folder_owner_language_and_ancestor_scope(self):
        for target in [self.foreign, self.german]:
            self.assertEqual(self.patch(f'folders/{target.pk}/', {'title': 'Forbidden'}).status_code, 404)
            self.assertEqual(self.client.delete(self.base + f'folders/{target.pk}/').status_code, 404)
            self.assertEqual(self.post('folders/', {'title': 'New', 'parent_id': target.pk}).status_code, 404)
        malformed = self.folder('Malformed', self.foreign)
        self.assertEqual(self.post('folders/', {'title': 'New', 'parent_id': malformed.pk}).status_code, 400)
        self.client.logout()
        self.assertEqual(self.post('folders/', {'title': 'Anonymous'}).status_code, 401)

    def test_folder_depth_includes_moved_subtree(self):
        parent = self.root
        for number in range(18):
            parent = self.folder(str(number), parent)
        response = self.post('folders/', {'title': 'Twentieth', 'parent_id': parent.pk})
        self.assertEqual(response.status_code, 201, response.content)
        last = response.json()['folder']['id']
        self.assertEqual(self.post('folders/', {'title': 'Too deep', 'parent_id': last}).status_code, 400)
        branch = self.folder('Branch')
        self.folder('Grandchild', branch)
        response = self.patch(f'folders/{branch.pk}/', {'parent_id': parent.pk})
        self.assertEqual(response.status_code, 400)
        branch.refresh_from_db(); self.assertIsNone(branch.parent_id)

    def test_folder_delete_rehomes_descendant_lessons_preserving_progress(self):
        nested = self.folder('Nested', self.child)
        deep = self.reading('Deep', nested)
        before = {row.pk: (row.updated_at, deepcopy(row.payload), list(row.completed)) for row in [self.lesson, deep]}
        progress = ReadingProgress.objects.create(user=self.other, lesson=deep,
            revision=deep.updated_at.isoformat(), completed=['1'])
        response = self.client.delete(self.base + f'folders/{self.child.pk}/')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertFalse(ReadingFolder.objects.filter(pk__in=[self.child.pk, nested.pk]).exists())
        for item in [self.lesson, deep]:
            item.refresh_from_db()
            self.assertEqual(item.folder_id, self.root.pk)
            self.assertEqual((item.updated_at, item.payload, item.completed), before[item.pk])
        progress.refresh_from_db(); self.assertEqual(progress.completed, ['1'])
        self.assertTrue(ReadingFolder.objects.filter(pk=self.root.pk).exists())
        self.assertEqual(self.client.delete(self.base + f'folders/{self.root.pk}/').status_code, 200)
        deep.refresh_from_db(); self.assertIsNone(deep.folder_id)

    def test_folder_delete_refuses_foreign_relations(self):
        bad = ReadingFolder.objects.create(owner=self.other, language='en', title='Bad relation', parent=self.child)
        self.assertEqual(self.client.delete(self.base + f'folders/{self.child.pk}/').status_code, 400)
        self.assertTrue(ReadingFolder.objects.filter(pk=bad.pk).exists())
        bad.delete()
        wrong = ReadingLesson.objects.create(owner=self.other, language='en', title='Other lesson',
            folder=self.child, payload=self.payload)
        self.assertEqual(self.client.delete(self.base + f'folders/{self.child.pk}/').status_code, 400)
        wrong.refresh_from_db(); self.assertEqual(wrong.folder_id, self.child.pk)

    def test_metadata_preserves_revision_payload_and_both_progress_stores(self):
        before = (self.lesson.updated_at, deepcopy(self.lesson.payload), list(self.lesson.completed))
        external = ReadingProgress.objects.create(user=self.other, lesson=self.lesson,
            revision=self.lesson.updated_at.isoformat(), completed=['1'])
        response = self.patch(f'{self.lesson.pk}/metadata/', {'title': 'Renamed', 'folder_id': self.target.pk})
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['folder_id'], self.target.pk)
        self.lesson.refresh_from_db()
        self.assertEqual(self.lesson.title, 'Renamed')
        self.assertEqual((self.lesson.updated_at, self.lesson.payload, self.lesson.completed), before)
        external.refresh_from_db(); self.assertEqual(external.completed, ['1'])
        for invalid in ['', 'x' * 201, 123]:
            self.assertEqual(self.patch(f'{self.lesson.pk}/metadata/', {'title': invalid}).status_code, 400)
        self.assertEqual(self.patch(f'{self.lesson.pk}/metadata/', {'title': 'Rollback', 'folder_id': self.foreign.pk}).status_code, 404)
        self.lesson.refresh_from_db(); self.assertEqual(self.lesson.title, 'Renamed')
        self.assertEqual(self.patch(f'{self.lesson.pk}/metadata/', {'payload': {}}).status_code, 400)

    def test_batch_move_is_scoped_atomic_and_keeps_progress(self):
        second = self.reading('Second')
        revisions = {row.pk: row.updated_at for row in [self.lesson, second]}
        response = self.post('organize/', {'action': 'move', 'ids': [self.lesson.pk, second.pk], 'folder_id': self.target.pk})
        self.assertEqual(response.status_code, 200, response.content)
        for row in [self.lesson, second]:
            row.refresh_from_db(); self.assertEqual(row.folder_id, self.target.pk)
            self.assertEqual(row.updated_at, revisions[row.pk]); self.assertEqual(row.completed, ['1'])
        other = ReadingLesson.objects.create(owner=self.other, language='en', title='Other', payload=self.payload)
        response = self.post('organize/', {'action': 'move', 'ids': [self.lesson.pk, other.pk], 'folder_id': None})
        self.assertEqual(response.status_code, 404)
        self.lesson.refresh_from_db(); self.assertEqual(self.lesson.folder_id, self.target.pk)
        self.assertEqual(self.post('organize/', {'action': 'move', 'ids': [self.lesson.pk], 'folder_id': self.german.pk}).status_code, 404)

    def test_copy_keeps_validated_media_but_not_source_identity_or_progress(self):
        asset = PracticeMedia.objects.create(owner=self.owner, language='en', name='Photo.png',
            file='existing-shared-photo.png', size=1, content_type='image/png')
        self.lesson.payload['attachments'] = [media_data(asset)]
        self.lesson.visibility = 'public'; self.lesson.source_key = 'community:123'
        self.lesson.level = 'A2'; self.lesson.topic = 'Travel'; self.lesson.save()
        self.lesson.attachments.add(asset)
        ContentPolicy.objects.update_or_create(pk=1, defaults={'mode': 'public'})
        response = self.post('organize/', {'action': 'copy', 'ids': [self.lesson.pk], 'folder_id': self.target.pk})
        self.assertEqual(response.status_code, 200, response.content)
        clone = ReadingLesson.objects.get(pk=response.json()['ids'][0])
        self.assertEqual(clone.folder_id, self.target.pk)
        self.assertEqual(clone.visibility, 'private'); self.assertEqual(clone.source_key, '')
        self.assertEqual(clone.completed, []); self.assertFalse(ReadingProgress.objects.filter(lesson=clone).exists())
        self.assertEqual(clone.payload, self.lesson.payload)
        self.assertEqual(clone.attachments.get().pk, asset.pk)
        self.assertEqual((clone.level, clone.topic), ('A2', 'Travel'))
        self.assertEqual(PracticeMedia.objects.count(), 1)
        self.lesson.refresh_from_db(); self.assertEqual(self.lesson.completed, ['1'])

    def test_copy_validation_failure_rolls_back_all_clones(self):
        foreign = PracticeMedia.objects.create(owner=self.other, language='en', name='Other.png',
            file='existing-other-photo.png', size=1, content_type='image/png')
        broken = self.reading('Invalid media')
        broken.payload['attachments'] = [media_data(foreign)]; broken.save()
        before = ReadingLesson.objects.count()
        response = self.post('organize/', {'action': 'copy', 'ids': [self.lesson.pk, broken.pk]})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(ReadingLesson.objects.count(), before)

    def test_delete_and_batch_bounds(self):
        for ids in [[], [True], [0], ['1'], [self.lesson.pk, self.lesson.pk], list(range(1, 102))]:
            self.assertEqual(self.post('organize/', {'action': 'delete', 'ids': ids}).status_code, 400)
        self.assertEqual(self.post('organize/', {'action': 'bad', 'ids': [self.lesson.pk]}).status_code, 400)
        response = self.post('organize/', {'action': 'delete', 'ids': [self.lesson.pk, 999999]})
        self.assertEqual(response.status_code, 404)
        self.assertTrue(ReadingLesson.objects.filter(pk=self.lesson.pk).exists())
        self.assertEqual(self.post('organize/', {'action': 'delete', 'ids': [self.lesson.pk]}).status_code, 200)
        self.assertFalse(ReadingLesson.objects.filter(pk=self.lesson.pk).exists())

    def test_shared_staff_revision_and_copy_boundaries(self):
        staff = get_user_model().objects.create_user('reading-staff', is_staff=True)
        shared = publisher(create=True)
        reading = ReadingLesson.objects.create(owner=shared, language='en', title='Shared', payload=self.payload)
        self.client.force_login(staff)
        response = self.client.get(self.base)
        revision = response.headers['X-Wortify-Revision']
        url = f'{reading.pk}/metadata/'
        self.assertEqual(self.patch(url, {'title': 'No revision'}).status_code, 409)
        response = self.patch(url, {'title': 'Edited'}, HTTP_X_WORTIFY_REVISION=revision)
        self.assertEqual(response.status_code, 200, response.content)
        reading.refresh_from_db(); self.assertEqual(reading.title, 'Edited')
        self.assertEqual(self.patch(f'{self.lesson.pk}/metadata/', {'title': 'Wrong owner'},
            HTTP_X_WORTIFY_REVISION=response.headers['X-Wortify-Revision']).status_code, 404)
        revision = self.client.get(self.base).headers['X-Wortify-Revision']
        response = self.post('organize/', {'action': 'copy', 'ids': [reading.pk]}, HTTP_X_WORTIFY_REVISION=revision)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Personal sandbox', response.json()['error'])
