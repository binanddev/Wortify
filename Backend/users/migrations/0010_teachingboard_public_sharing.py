import uuid
from django.db import migrations, models


def assign_private_links(apps, schema_editor):
    Board=apps.get_model('users','TeachingBoard')
    alias=schema_editor.connection.alias
    for pk in Board.objects.using(alias).values_list('pk',flat=True).iterator():
        Board.objects.using(alias).filter(pk=pk).update(public_token=uuid.uuid4())


class Migration(migrations.Migration):
    dependencies=[('users','0009_teachingboard_boardpdf_boardevent')]
    operations=[
        migrations.AddField(model_name='teachingboard',name='public_enabled',field=models.BooleanField(default=False)),
        migrations.AddField(model_name='teachingboard',name='public_version',field=models.PositiveIntegerField(default=0)),
        migrations.AddField(model_name='teachingboard',name='public_token',field=models.UUIDField(null=True,editable=False)),
        migrations.RunPython(assign_private_links,migrations.RunPython.noop),
        migrations.AlterField(model_name='teachingboard',name='public_token',field=models.UUIDField(default=uuid.uuid4,unique=True,editable=False)),
    ]
