import io
from django.conf import settings
from .speech import SpeechError


def validate_audio(upload):
    if upload.size > settings.RECORDING_MAX_BYTES:
        raise SpeechError('The recording exceeds 10 MB.')
    mime = upload.content_type.split(';')[0].lower()
    data = upload.read(settings.RECORDING_MAX_BYTES + 1)
    formats = {'audio/webm': ('webm', data.startswith(b'\x1aE\xdf\xa3')), 'audio/ogg': ('ogg', data.startswith(b'OggS')),
               'audio/mp4': ('m4a', data[4:8] == b'ftyp'), 'audio/x-m4a': ('m4a', data[4:8] == b'ftyp'),
               'audio/wav': ('wav', data.startswith(b'RIFF') and data[8:12] == b'WAVE'),
               'audio/x-wav': ('wav', data.startswith(b'RIFF') and data[8:12] == b'WAVE')}
    ext, valid = formats.get(mime, ('', False))
    if not valid:
        raise SpeechError('Invalid audio file. Record again in the browser.')
    try:
        import av
        with av.open(io.BytesIO(data)) as container:
            if not container.streams.audio or container.streams.video:
                raise SpeechError('Only audio recordings are accepted.')
            duration = 0
            for frame in container.decode(audio=0):
                duration += frame.samples / frame.sample_rate
                if duration > settings.RECORDING_MAX_SECONDS + .5:
                    raise SpeechError('The recording exceeds 60 seconds.')
        if duration < .4:
            raise SpeechError('The recording is too short. Speak for at least half a second.')
    except SpeechError:
        raise
    except Exception:
        raise SpeechError('Unable to read audio. Record again in a supported format.') from None
    return data, ext, mime, round(duration * 1000)
