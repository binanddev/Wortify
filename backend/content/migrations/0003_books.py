from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('content', '0002_initial_courses'), ('practice', '0005_unified_courses_accounts')]
    operations = [
        migrations.RenameModel(old_name='Course', new_name='Book'),
        migrations.AddField(model_name='book', name='author', field=models.CharField(max_length=150, blank=True)),
        migrations.AlterField(model_name='book', name='level', field=models.CharField(max_length=2, blank=True, choices=[(x,x) for x in ['A1','A2','B1','B2','C1','C2']])),
    ]
