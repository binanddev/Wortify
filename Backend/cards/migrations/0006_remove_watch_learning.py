from django.db import migrations

def remove_video_data(apps, schema_editor):
    Video = apps.get_model('cards', 'VideoLesson')
    Deck = apps.get_model('cards', 'Deck')
    ids = list(Video.objects.exclude(deck_id=None).values_list('deck_id', flat=True))
    Video.objects.all().delete()
    Deck.objects.filter(pk__in=ids).delete()

class Migration(migrations.Migration):
    dependencies = [('cards', '0005_videolesson')]
    operations = [
        migrations.RunPython(remove_video_data, migrations.RunPython.noop),
        migrations.DeleteModel(name='VideoLesson'),
    ]
