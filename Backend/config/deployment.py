"""Environment-only deployment configuration; importing it performs no network I/O."""
from urllib.parse import parse_qs, unquote, urlsplit


def postgres_database(value):
    try:
        url = urlsplit(value)
        if url.scheme not in ('postgres', 'postgresql') or not url.hostname or not url.path.strip('/') or not url.username:
            raise ValueError
        query = parse_qs(url.query)
        options = {'sslmode': query.get('sslmode', ['require'])[-1], 'connect_timeout': 10}
        if 'channel_binding' in query:
            options['channel_binding'] = query['channel_binding'][-1]
        return {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': unquote(url.path.lstrip('/')), 'USER': unquote(url.username),
            'PASSWORD': unquote(url.password or ''), 'HOST': url.hostname,
            'PORT': str(url.port or 5432), 'OPTIONS': options,
            'CONN_MAX_AGE': 0, 'CONN_HEALTH_CHECKS': True,
            # Neon pooled connections use transaction pooling.
            'DISABLE_SERVER_SIDE_CURSORS': True,
        }
    except (ValueError, TypeError):
        raise RuntimeError('DATABASE_URL must be a valid PostgreSQL connection URL.') from None


def media_storage(env):
    backend = env.get('MEDIA_STORAGE', 'local')
    if backend == 'local':
        return {'BACKEND': 'django.core.files.storage.FileSystemStorage'}
    if backend != 's3':
        raise RuntimeError('MEDIA_STORAGE must be local or s3.')
    required = ('AWS_STORAGE_BUCKET_NAME', 'AWS_ENDPOINT_URL_S3', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION')
    missing = [key for key in required if not env.get(key)]
    if missing:
        raise RuntimeError('Missing media configuration: ' + ', '.join(missing))
    endpoint = urlsplit(env['AWS_ENDPOINT_URL_S3'])
    if endpoint.scheme != 'https' or not endpoint.hostname or endpoint.username or endpoint.query or endpoint.fragment:
        raise RuntimeError('AWS_ENDPOINT_URL_S3 must be an HTTPS storage endpoint.')
    return {'BACKEND': 'storages.backends.s3.S3Storage', 'OPTIONS': {
        'bucket_name': env['AWS_STORAGE_BUCKET_NAME'],
        'endpoint_url': env['AWS_ENDPOINT_URL_S3'],
        'access_key': env['AWS_ACCESS_KEY_ID'], 'secret_key': env['AWS_SECRET_ACCESS_KEY'],
        'region_name': env['AWS_REGION'], 'addressing_style': 'path',
        'signature_version': 's3v4', 'default_acl': None,
        'file_overwrite': False, 'querystring_auth': True,
        'max_memory_size': 5 * 1024 * 1024,
    }}
