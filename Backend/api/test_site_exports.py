"""Contract and privacy tests for the superuser site export archive."""
import hashlib
import io
import json
import tempfile
import zipfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from cards.models import Card, Deck, Folder, StudyProgress
from practice.models import (
    PracticeMedia, PracticeNode, PracticeProgress, ReadingFolder,
    ReadingLesson, ReadingProgress, SystemContentPackage,
)


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class SiteExportTests(TestCase):
    def setUp(self):
        self.media_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.media_directory.cleanup)
        self.settings_override = override_settings(MEDIA_ROOT=self.media_directory.name)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        User = get_user_model()
        self.admin = User.objects.create_superuser('operator', password='test')
        self.owner = User.objects.create_user('author', email='author@example.com', password='test')
        self.other = User.objects.create_user('other', password='test')
        self.staff = User.objects.create_user('staff', is_staff=True)
        self.folder = Folder.objects.create(owner=self.owner, name='Vocabulary', language='de', theory_content='Folder explanation')
        self.deck = Deck.objects.create(owner=self.owner, folder=self.folder, title='Private words', language='de')
        self.card = Card.objects.create(deck=self.deck, german_text='Haus', vietnamese_meaning='Nhà', accepted_answers=['Haus', 'das Haus'])
        self.public = Deck.objects.create(owner=self.other, title='Public words', language='en', visibility='public')
        self.public_card = Card.objects.create(deck=self.public, german_text='house', vietnamese_meaning='Nhà')
        self.root = PracticeNode.objects.create(owner=self.owner, language='de', kind='folder', title='Exercises')
        self.exercise = PracticeNode.objects.create(owner=self.owner, parent=self.root, language='de', kind='exercise', title='Grammar', payload={'questions': [{'answer': 'der'}]})
        self.reading_folder = ReadingFolder.objects.create(owner=self.owner, language='de', title='Stories')
        self.reading = ReadingLesson.objects.create(owner=self.owner, folder=self.reading_folder, language='de', title='Story', payload={'text': 'Eine Geschichte', 'questions': [{'answer': 'ja'}]}, completed=['private-progress'])
        self.client.force_login(self.admin)

    def post(self, **options):
        return self.client.post('/api/manage/backups/site/', json.dumps({'scope': 'all', **options}), content_type='application/json')

    def export(self, **options):
        response = self.post(confirm='EXPORT', **options)
        self.assertEqual(response.status_code, 200, getattr(response, 'content', b''))
        self.assertIn('no-store', response['Cache-Control'])
        raw = b''.join(response.streaming_content)
        response.close()
        archive = zipfile.ZipFile(io.BytesIO(raw))
        self.addCleanup(archive.close)
        return archive

    def records(self, archive, model):
        name = f'data/{model}.json'
        return json.loads(archive.read(name)) if name in archive.namelist() else []

    def test_superuser_only_for_preview_and_download(self):
        for user in (self.owner, self.staff):
            self.client.force_login(user)
            self.assertEqual(self.post(preview=True).status_code, 403)
            self.assertEqual(self.post(confirm='EXPORT').status_code, 403)
        self.client.logout()
        self.assertIn(self.post(preview=True).status_code, (401, 403))

    def test_default_learning_export_preserves_all_content_and_joins(self):
        archive = self.export()
        self.assertEqual({r['pk'] for r in self.records(archive, 'cards.deck')}, {self.deck.pk, self.public.pk})
        card = next(r for r in self.records(archive, 'cards.card') if r['pk'] == self.card.pk)
        self.assertEqual(card['fields']['deck'], self.deck.pk)
        self.assertEqual(card['fields']['accepted_answers'], ['Haus', 'das Haus'])
        self.assertEqual(self.records(archive, 'cards.folder')[0]['fields']['theory_content'], 'Folder explanation')
        exercise = next(r for r in self.records(archive, 'practice.practicenode') if r['pk'] == self.exercise.pk)
        self.assertEqual(exercise['fields']['parent'], self.root.pk)
        self.assertEqual(exercise['fields']['payload']['questions'][0]['answer'], 'der')
        self.assertEqual(self.records(archive, 'practice.readinglesson')[0]['fields']['payload']['text'], 'Eine Geschichte')

    def test_detached_learning_export_excludes_structured_account_data_and_progress(self):
        archive = self.export(identity='anonymous')
        self.assertEqual(self.records(archive, 'auth.user'), [])
        self.assertEqual(self.records(archive, 'users.profile'), [])
        for name in archive.namelist():
            if name.startswith('data/') and name.endswith('.json'):
                for record in json.loads(archive.read(name)):
                    for field in ('owner', 'user', 'token'):
                        self.assertFalse(record['fields'].get(field), (name, field))
        self.assertFalse(self.records(archive, 'practice.readinglesson')[0]['fields'].get('completed'))

    def test_public_filter_excludes_private_roots_and_their_children(self):
        archive = self.export(visibility='public')
        self.assertEqual([r['pk'] for r in self.records(archive, 'cards.deck')], [self.public.pk])
        self.assertEqual([r['pk'] for r in self.records(archive, 'cards.card')], [self.public_card.pk])
        self.assertFalse(self.records(archive, 'practice.practicenode'))
        self.assertFalse(self.records(archive, 'practice.readinglesson'))
        self.assertNotIn(b'Folder explanation', b''.join(archive.read(n) for n in archive.namelist() if n.startswith('data/')))

    def test_selected_accounts_scope_and_module_filter(self):
        archive = self.export(scope='selected', ids=[self.owner.pk], modules=['cards'])
        self.assertEqual([r['pk'] for r in self.records(archive, 'cards.deck')], [self.deck.pk])
        self.assertFalse(self.records(archive, 'practice.practicenode'))
        self.assertFalse(self.records(archive, 'practice.readinglesson'))

    def test_language_filter_applies_to_content_and_children(self):
        archive = self.export(language='en')
        self.assertEqual([r['pk'] for r in self.records(archive, 'cards.deck')], [self.public.pk])
        self.assertEqual([r['pk'] for r in self.records(archive, 'cards.card')], [self.public_card.pk])
        self.assertFalse(self.records(archive, 'practice.practicenode'))
        self.assertFalse(self.records(archive, 'practice.readinglesson'))

    def test_linked_progress_includes_reading_and_other_learning_progress(self):
        ReadingProgress.objects.create(user=self.owner, lesson=self.reading, revision='v1', completed=['q1'])
        PracticeProgress.objects.create(user=self.owner, node=self.exercise, revision='v1', completed=['q2'])
        StudyProgress.objects.create(user=self.owner, card=self.card, correct_count=3)
        archive = self.export(identity='linked', include_progress=True)
        self.assertEqual(self.records(archive, 'practice.readingprogress')[0]['fields']['completed'], ['q1'])
        self.assertEqual(self.records(archive, 'practice.practiceprogress')[0]['fields']['node'], self.exercise.pk)
        self.assertEqual(self.records(archive, 'cards.studyprogress')[0]['fields']['correct_count'], 3)
        self.assertEqual(self.records(archive, 'cards.studyprogress')[0]['fields']['user'], self.owner.pk)
        mine = next(r for r in self.records(archive, 'cards.deck') if r['pk'] == self.deck.pk)
        self.assertEqual(mine['fields']['owner'], self.owner.pk)

    def test_accounts_only_has_no_learning_content_and_hashes_are_opt_in(self):
        archive = self.export(dataset='accounts', identity='linked', scope='selected', ids=[self.owner.pk])
        account = self.records(archive, 'auth.user')[0]
        self.assertEqual(account['fields']['username'], 'author')
        self.assertNotEqual(account['fields'].get('password'), self.owner.password)
        self.assertFalse(self.records(archive, 'cards.card'))
        self.assertFalse(self.records(archive, 'practice.practicenode'))
        archive = self.export(dataset='accounts', identity='linked', scope='selected', ids=[self.owner.pk], include_credentials=True)
        self.assertEqual(self.records(archive, 'auth.user')[0]['fields']['password'], self.owner.password)

    def test_uploaded_attachments_are_included_with_checksum_and_can_be_omitted(self):
        media = PracticeMedia.objects.create(owner=self.owner, language='de', file=SimpleUploadedFile('lesson.mp3', b'lesson-audio-bytes'), name='Audio', size=18, content_type='audio/mpeg')
        self.exercise.attachments.add(media)
        self.reading.attachments.add(media)
        archive = self.export()
        row = self.records(archive, 'practice.practicemedia')[0]
        self.assertEqual(archive.read(row['fields']['file']), b'lesson-audio-bytes')
        self.assertEqual(self.records(archive, 'practice.readinglesson')[0]['fields']['attachments'], [str(media.pk)])
        metadata = self.export(include_media=False)
        self.assertFalse(any(n.startswith('media/') for n in metadata.namelist()))
        self.assertTrue(self.records(metadata, 'practice.practicemedia'))

    def test_archive_has_self_describing_documentation_and_verified_manifest(self):
        archive = self.export()
        for name in ('README.md', 'SCHEMA.json', 'RESTORE.md', 'ANALYSIS.md'):
            self.assertIn(name, archive.namelist())
            self.assertTrue(archive.read(name))
        manifest = json.loads(archive.read('manifest.json'))
        self.assertEqual(manifest['format'], 'wortify-site-export')
        self.assertEqual(manifest['version'], 1)
        self.assertEqual(set(manifest['files']), set(archive.namelist()) - {'manifest.json'})
        for name, checksum in manifest['files'].items():
            self.assertEqual(hashlib.sha256(archive.read(name)).hexdigest(), checksum)
        self.assertEqual(manifest['counts']['cards.card'], 2)

    def test_full_export_includes_global_content_package(self):
        package = SystemContentPackage.objects.create(title='Seed content', language='de', digest='f' * 64, document={'practice': [{'title': 'Untouched source'}]}, counts={'practice': 1})
        archive = self.export(dataset='full', identity='linked')
        self.assertEqual(self.records(archive, 'practice.systemcontentpackage')[0]['pk'], str(package.pk))

    def test_preview_does_not_create_an_archive_and_reports_counts(self):
        response = self.post(preview=True)
        self.assertEqual(response.status_code, 200)
        result = response.json()
        self.assertIn('counts', result)
        self.assertIn('warnings', result)
        self.assertIn('options', result)
        counts = {r['model']: r['count'] for r in result['counts']}
        self.assertEqual(counts['cards.card'], 2)

    def test_invalid_options_and_missing_confirmation_are_rejected(self):
        self.assertEqual(self.post().status_code, 400)
        invalid = [
            {'dataset': 'unknown'}, {'visibility': 'secret'}, {'identity': 'unknown'},
            {'modules': []}, {'modules': ['unknown']}, {'modules': 'cards'},
            {'include_media': 'true'}, {'language': 'invalid'},
            {'date_from': 'not-a-date'}, {'date_from': '2026-10-26', 'date_to': '2026-10-01'},
            {'identity': 'anonymous', 'include_progress': True},
            {'identity': 'anonymous', 'include_credentials': True},
            {'scope': 'selected', 'ids': []},
        ]
        for options in invalid:
            with self.subTest(options=options):
                self.assertEqual(self.post(preview=True, **options).status_code, 400)

    def test_public_child_keeps_structural_parent_without_private_payload(self):
        self.root.payload = {'content': 'PRIVATE ANCESTOR THEORY'}
        self.root.save()
        self.exercise.visibility = 'public'
        self.exercise.save()
        self.exercise.links.add(self.root)
        archive = self.export(visibility='public', modules=['practice'])
        rows = {r['pk']: r['fields'] for r in self.records(archive, 'practice.practicenode')}
        self.assertEqual(rows[self.exercise.pk]['parent'], self.root.pk)
        self.assertEqual(rows[self.exercise.pk]['payload']['questions'][0]['answer'], 'der')
        self.assertFalse(rows[self.root.pk]['payload'])
        self.assertFalse(rows[self.root.pk]['attachments'])
        self.assertNotIn(b'PRIVATE ANCESTOR THEORY', archive.read('data/practice.practicenode.json'))

    def test_filtered_external_links_are_trimmed_and_documented(self):
        self.deck.source_deck = self.public
        self.deck.save()
        foreign_root = PracticeNode.objects.create(owner=self.other, language='de', kind='folder', title='Other root')
        self.exercise.links.add(foreign_root)
        archive = self.export(scope='selected', ids=[self.owner.pk])
        self.assertIsNone(self.records(archive, 'cards.deck')[0]['fields']['source_deck'])
        exercise = next(r for r in self.records(archive, 'practice.practicenode') if r['pk'] == self.exercise.pk)
        self.assertEqual(exercise['fields']['links'], [])
        unresolved = json.loads(archive.read('reference/unresolved.json'))
        self.assertTrue(any(r['field'] == 'source_deck' and self.public.pk in r['ids'] for r in unresolved))
        self.assertTrue(any(r['field'] == 'links' and foreign_root.pk in r['ids'] for r in unresolved))

    def test_missing_uploaded_media_fails_instead_of_returning_incomplete_zip(self):
        media = PracticeMedia.objects.create(owner=self.owner, language='de', file='missing/lesson.mp3', name='Missing', size=5, content_type='audio/mpeg')
        self.exercise.attachments.add(media)
        self.assertEqual(self.post(confirm='EXPORT').status_code, 400)
        self.export(include_media=False)

    def test_embedded_media_url_is_exported_without_attachment_relation(self):
        media = PracticeMedia.objects.create(owner=self.owner, language='de', file=SimpleUploadedFile('embedded.mp3', b'embedded-audio'), name='Embedded', size=14, content_type='audio/mpeg')
        self.exercise.payload = {'presentation': {'audio': f'/api/de/practice-media/{media.pk}/'}}
        self.exercise.save()
        archive = self.export(modules=['practice'])
        row = next(r for r in self.records(archive, 'practice.practicemedia') if r['pk'] == str(media.pk))
        self.assertEqual(archive.read(row['fields']['file']), b'embedded-audio')


    def test_date_filtered_ancestor_does_not_expose_old_folder_theory(self):
        from datetime import timedelta
        from django.utils import timezone
        old = timezone.now() - timedelta(days=30)
        Folder.objects.filter(pk=self.folder.pk).update(created_at=old)
        archive = self.export(modules=['cards'], date_from=timezone.now().date().isoformat())
        folder = next(r for r in self.records(archive, 'cards.folder') if r['pk'] == self.folder.pk)
        self.assertFalse(folder['fields']['theory_content'])
        self.assertEqual(self.records(archive, 'cards.deck')[0]['fields']['folder'], self.folder.pk)

    def test_arbitrary_uuid_in_payload_does_not_pull_another_accounts_upload(self):
        media = PracticeMedia.objects.create(owner=self.other, language='de', file=SimpleUploadedFile('unrelated.mp3', b'unrelated-secret'), name='Unrelated', size=16, content_type='audio/mpeg')
        self.exercise.payload = {'content': f'This unrelated identifier is {media.pk}.'}
        self.exercise.save()
        archive = self.export(scope='selected', ids=[self.owner.pk], modules=['practice'])
        self.assertFalse(self.records(archive, 'practice.practicemedia'))
        self.assertFalse(any(n.startswith('media/') for n in archive.namelist()))
    def test_detached_archive_does_not_save_selected_account_ids_or_search(self):
        archive = self.export(scope='selected', ids=[self.owner.pk], q='author@example.com')
        manifest = json.loads(archive.read('manifest.json'))
        self.assertNotIn('ids', manifest['options'])
        self.assertNotIn('q', manifest['options'])
        self.assertNotIn(b'author@example.com', archive.read('manifest.json'))

    def test_selected_learner_history_preserves_progress_on_other_owners_content(self):
        progress = StudyProgress.objects.create(user=self.owner, card=self.public_card, correct_count=7)
        archive = self.export(scope='selected', ids=[self.owner.pk], identity='linked', include_progress=True)
        row = next(r for r in self.records(archive, 'cards.studyprogress') if r['pk'] == progress.pk)
        self.assertEqual(row['fields']['user'], self.owner.pk)
        self.assertEqual(row['fields']['card'], self.public_card.pk)
        self.assertEqual(row['fields']['correct_count'], 7)
        unresolved = json.loads(archive.read('reference/unresolved.json'))
        self.assertTrue(any(r['model'] == 'cards.studyprogress' and r['field'] == 'card' and self.public_card.pk in r['ids'] for r in unresolved))

    def test_selected_learner_history_respects_content_module_and_visibility(self):
        StudyProgress.objects.create(user=self.owner, card=self.public_card, correct_count=7)
        private_other = Deck.objects.create(owner=self.other, title='Other private deck', visibility='private')
        private_card = Card.objects.create(deck=private_other, german_text='secret', vietnamese_meaning='bí mật')
        StudyProgress.objects.create(user=self.owner, card=private_card, correct_count=9)
        archive = self.export(scope='selected', ids=[self.owner.pk], identity='linked', include_progress=True, visibility='public')
        rows = self.records(archive, 'cards.studyprogress')
        self.assertEqual([r['fields']['card'] for r in rows], [self.public_card.pk])
        archive = self.export(scope='selected', ids=[self.owner.pk], identity='linked', include_progress=True, modules=['reading'])
        self.assertFalse(self.records(archive, 'cards.studyprogress'))
    def test_default_learning_export_preserves_unmaterialized_source_package(self):
        package = SystemContentPackage.objects.create(title='Catalogue', language='de', digest='a' * 64, document={'reading': [{'title': 'Unsaved story', 'payload': {'text': 'Source-only text'}}]}, counts={'reading': 1})
        archive = self.export()
        row = next(r for r in self.records(archive, 'practice.systemcontentpackage') if r['pk'] == str(package.pk))
        self.assertEqual(row['fields']['document']['reading'][0]['payload']['text'], 'Source-only text')
        self.assertEqual(row['fields']['digest'], 'a' * 64)

    def test_source_packages_are_excluded_from_private_and_account_scoped_exports(self):
        SystemContentPackage.objects.create(title='Catalogue', language='de', digest='a' * 64, document={'reading': [{'title': 'Source story'}]}, counts={'reading': 1})
        private = self.export(visibility='private')
        self.assertFalse(self.records(private, 'practice.systemcontentpackage'))
        selected = self.export(scope='selected', ids=[self.owner.pk])
        self.assertFalse(self.records(selected, 'practice.systemcontentpackage'))

    def test_module_filtered_package_contains_only_selected_sections_with_provenance(self):
        package = SystemContentPackage.objects.create(title='Mixed catalogue', language='de', digest='b' * 64, document={'reading': [{'title': 'Story'}], 'practice': [{'title': 'Exercise'}], 'flashcards': [{'title': 'Words'}]}, counts={'reading': 1, 'practice': 1, 'cards': 1})
        archive = self.export(modules=['reading'])
        row = next(r for r in self.records(archive, 'practice.systemcontentpackage') if r['pk'] == str(package.pk))
        self.assertIn('reading', row['fields']['document'])
        self.assertNotIn('practice', row['fields']['document'])
        self.assertNotIn('flashcards', row['fields']['document'])
        projections = json.loads(archive.read('reference/package-projections.json'))
        self.assertTrue(any(r['pk'] == str(package.pk) and r['original_digest'] == 'b' * 64 for r in projections))
    def test_public_package_export_excludes_materialized_and_import_only_packages(self):
        from practice.models import PackageReceipt
        document = {'reading': [{'title': 'Public source story'}], 'practice': [{'title': 'Hidden source exercise'}], 'flashcards': [{'title': 'Hidden source cards'}]}
        visible = SystemContentPackage.objects.create(title='Public source', language='de', digest='c' * 64, document=document, counts={'reading': 1})
        materialized = SystemContentPackage.objects.create(title='Materialized', language='de', digest='d' * 64, document=document, counts={'reading': 1})
        SystemContentPackage.objects.create(title='Import only', language='de', digest='e' * 64, document={**document, 'mode': 'import'}, counts={'reading': 1})
        publisher = get_user_model().objects.create_user('wortify-publisher')
        PackageReceipt.objects.create(package=materialized, user=publisher)
        archive = self.export(visibility='public')
        rows = self.records(archive, 'practice.systemcontentpackage')
        self.assertEqual([r['pk'] for r in rows], [str(visible.pk)])
        self.assertIn('reading', rows[0]['fields']['document'])
        self.assertNotIn('practice', rows[0]['fields']['document'])
        self.assertNotIn('flashcards', rows[0]['fields']['document'])
    def test_date_filter_preserves_recent_standalone_folder_theory(self):
        from datetime import timedelta
        from django.utils import timezone
        recent = Folder.objects.create(owner=self.owner, language='de', name='Standalone recent theory', theory_format='markdown', theory_content='Recent standalone explanation')
        old = Folder.objects.create(owner=self.owner, language='de', name='Standalone old theory', theory_format='markdown', theory_content='Old standalone explanation')
        Folder.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=30))
        archive = self.export(modules=['cards'], date_from=timezone.now().date().isoformat())
        folders = {r['pk']: r['fields'] for r in self.records(archive, 'cards.folder')}
        self.assertIn(recent.pk, folders)
        self.assertEqual(folders[recent.pk]['theory_content'], 'Recent standalone explanation')
        self.assertNotIn(old.pk, folders)

    def test_learning_export_keeps_source_package_when_no_accounts_remain(self):
        package = SystemContentPackage.objects.create(title='Account-independent source', language='de', digest='f' * 64, document={'reading': [{'title': 'Durable source story'}]}, counts={'reading': 1})
        self.admin.delete()
        self.owner.delete()
        self.other.delete()
        self.staff.delete()
        from django.test import RequestFactory
        from api.site_exports import export_site
        # Use an authenticated request identity without persisting any account.
        # This exercises an empty selected database while retaining the admin guard.
        request = RequestFactory().post('/api/manage/backups/site/', json.dumps({'scope': 'all', 'confirm': 'EXPORT'}), content_type='application/json')
        request.user = get_user_model()(pk=999999, username='external-test-admin', is_active=True, is_staff=True, is_superuser=True)
        from unittest.mock import patch
        with patch('api.site_exports.audit'):
            response = export_site(request)
        self.assertEqual(response.status_code, 200)
        archive = zipfile.ZipFile(io.BytesIO(b''.join(response.streaming_content)))
        self.addCleanup(archive.close)
        response.close()
        row = self.records(archive, 'practice.systemcontentpackage')[0]
        self.assertEqual(row['pk'], str(package.pk))
        self.assertEqual(row['fields']['document']['reading'][0]['title'], 'Durable source story')
