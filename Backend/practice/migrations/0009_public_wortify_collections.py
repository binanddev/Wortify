from django.db import migrations
from django.conf import settings

def publish_existing(apps,schema_editor):
    User=apps.get_model(settings.AUTH_USER_MODEL)
    Package=apps.get_model('practice','SystemContentPackage');Receipt=apps.get_model('practice','PackageReceipt')
    Node=apps.get_model('practice','PracticeNode');Folder=apps.get_model('cards','Folder');Deck=apps.get_model('cards','Deck');Card=apps.get_model('cards','Card')
    if not Package.objects.exists():return
    user,created=User.objects.get_or_create(username='wortify-publisher',defaults={'is_staff':True,'first_name':'Wortify','password':'!'})
    if not user.is_staff or not user.password.startswith('!'):raise ValueError('Reserved Wortify publisher account already exists.')
    for package in Package.objects.all().iterator():
        if Receipt.objects.filter(package=package,user=user).exists():continue
        roots={'practice':[],'reading':[],'flashcards':[]}
        def walk(nodes,section,parent=None):
            for index,item in enumerate(nodes):
                kind=item['kind']
                if section=='practice':
                    obj=Node.objects.create(owner=user,language=package.language,parent=parent,title=item['title'],kind=kind,payload=item.get('payload',{}),position=index,visibility='public')
                elif kind=='folder':
                    name=item['title'];suffix=1
                    while Folder.objects.filter(owner=user,language=package.language,parent=parent,name=name).exists():
                        suffix+=1;name=item['title'][:85]+f' ({suffix})'
                    obj=Folder.objects.create(owner=user,language=package.language,parent=parent,name=name)
                else:
                    obj=Deck.objects.create(owner=user,language=package.language,folder=parent,title=item['title'],level=item.get('level','A2'),topic=item.get('topic',''),description=item.get('description',''),visibility='public')
                    allowed={f.name for f in Card._meta.fields}-{'id','deck','created_at','updated_at','position'}
                    Card.objects.bulk_create([Card(deck=obj,position=i,**{k:v for k,v in c.items() if k in allowed}) for i,c in enumerate(item.get('cards',[]))])
                if parent is None:roots[section].append({'id':obj.pk,'kind':kind,'title':item['title']})
                if kind=='folder':walk(item.get('children',[]),section,obj)
        for section in ('practice','flashcards'):walk(package.document.get(section,[]),section)
        Receipt.objects.create(package=package,user=user,result={'roots':roots,'counts':package.counts})

class Migration(migrations.Migration):
    dependencies=[('practice','0008_readinglesson_source_key_and_more'),('cards','0011_deck_source_deck_deck_visibility'),migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations=[migrations.RunPython(publish_existing,migrations.RunPython.noop)]
