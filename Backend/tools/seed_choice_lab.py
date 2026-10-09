"""Add private, repeatable demo lessons; never replace existing lessons."""
import os, sys, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
os.environ.setdefault('DJANGO_SETTINGS_MODULE','config.settings')
import django
django.setup()
from django.contrib.auth import get_user_model
from django.db import transaction
from practice.models import PracticeNode
from api.practice_hub import validate_payload
TAG='choice-lab-20261009'
def question(prompt, options, answer):
 return dict(prompt=prompt,options=options,accepted_answers=[answer],blanks=[],presentation={})
def lessons(lang):
 if lang=='de':
  dialogue=[('Im Café: Was möchten Sie trinken?', ['Einen Tee, bitte.','Ich bin zwanzig.','Es ist Montag.'],'Einen Tee, bitte.'),('Wo ist der Bahnhof?', ['Um acht Uhr.','Neben der Post.','Mit meiner Schwester.'],'Neben der Post.'),('Vielen Dank für Ihre Hilfe!', ['Gern geschehen!','Guten Appetit!','Gute Nacht!'],'Gern geschehen!')]
  eliminate=[('Ich ___ jeden Tag Deutsch.', ['lerne','lernst','lernen'],'lerne'),('Wir fahren ___ dem Bus.', ['mit','für','ohne'],'mit'),('Gestern ___ ich im Kino.', ['war','bin','werde'],'war')]
  passage='Mia wohnt in Berlin. Am Samstag fährt sie mit dem Zug nach Potsdam. Sie besucht ihre Schwester und bleibt zwei Tage.'
  truths=[('Mia wohnt in Berlin.','TRUE'),('Mia fährt mit dem Auto nach Potsdam.','FALSE'),('Mias Schwester ist Lehrerin.','NOT_GIVEN')]
 else:
  dialogue=[('At a café: What would you like to drink?', ['A tea, please.','I am twenty.','It is Monday.'],'A tea, please.'),('Where is the station?', ['At eight.','Next to the post office.','With my sister.'],'Next to the post office.'),('Thank you for helping me!', ['You are welcome!','Enjoy your meal!','Good night!'],'You are welcome!')]
  eliminate=[('She ___ English every day.', ['studies','study','studying'],'studies'),('We travel ___ bus.', ['by','on','with'],'by'),('Yesterday I ___ at the cinema.', ['was','am','will'],'was')]
  passage='Mia lives in London. On Saturday she travels to Oxford by train. She visits her sister and stays for two days.'
  truths=[('Mia lives in London.','TRUE'),('Mia travels to Oxford by car.','FALSE'),('Her sister is a teacher.','NOT_GIVEN')]
 for style,title,mode,context,rows in [
  ('dialogue_reply','Dialogue: everyday replies','multiple_choice','', [question(*r) for r in dialogue]),
  ('elimination','Eliminate: grammar detective','multiple_choice','',[question(*r) for r in eliminate]),
  ('evidence_judge','Evidence: read what is written','true_false_not_given',passage,[question(p,['TRUE','FALSE','NOT_GIVEN'],a) for p,a in truths])]:
  yield dict(title=title,kind='choice',instruction='Choose the best answer.' if mode=='multiple_choice' else 'Use only information from the passage.',context=context,ignore_case=True,ignore_punctuation=True,presentation={'interaction':mode,'type':'choice','style':style},questions=rows)
if __name__=='__main__':
 users=get_user_model().objects.filter(is_active=True)
 owner=users.get(username=sys.argv[1]) if len(sys.argv)>1 else users.order_by('-last_login','id').first()
 if not owner: raise SystemExit('No active account available.')
 report=[]
 with transaction.atomic():
  for lang in ['de','en']:
   folder,created=PracticeNode.objects.get_or_create(owner=owner,language=lang,kind='folder',title='[DEMO] New ways to practice',parent=None,defaults={'payload':{'seed':TAG},'visibility':'private'})
   for payload in lessons(lang):
    payload=validate_payload('exercise',payload)
    node,created=PracticeNode.objects.get_or_create(owner=owner,language=lang,parent=folder,title=payload['title'],kind='exercise',defaults={'payload':payload,'visibility':'private'})
    report.append({'title':node.title,'url':f'/{lang}/practice/{node.pk}','created':created})
 print(json.dumps({'owner':owner.username,'lessons':report},ensure_ascii=False))
