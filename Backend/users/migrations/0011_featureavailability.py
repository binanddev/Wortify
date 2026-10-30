from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('users', '0010_teachingboard_public_sharing')]
    operations = [migrations.CreateModel(name='FeatureAvailability', fields=[
        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
        ('themes', models.JSONField(blank=True, default=dict)),
        ('classes', models.BooleanField(default=True)),
    ])]
