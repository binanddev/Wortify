from django.db import migrations

def seed(apps, schema_editor):
    Course = apps.get_model('content', 'Course')
    Course.objects.get_or_create(id=1, defaults={'slug': 'german-a2', 'title': 'Netzwerk neu · Intensivtrainer A2', 'language': 'de', 'level': 'A2', 'description': '12 chương từ dự án Số hóa sách.'})
    for language, prefix, title in [('de', 'german', 'Tiếng Đức'), ('en', 'english', 'Tiếng Anh')]:
        for level in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']:
            Course.objects.get_or_create(slug=f'{prefix}-{level.lower()}', defaults={'title': f'{title} {level}', 'language': language, 'level': level})

class Migration(migrations.Migration):
    dependencies = [('content', '0001_initial')]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
