from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('users', '0005_superuserbootstrap')]
    operations = [migrations.DeleteModel(name='SuperuserBootstrap')]
