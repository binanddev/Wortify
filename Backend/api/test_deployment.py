from django.test import SimpleTestCase
from unittest import skipUnless
from importlib.util import find_spec
from config.deployment import postgres_database, media_storage


class DeploymentConfigurationTests(SimpleTestCase):
    def test_neon_url_keeps_ssl_and_pooler_settings(self):
        db = postgres_database('postgresql://user:p%40ss@db.example/db?sslmode=require&channel_binding=require')
        self.assertEqual(db['PASSWORD'], 'p@ss')
        self.assertEqual(db['OPTIONS']['channel_binding'], 'require')
        self.assertEqual(db['OPTIONS']['sslmode'], 'require')
        self.assertTrue(db['DISABLE_SERVER_SIDE_CURSORS'])
        self.assertEqual(db['CONN_MAX_AGE'], 0)

    def test_bad_database_url_does_not_expose_credentials(self):
        for url in ['https://user:secret@db.example/db', 'postgresql://user:secret@db.example:bad/db', 'postgresql://db.example/']:
            with self.assertRaises(RuntimeError) as error:
                postgres_database(url)
            self.assertNotIn('secret', str(error.exception))

    def test_default_media_remains_local(self):
        self.assertEqual(media_storage({})['BACKEND'], 'django.core.files.storage.FileSystemStorage')

    def test_s3_requires_complete_credentials(self):
        with self.assertRaisesRegex(RuntimeError, 'AWS_ENDPOINT_URL_S3'):
            media_storage({'MEDIA_STORAGE': 's3'})

    @skipUnless(find_spec('storages'), 'Production storage dependency not installed')
    def test_s3_private_path_style_and_non_overwriting(self):
        env = dict(MEDIA_STORAGE='s3', AWS_STORAGE_BUCKET_NAME='media',
                   AWS_ENDPOINT_URL_S3='https://storage.example', AWS_ACCESS_KEY_ID='test',
                   AWS_SECRET_ACCESS_KEY='test', AWS_REGION='ap-southeast-1')
        from storages.backends.s3 import S3Storage
        options = media_storage(env)['OPTIONS']
        storage = S3Storage(**options)
        self.assertEqual(storage.connection.meta.client.meta.endpoint_url, env['AWS_ENDPOINT_URL_S3'])
        self.assertEqual(storage.connection.meta.client.meta.config.s3['addressing_style'], 'path')
        self.assertFalse(storage.file_overwrite)
        self.assertIsNone(storage.default_acl)
        self.assertTrue(storage.querystring_auth)

    def test_s3_rejects_invalid_endpoint(self):
        env = dict(MEDIA_STORAGE='s3', AWS_STORAGE_BUCKET_NAME='media',
                   AWS_ENDPOINT_URL_S3='http://storage.example', AWS_ACCESS_KEY_ID='test',
                   AWS_SECRET_ACCESS_KEY='test', AWS_REGION='ap-southeast-1')
        with self.assertRaisesRegex(RuntimeError, 'HTTPS'):
            media_storage(env)
