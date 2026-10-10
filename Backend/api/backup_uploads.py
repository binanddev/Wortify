from django.core.files.uploadhandler import TemporaryFileUploadHandler, StopFutureHandlers, StopUpload

class BackupUploadHandler(TemporaryFileUploadHandler):
    def new_file(self,*args,**kwargs):
        self.enabled=self.request.path=='/api/me/backup/restore/'
        if not self.enabled:return
        super().new_file(*args,**kwargs)
        raise StopFutureHandlers()
    def receive_data_chunk(self,raw_data,start):
        if not self.enabled:return raw_data
        if start+len(raw_data)>512*1024*1024:
            self.file.close()
            raise StopUpload(connection_reset=False)
        return super().receive_data_chunk(raw_data,start)
    def file_complete(self,file_size):
        if self.enabled:return super().file_complete(file_size)
    def upload_interrupted(self):
        if getattr(self,'enabled',False):super().upload_interrupted()
