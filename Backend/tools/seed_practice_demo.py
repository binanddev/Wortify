"""Create repeatable Practice Hub UI fixtures without changing existing content.
Run: .venv/Scripts/python.exe tools/seed_practice_demo.py
"""
import json
import os
from pathlib import Path
import random
import sys
from copy import deepcopy

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()
from django.contrib.auth import get_user_model
from django.db import transaction
from practice.models import PracticeNode
from api.practice_hub import validate_payload

TAG = "practice-ui-20260928-v1"
STYLES = [("cloze_drag_drop", "drag_drop"), ("cloze_drag_drop", "tap_fill"),
          ("error_correction", "click_edit"), ("error_correction", "cross_out"),
          ("matching", "tap_match"), ("sentence_building", "tap_build"),
          ("categorization", "drag_sort"), ("inline_selection", "pill_toggle"),
          ("inline_selection", "inline_select"), ("short_answer", "partial_input"),
          ("short_answer", "sentence_rewrite")]
NAMES = {"cloze_drag_drop":"Điền từ", "error_correction":"Sửa lỗi", "matching":"Nối cặp",
         "sentence_building":"Sắp xếp câu", "categorization":"Phân loại", "inline_selection":"Chọn từ", "short_answer":"Viết câu"}
SENTENCES = {
 "en": [("I", "drink", "water.", "Tôi uống nước."), ("She", "reads", "a book.", "Cô ấy đọc một cuốn sách."),
        ("We", "play", "football.", "Chúng tôi chơi bóng đá."), ("He", "eats", "an apple.", "Anh ấy ăn một quả táo."),
        ("They", "learn", "English.", "Họ học tiếng Anh."), ("You", "like", "music.", "Bạn thích âm nhạc."),
        ("Anna", "buys", "bread.", "Anna mua bánh mì."), ("Tom", "writes", "a letter.", "Tom viết một lá thư."),
        ("We", "watch", "a film.", "Chúng tôi xem một bộ phim."), ("I", "need", "a pen.", "Tôi cần một cây bút.")],
 "de": [("Ich", "trinke", "Wasser.", "Tôi uống nước."), ("Sie", "liest", "ein Buch.", "Cô ấy đọc một cuốn sách."),
        ("Wir", "spielen", "Fußball.", "Chúng tôi chơi bóng đá."), ("Er", "isst", "einen Apfel.", "Anh ấy ăn một quả táo."),
        ("Sie", "lernen", "Deutsch.", "Họ học tiếng Đức."), ("Du", "magst", "Musik.", "Bạn thích âm nhạc."),
        ("Anna", "kauft", "Brot.", "Anna mua bánh mì."), ("Tom", "schreibt", "einen Brief.", "Tom viết một lá thư."),
        ("Wir", "sehen", "einen Film.", "Chúng tôi xem một bộ phim."), ("Ich", "brauche", "einen Stift.", "Tôi cần một cây bút.")]
}
WORDS = {
 "en": ["apple","banana","orange","pear","grape","cat","dog","bird","horse","rabbit"],
 "de": ["der Apfel","die Banane","die Orange","die Birne","die Traube","die Katze","der Hund","der Vogel","das Pferd","das Kaninchen"]
}
VI = ["quả táo","quả chuối","quả cam","quả lê","quả nho","con mèo","con chó","con chim","con ngựa","con thỏ"]
TOPICS = {
 "en": ["Everyday English", "Sentence lab", "Vocabulary garden", "Quick practice", "Morning warm-up", "Word connections", "Reading corner", "Grammar steps", "Weekend challenge", "School essentials", "Travel starter", "Food and friends", "Small conversations", "Writing workshop", "Daily routine", "Language playground", "Focus session", "Review collection", "Mixed practice", "A little progress every day — a longer folde title for navigation testing"],
 "de": ["Deutsch im Alltag", "Satzwerkstatt", "Wortschatzgarten", "Kurze Übungen", "Guten Morgen", "Wörter verbinden", "Leseecke", "Grammatikschritte", "Wochenendtraining", "In der Schule", "Reisevorbereitung", "Essen und Freunde", "Kleine Gespräche", "Schreibwerkstatt", "Tagesablauf", "Sprachspielplatz", "Konzentriert lernen", "Wiederholung", "Gemischte Übungen", "Jeden Tag ein kleiner Fortschritt — ein langer Folde-Titel für den Navigationstest"]
}

def exercise(lang, mode, style, title, rng):
    groups = ["Fruit", "Animals"] if lang == "en" else ["Obst", "Tiere"]
    presentation = {"interaction":mode,"style":style,"seed_batch":TAG}
    if mode == "categorization": presentation["categories"] = groups
    payload = {"title":title,"instruction":"Hoàn thành từng câu.","ignore_case":True,"ignore_punctuation":True,"presentation":presentation,"questions":[]}
    order = list(range(10)); rng.shuffle(order)
    for number, i in enumerate(order, 1):
        subject, verb, tail, translation = SENTENCES[lang][i]
        answer = f"{subject} {verb} {tail}"
        q = {"prompt":answer,"accepted_answers":[],"options":[],"blanks":[],"presentation":{},"example":False}
        if mode in ("cloze_drag_drop", "inline_selection"):
            other = SENTENCES[lang][(i+1)%10][1]
            options = [verb, other]; rng.shuffle(options)
            q["prompt"] = subject + " {{1}} " + tail
            q["blanks"] = [{"answers":[verb],"options":options}]
            if mode == "cloze_drag_drop":q["presentation"]["word_bank"] = options
        elif mode == "error_correction":
            if style == "cross_out":q["prompt"] = f"{subject} {verb} {verb} {tail}"
            else:q["prompt"] = f"{subject} {verb}x {tail}"
            q["accepted_answers"] = [answer]
        elif mode == "matching":
            q["prompt"] = WORDS[lang][i];q["accepted_answers"] = [VI[i]];q["options"] = VI.copy()
        elif mode == "sentence_building":
            q["prompt"] = translation
            tokens = [{"id":str(j),"text":text} for j,text in enumerate(answer.split(),1)]
            q["presentation"]["tokens"] = tokens;q["accepted_answers"] = [t["id"] for t in tokens]
        elif mode == "categorization":
            q["prompt"] = WORDS[lang][i];q["accepted_answers"] = [groups[0 if i<5 else 1]];q["options"] = groups.copy()
        else:
            q["prompt"] = translation;q["accepted_answers"] = [answer]
            if style == "partial_input":q["presentation"]["prefix"] = subject
        q["presentation"]["explanation"] = q["accepted_answers"][0] if q["accepted_answers"] and mode != "sentence_building" else answer
        payload["questions"].append(q)
    return validate_payload("exercise",payload)


def main():
    owner = get_user_model().objects.get(username="minhtien", is_active=True)
    reports = []
    with transaction.atomic():
        for lang in ("en","de"):
            if PracticeNode.objects.filter(owner=owner,language=lang,payload__seed_batch=TAG).exists():
                print(f"{lang}: dataset already exists; no duplicates created.")
                continue
            rng = random.Random(20260928 + (1 if lang=="de" else 0))
            nested = set(rng.sample(range(20),5))
            report = {"language":lang,"roots":0,"nested_roots":0,"children":0,"exercises":0,"questions":0,"root_ids":[],"counts":[]}
            def create(kind,title,parent=None,payload=None,position=0):
                node = PracticeNode(owner=owner,language=lang,kind=kind,title=title,parent=parent,
                    payload=payload or {"seed_batch":TAG},visibility="public",position=position)
                node.full_clean();node.save();return node
            for index, topic in enumerate(TOPICS[lang]):
                root = create("folder",f"[TEST] {index+1:02d} · {topic}",position=1000+index)
                report["roots"]+=1;report["root_ids"].append(root.pk)
                containers=[root]
                if index in nested:
                    report["nested_roots"]+=1
                    for child in range(rng.randint(2,3)):
                        label = ["Warm-up", "Practice", "Challenge"][child] if lang=="en" else ["Aufwärmen", "Üben", "Herausforderung"][child]
                        containers.append(create("folder",label,root,position=child))
                        report["children"]+=1
                total=rng.randint(5*len(containers),20)
                counts=[5]*len(containers)
                for _ in range(total-sum(counts)):counts[rng.randrange(len(counts))]+=1
                report["counts"].append(total)
                for container,count in zip(containers,counts):
                    for j in range(count):
                        mode,style=STYLES[(report["exercises"]+j)%len(STYLES)]
                        title=f"{j+1:02d} · {NAMES[mode]} · {style}"
                        create("exercise",title,container,exercise(lang,mode,style,title,rng),position=10+j)
                        report["exercises"]+=1;report["questions"]+=10
            reports.append(report)
    seeded = list(PracticeNode.objects.filter(owner=owner,kind="exercise",payload__presentation__seed_batch=TAG))
    assert all(n.parent_id and n.parent.language==n.language and len(n.payload["questions"])==10 for n in seeded)
    for lang in ("en","de"):
        styles={(n.payload["presentation"]["interaction"],n.payload["presentation"]["style"]) for n in seeded if n.language==lang}
        assert styles==set(STYLES),(lang,styles)
    print(json.dumps({"owner":owner.username,"batch":TAG,"created":reports,"verified_exercises":len(seeded)},ensure_ascii=False,indent=2))
    if len(sys.argv)>1:
        Path(sys.argv[1]).write_text(json.dumps([n.payload for n in seeded],ensure_ascii=False),encoding="utf-8")

if __name__=="__main__":main()
