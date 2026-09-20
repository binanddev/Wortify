import uuid

from django.conf import settings

from django.db import migrations, models
import django.db.models.deletion


def require_empty_recording_history(apps, schema_editor):
    # Fail closed on installations with historical data; never silently purge it.
    alias = schema_editor.connection.alias
    recordings = apps.get_model('cards', 'SpeakingAttempt').objects.using(alias)
    attempts = apps.get_model('cards', 'StudyAttempt').objects.using(alias).filter(mode='speak')
    if recordings.exists() or attempts.exclude(submitted_answer='').exists() or attempts.exclude(normalized_answer='').exists() or attempts.filter(result__has_key='transcript').exists():
        raise RuntimeError('Historical speaking data exists. Obtain explicit approval and archive or remove it before this migration. No historical data has been deleted.')

class Migration(migrations.Migration):
    dependencies = [('cards', '0001_initial'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.RunPython(require_empty_recording_history, migrations.RunPython.noop),
        migrations.DeleteModel(name='SpeakingAttempt'),
        migrations.CreateModel(name='Folder', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('name', models.CharField(max_length=100, verbose_name='Tên thư mục')),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('owner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL)),
        ], options={'ordering': ['name', 'id'], 'constraints': [models.UniqueConstraint(fields=('owner', 'name'), name='unique_owner_folder_name')]}),
        migrations.AddField(model_name='deck', name='folder', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='decks', to='cards.folder', verbose_name='Thư mục')),
        migrations.AddField(model_name='card', name='usage', field=models.TextField(blank=True, max_length=2000, verbose_name='Cách sử dụng')),
        migrations.AddField(model_name='studyattempt', name='processing_started_at', field=models.DateTimeField(blank=True, null=True)),
        migrations.CreateModel(name='ImportBatch', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('token', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
            ('rows', models.JSONField(default=list)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('confirmed_at', models.DateTimeField(null=True)),
            ('deck', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='cards.deck')),
        ]),
        migrations.CreateModel(name='MatchRound', fields=[
            ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
            ('token', models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
            ('pairs', models.JSONField(default=list)),
            ('result', models.JSONField(default=dict)),
            ('created_at', models.DateTimeField(auto_now_add=True)),
            ('completed_at', models.DateTimeField(null=True)),
            ('deck', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='cards.deck')),
        ]),
    ]

