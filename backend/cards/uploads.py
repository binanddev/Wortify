"""Bounded in-memory audio upload: never spill a recording to a temporary file."""
from io import BytesIO
from django.conf import settings
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.core.files.uploadhandler import FileUploadHandler, StopUpload


class AudioMemoryUploadHandler(FileUploadHandler):
    def new_file(self, *args, **kwargs):
        super().new_file(*args, **kwargs)
        self.buffer = BytesIO()

    def receive_data_chunk(self, raw_data, start):
        if self.buffer.tell() + len(raw_data) > settings.RECORDING_MAX_BYTES:
            self.buffer.close()
            raise StopUpload(connection_reset=False)
        self.buffer.write(raw_data)

    def file_complete(self, file_size):
        self.buffer.seek(0)
        return InMemoryUploadedFile(self.buffer, self.field_name, self.file_name, self.content_type, file_size, self.charset)
