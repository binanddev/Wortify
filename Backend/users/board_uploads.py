"""Stream classroom PDFs to temporary disk; never buffer 300 MB in RAM."""
import re
from django.core.files.uploadhandler import TemporaryFileUploadHandler, StopFutureHandlers, StopUpload

MAX_PDF_BYTES = 300 * 1024 * 1024

class BoardPDFUploadHandler(TemporaryFileUploadHandler):
    def new_file(self, *args, **kwargs):
        self.enabled = bool(re.fullmatch(r'/api/(de|en)/classes/\d+/boards/[0-9a-f-]+/pdfs/', self.request.path))
        if not self.enabled:
            return
        super().new_file(*args, **kwargs)
        raise StopFutureHandlers()

    def receive_data_chunk(self, raw_data, start):
        if not self.enabled:
            return raw_data
        if start + len(raw_data) > MAX_PDF_BYTES:
            self.file.close()
            raise StopUpload(connection_reset=False)
        return super().receive_data_chunk(raw_data, start)

    def file_complete(self, file_size):
        if self.enabled:
            return super().file_complete(file_size)

    def upload_interrupted(self):
        if getattr(self, 'enabled', False):
            super().upload_interrupted()
