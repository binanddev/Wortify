import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models

def tokens(apps, schema_editor):
    Attempt = apps.get_model('practice', 'Attempt')
    for pk in Attempt.objects.values_list('pk', flat=True).iterator():
        Attempt.objects.filter(pk=pk).update(token=uuid.uuid4())

class Migration(migrations.Migration):
    dependencies = [('practice', '0004_notification'), ('content', '0002_initial_courses'), migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.AddField(model_name='chapter', name='course', field=models.ForeignKey(default=1, on_delete=django.db.models.deletion.PROTECT, related_name='chapters', to='content.course')),
        migrations.AlterField(model_name='chapter', name='number', field=models.PositiveSmallIntegerField()),
        migrations.AddConstraint(model_name='chapter', constraint=models.UniqueConstraint(fields=('course', 'number'), name='unique_course_chapter')),
        migrations.AddField(model_name='attempt', name='user', field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
        migrations.AddField(model_name='attempt', name='token', field=models.UUIDField(null=True, editable=False)),
        migrations.RunPython(tokens, migrations.RunPython.noop),
        migrations.AlterField(model_name='attempt', name='token', field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
    ]
