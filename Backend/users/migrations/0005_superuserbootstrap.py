from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [('users', '0004_theme_profile_theme_de_profile_theme_en')]
    operations = [migrations.CreateModel(
        name='SuperuserBootstrap',
        fields=[('id', models.PositiveSmallIntegerField(default=1, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True))],
    )]
