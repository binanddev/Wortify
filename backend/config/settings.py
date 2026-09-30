"""Shared settings for development, staging and production (API + Django admin)."""

from pathlib import Path
import os
from .environment import load_environment

load_environment()
ENVIRONMENT = os.environ.get("DJANGO_ENV", "development")
if ENVIRONMENT not in ("development", "staging", "production"):
    raise RuntimeError("DJANGO_ENV must be development, staging or production")

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DJANGO_DEBUG', '1' if ENVIRONMENT == 'development' else '0') == '1'
if ENVIRONMENT != 'development' and DEBUG:
    raise RuntimeError('Staging/production must disable DJANGO_DEBUG')
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError('DJANGO_SECRET_KEY is required')
    SECRET_KEY = 'local-development-only-change-before-deploying'

if not DEBUG and len(SECRET_KEY) < 50:
    raise RuntimeError('Use a random DJANGO_SECRET_KEY of at least 50 characters')

ALLOWED_HOSTS = [host.strip() for host in os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',') if host.strip()]


# Application definition

INSTALLED_APPS = [
    'cards.apps.CardsConfig',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

DB_ENGINE = os.environ.get('DJANGO_DATABASE_ENGINE', 'sqlite')
if DB_ENGINE == 'postgresql':
    DATABASES = {'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ['DJANGO_DB_NAME'], 'USER': os.environ['DJANGO_DB_USER'],
        'PASSWORD': os.environ['DJANGO_DB_PASSWORD'],
        'HOST': os.environ.get('DJANGO_DB_HOST', 'db'), 'PORT': os.environ.get('DJANGO_DB_PORT', '5432'),
        'CONN_MAX_AGE': 60, 'CONN_HEALTH_CHECKS': True,
        'OPTIONS': {'sslmode': os.environ.get('DJANGO_DB_SSLMODE', 'prefer')},
    }}
elif DB_ENGINE == 'sqlite':
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.environ.get('DJANGO_DB_PATH', BASE_DIR / 'db.sqlite3'), 'OPTIONS': {'timeout': 20}}}
else:
    raise RuntimeError('DJANGO_DATABASE_ENGINE must be sqlite or postgresql')



# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'vi'

TIME_ZONE = 'Asia/Ho_Chi_Minh'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = Path(os.environ.get('DJANGO_STATIC_ROOT', BASE_DIR / 'staticfiles'))
LOGIN_URL = '/admin/login/'
LOGIN_REDIRECT_URL = '/admin/'
LOGOUT_REDIRECT_URL = '/admin/login/'
MEDIA_ROOT = Path(os.environ.get('DJANGO_MEDIA_ROOT', BASE_DIR / 'private_media'))
STT_PROVIDER = os.environ.get('STT_PROVIDER', '')
TTS_PROVIDER = os.environ.get('TTS_PROVIDER', '')
SPEECH_API_KEY = os.environ.get('SPEECH_API_KEY', '')
SPEECH_TIMEOUT = max(1, min(60, int(os.environ.get('SPEECH_TIMEOUT', '30'))))
STT_MODEL = os.environ.get('STT_MODEL', 'whisper-1')
TTS_MODEL = os.environ.get('TTS_MODEL', 'tts-1')
TTS_VOICE = os.environ.get('TTS_VOICE', 'alloy')
RECORDING_MAX_BYTES = 10 * 1024 * 1024
RECORDING_MAX_SECONDS = 60
FILE_UPLOAD_HANDLERS = ['users.uploads.BackgroundUploadHandler', 'practice.uploads.PracticeMediaUploadHandler', 'cards.uploads.AudioMemoryUploadHandler']
DATA_UPLOAD_MAX_MEMORY_SIZE = 12 * 1024 * 1024


# Email
# https://docs.djangoproject.com/en/5.2/topics/email/#topic-email-configuration

MAILERS = {
    'default': {
        'BACKEND': 'django.core.mail.backends.console.EmailBackend',
    },
}

INSTALLED_APPS += ['content', 'practice', 'api', 'users', 'learning']
STATICFILES_DIRS = []
CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}
CSRF_TRUSTED_ORIGINS = [s.strip() for s in os.environ.get('DJANGO_CSRF_TRUSTED_ORIGINS', '').split(',') if s.strip()]
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
SECURE_CONTENT_TYPE_NOSNIFF = True
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

TEST_RUNNER = 'api.tests.PlatformRunner'
MIDDLEWARE += ['api.middleware.PrivateResponsesMiddleware']

# Community features are available by default; deployments can disable them explicitly.
COMMUNITY_ENABLED = os.environ.get('COMMUNITY_ENABLED', '1') == '1'

# Application clients bootstrap CSRF through /api/session/. Admin retains Django HTML.
CSRF_FAILURE_VIEW = "api.errors.csrf_failure"
SUPERUSER_SETUP_KEY = os.environ.get('SUPERUSER_SETUP_KEY', '')

if os.environ.get("DJANGO_TRUST_PROXY") == "1":
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")


# WhiteNoise serves collected Django-admin static assets only; never private media or React.
if os.environ.get('DJANGO_SERVE_ADMIN_STATIC', '0') == '1':
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
    STORAGES = {
        'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
        'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'},
    }
SECURE_HSTS_SECONDS = int(os.environ.get('DJANGO_HSTS_SECONDS', '0' if DEBUG else '3600'))
SECURE_HSTS_INCLUDE_SUBDOMAINS = os.environ.get('DJANGO_HSTS_INCLUDE_SUBDOMAINS', '0') == '1'
SECURE_HSTS_PRELOAD = False
SECURE_REFERRER_POLICY = 'same-origin'
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
LOGGING = {
    'version': 1, 'disable_existing_loggers': False,
    'formatters': {'standard': {'format': '{asctime} {levelname} {name}: {message}', 'style': '{'}},
    'handlers': {'console': {'class': 'logging.StreamHandler', 'formatter': 'standard'}},
    'root': {'handlers': ['console'], 'level': os.environ.get('DJANGO_LOG_LEVEL', 'INFO')},
    'loggers': {'django': {'handlers': ['console'], 'level': 'INFO', 'propagate': False}},
}

# Server-to-server monitoring. Never expose this key through VITE_* or browser JS.
BACKEND_MONITOR_SECRET = os.environ.get('BACKEND_MONITOR_SECRET', 'local-monitor-development-only' if DEBUG else '')
