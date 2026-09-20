from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('practice', '0005_unified_courses_accounts'), ('content', '0003_books')]
    operations = [
        migrations.RemoveConstraint(model_name='chapter', name='unique_course_chapter'),
        migrations.RenameField(model_name='chapter', old_name='course', new_name='book'),
        migrations.AddConstraint(model_name='chapter', constraint=models.UniqueConstraint(fields=['book','number'],name='unique_book_chapter')),
    ]
