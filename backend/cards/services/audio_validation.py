import io
from django.conf import settings
from .speech import SpeechError


def validate_audio(upload):
    if upload.size > settings.RECORDING_MAX_BYTES:
        raise SpeechError('Bản thu vượt quá 10 MB.')
    mime = upload.content_type.split(';')[0].lower()
    data = upload.read(settings.RECORDING_MAX_BYTES + 1)
    formats = {'audio/webm': ('webm', data.startswith(b'\x1aE\xdf\xa3')), 'audio/ogg': ('ogg', data.startswith(b'OggS')),
               'audio/mp4': ('m4a', data[4:8] == b'ftyp'), 'audio/x-m4a': ('m4a', data[4:8] == b'ftyp'),
               'audio/wav': ('wav', data.startswith(b'RIFF') and data[8:12] == b'WAVE'),
               'audio/x-wav': ('wav', data.startswith(b'RIFF') and data[8:12] == b'WAVE')}
    ext, valid = formats.get(mime, ('', False))
    if not valid:
        raise SpeechError('File âm thanh không hợp lệ. Hãy thu lại trong trình duyệt.')
    try:
        import av
        with av.open(io.BytesIO(data)) as container:
            if not container.streams.audio or container.streams.video:
                raise SpeechError('Chỉ chấp nhận bản thu âm thanh.')
            duration = 0
            for frame in container.decode(audio=0):
                duration += frame.samples / frame.sample_rate
                if duration > settings.RECORDING_MAX_SECONDS + .5:
                    raise SpeechError('Bản thu dài quá 60 giây.')
        if duration < .4:
            raise SpeechError('Bản thu quá ngắn. Hãy nói ít nhất nửa giây.')
    except SpeechError:
        raise
    except Exception:
        raise SpeechError('Không đọc được âm thanh. Hãy thu lại bằng định dạng được hỗ trợ.') from None
    return data, ext, mime, round(duration * 1000)
