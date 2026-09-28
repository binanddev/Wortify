from django.db import migrations, models


def remove_loose_exercises(apps, schema_editor):
    Node = apps.get_model('practice', 'PracticeNode')
    Node.objects.using(schema_editor.connection.alias).filter(kind='exercise', parent__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [('practice', '0002_practiceprogress')]
    operations = [
        migrations.RunPython(remove_loose_exercises, migrations.RunPython.noop),
        migrations.AddConstraint(model_name='practicenode', constraint=models.CheckConstraint(
            condition=~models.Q(kind='exercise') | models.Q(parent__isnull=False),
            name='practice_exercise_requires_folder')),
    ]
