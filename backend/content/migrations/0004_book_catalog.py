from django.db import migrations

def catalog(apps,schema_editor):
    Book=apps.get_model('content','Book')
    placeholders=[f'{language}-{level}' for language in ['german','english'] for level in ['a1','a2','b1','b2','c1','c2'] if (language,level) not in [('german','a2'),('english','a1')]]
    Book.objects.filter(slug__in=placeholders,chapters__isnull=True).delete()
    Book.objects.filter(slug='english-a1',title='Tiếng Anh A1').update(title='Everyday English — Practice Book',description='Sách bài tập tiếng Anh tự soạn.')

class Migration(migrations.Migration):
    dependencies=[('content','0003_books'),('practice','0006_book_relationship')]
    operations=[migrations.RunPython(catalog,migrations.RunPython.noop)]
