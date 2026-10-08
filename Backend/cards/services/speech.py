"""Provider boundary: bounded synchronous HTTP, no secrets or raw errors in UI/logs."""
import hashlib
import json
import socket
import uuid
from urllib import request, error
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils.module_loading import import_string
from cards.models import CardAudio


class SpeechError(Exception):
    pass


def call_api(endpoint, body, content_type):
    req = request.Request('https://api.openai.com/v1/audio/' + endpoint, data=body, headers={
        'Authorization': 'Bearer ' + settings.SPEECH_API_KEY, 'Content-Type': content_type})
    try:
        with request.urlopen(req, timeout=settings.SPEECH_TIMEOUT) as response:
            data = response.read(20 * 1024 * 1024 + 1)
            if len(data) > 20 * 1024 * 1024:
                raise SpeechError('The audio response is too large. Please try again.')
            return data
    except (TimeoutError, socket.timeout):
        raise SpeechError('The service timed out. Please try again.') from None
    except error.URLError:
        raise SpeechError('Unable to reach the audio service. Please try again later.') from None


class OpenAISpeechProvider:
    def transcribe(self, data, filename, mime, language='de'):
        boundary = uuid.uuid4().hex
        parts = []
        for key, value in {'model': settings.STT_MODEL, 'response_format': 'verbose_json', 'language': language}.items():
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + data + f'\r\n--{boundary}--\r\n'.encode())
        try:
            result = json.loads(call_api('transcriptions', b''.join(parts), f'multipart/form-data; boundary={boundary}'))
            text = result.get('text', '').strip()
            if not text:
                raise SpeechError('No speech detected or the transcript is empty. Record again clearly.')
            if result.get('language', '').lower() not in ({'de': ('de', 'german', 'deutsch'), 'en': ('en', 'english')}[language]):
                raise SpeechError('The detected language does not match the deck. Record again.')
            segments = result.get('segments', [])
            uncertain = any(s.get('no_speech_prob', 0) > .6 or s.get('avg_logprob', 0) < -1 for s in segments)
            if len(text) > 4000:
                raise SpeechError('The recognized content is too long. Record a shorter segment.')
            return {'transcript': text, 'confidence': None, 'uncertain': uncertain}
        except (ValueError, TypeError, AttributeError):
            raise SpeechError('The service returned invalid data. Please try again.') from None

    def synthesize(self, text, voice, speed):
        data = call_api('speech', json.dumps({'model': settings.TTS_MODEL, 'input': text, 'voice': voice, 'speed': speed, 'response_format': 'mp3'}).encode(), 'application/json')
        if not data or not (data.startswith(b'ID3') or (data[0] == 255 and len(data) > 1 and data[1] & 224 == 224)):
            raise SpeechError('Unable to generate audio. Try the browser voice.')
        return data


def provider(name):
    if not name:
        raise SpeechError('The audio service is not configured. Contact an administrator.')
    if name == 'openai':
        if not settings.SPEECH_API_KEY:
            raise SpeechError('The audio service key is not configured.')
        return OpenAISpeechProvider()
    try:
        return import_string(name)()
    except (ImportError, AttributeError, TypeError):
        raise SpeechError('Invalid audio service configuration. Contact an administrator.') from None


class SpeechToTextService:
    def transcribe(self, data, filename, mime, language='de'):
        adapter = provider(settings.STT_PROVIDER)
        if language == 'de':
            return adapter.transcribe(data, filename, mime)
        return adapter.transcribe(data, filename, mime, language=language)


class TextToSpeechService:
    def audio(self, card, audio_type, text, speed):
        try:
            return self._audio(card, audio_type, text, speed)
        except SpeechError:
            raise
        except Exception:
            raise SpeechError('Unable to generate or save audio. Please try again later.') from None

    def _audio(self, card, audio_type, text, speed):
        voice = settings.TTS_VOICE
        key = hashlib.sha256(json.dumps([card.pk, card.deck.language, text, settings.TTS_PROVIDER, settings.TTS_MODEL, voice, speed], ensure_ascii=False).encode()).hexdigest()
        cached = CardAudio.objects.filter(content_hash=key).first()
        if cached and cached.audio_file.storage.exists(cached.audio_file.name):
            return cached
        try:
            data = provider(settings.TTS_PROVIDER).synthesize(text, voice, speed)
        except SpeechError:
            raise
        except Exception:
            raise SpeechError('Unable to generate audio. Please try again later.') from None
        if not data:
            raise SpeechError('Unable to generate audio. Please try again later.')
        obj = cached or CardAudio(card=card, audio_type=audio_type, provider=settings.TTS_PROVIDER, voice=voice, content_hash=key)
        obj.audio_file.save(key + '.mp3', ContentFile(data), save=False)
        if cached:
            obj.save()
            return obj
        # Another request may finish the same cache key while the provider is working.
        try:
            stored, created = CardAudio.objects.get_or_create(content_hash=key, defaults={
                'card': card, 'audio_type': audio_type, 'provider': settings.TTS_PROVIDER,
                'voice': voice, 'audio_file': obj.audio_file.name})
        except Exception:
            obj.audio_file.delete(save=False)
            raise
        if not created:
            obj.audio_file.delete(save=False)
        return stored
