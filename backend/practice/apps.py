from django.apps import AppConfig
class PracticeConfig(AppConfig):
    name='practice'
    default_auto_field = 'django.db.models.AutoField'
    def ready(self):
        from . import signals
