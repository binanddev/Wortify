"""Rank public deck content and expose only folders containing visible decks."""
import json
import re
import time
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher, get_close_matches
from threading import RLock

from django.db.models import Count, Max
from django.db.models.functions import MD5
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.http import Http404
from django.utils.html import strip_tags

from cards.models import Card, Deck, Folder

_snapshots = {}
_lock = RLock()


def normalize(value):
    value = strip_tags(str(value if value is not None else '')).casefold().replace('đ', 'd').replace('ß', 'ss')
    value = ''.join(c for c in unicodedata.normalize('NFKD', value) if not unicodedata.combining(c))
    return ' '.join(re.findall(r'[^\W_]+', value, re.UNICODE))


@receiver(post_save, sender=Deck)
@receiver(post_delete, sender=Deck)
@receiver(post_save, sender=Card)
@receiver(post_delete, sender=Card)
@receiver(post_save, sender=Folder)
@receiver(post_delete, sender=Folder)
def invalidate(sender, instance, **kwargs):
    # Metadata also detects edits made by other workers; TTL bounds bulk edits
    # which bypass model signals and updated_at.
    with _lock:
        _snapshots.clear()


def snapshot(language):
    decks = list(Deck.objects.filter(language=language, visibility='public', owner__is_active=True)
        .annotate(count=Count('cards'), cards_revision=Max('cards__updated_at'))
        .order_by('pk').values('id', 'owner_id', 'folder_id', 'title', 'description', 'level', 'topic',
            'language', 'created_at', 'updated_at', 'count', 'cards_revision', 'archived',
            'owner__username', 'owner__first_name', 'owner__last_name', 'owner__is_staff', 'owner__is_superuser'))
    owners = {deck['owner_id'] for deck in decks}
    folders = list(Folder.objects.filter(language=language, owner_id__in=owners)
        .annotate(theory_revision=MD5('theory_content')).order_by('pk')
        .values('id', 'parent_id', 'owner_id', 'name', 'created_at', 'theory_format', 'theory_revision', 'archived'))
    signature = (decks, folders)
    with _lock:
        cached = _snapshots.get(language)
        if cached and cached['signature'] == signature and time.monotonic()-cached['at'] < 60:
            return cached
        by_folder = {folder['id']:folder for folder in folders}
        documents = {}
        vocabulary = set()
        def add(document, value, weight):
            text = normalize(value)
            if not text: return
            for word in text.split():
                document['words'][word] = max(weight, document['words'].get(word, 0))
                vocabulary.add(word)
        used_folders = set()
        for deck in decks:
            chain, seen = [], set()
            folder = by_folder.get(deck['folder_id'])
            while folder and folder['owner_id'] == deck['owner_id'] and folder['id'] not in seen:
                seen.add(folder['id']); chain.insert(0, folder)
                folder = by_folder.get(folder['parent_id'])
            used_folders.update(folder['id'] for folder in chain)
            editorial = deck['owner__is_staff'] or deck['owner__is_superuser']
            author = 'Wortify' if editorial else (' '.join([deck['owner__first_name'],deck['owner__last_name']]).strip() or deck['owner__username'])
            document = {'deck':deck, 'chain':chain, 'author':author, 'words':{},
                'phrases':[normalize(deck['title']), normalize(deck['description'])[:1000], normalize(deck['topic']), normalize(deck['level']), normalize(author),
                           *[normalize(folder['name']) for folder in chain]]}
            for field, weight in [('title',12),('level',12),('topic',9),('description',6),('language',3),('count',1),('created_at',1),('updated_at',1)]:
                add(document, deck[field], weight)
            add(document, 'German Deutsch tiếng Đức' if language=='de' else 'English tiếng Anh', 3)
            add(document, author, 4)
            if not editorial: add(document, deck['owner__username'], 4)
            for folder in chain:
                add(document, folder['name'], 10)
                add(document, folder['theory_format'], 1)
                add(document, folder['created_at'], 1)
            documents[deck['id']] = document
        # Stream only public-card text; never hydrate private content or progress.
        card_fields = ['deck_id','german_text','vietnamese_meaning','example_german','example_vietnamese',
            'part_of_speech','article','plural_form','notes','usage','accepted_answers','accepted_examples',
            'image_url','image_source_url','image_credit','image_license','image_license_url']
        for card in Card.objects.filter(deck_id__in=documents).order_by().values(*card_fields).iterator(chunk_size=400):
            document = documents[card.pop('deck_id')]
            for value in card.values():
                if isinstance(value, list): value = ' '.join(map(str,value))
                add(document, value, 2)
        theories = dict(Folder.objects.filter(pk__in=used_folders).values_list('pk','theory_content'))
        for document in documents.values():
            for folder in document['chain']: add(document, theories.get(folder['id'], ''), 2)
        cached = {'signature':signature, 'documents':documents, 'folders':by_folder,
                  'vocabulary':vocabulary, 'at':time.monotonic()}
        _snapshots[language] = cached
        return cached


# A bounded multilingual thesaurus, not an embedding/LLM semantic service.
# Phrase units avoid giving multi-word synonyms extra votes just for being longer.
CONCEPTS = (
    ('transport','transportation','verkehr','verkehrsmittel','public transport','phuong tien','phuong tien cong cong','di lai','train','railway','railroad','transit','zug','eisenbahn'),
    ('food','essen','lebensmittel','meals','groceries','eating','an uong','thuc pham','do an'),
    ('travel','reise','reisen','du lich'),
    ('station','bahnhof','nha ga'),
    ('work','office','arbeit','beruf','cong viec'),
    ('shopping','einkaufen','mua sam'),
    ('health','gesundheit','suc khoe'),
    ('grammar','grammatik','ngu phap'),
)
STOP_WORDS = set(('toi minh muon tim giup can hoc ve cac nhung mot vai voi cho dang nay do duoc co la va hay bang '
                  'i want to learn please find me about some my the a an of and for '
                  'ich suche mochte lernen bitte mir zum zur fur uber ein eine die der das und mit').split())
FILLER_PHRASES = ('tu vung','tai lieu','noi dung','bo the','lien quan','phu hop','vocabulary','vokabeln','wortschatz','words','word','flashcards','flashcard','worter','cum tu','bai hoc')
CONTEXT_PHRASES = ('nang cao','hang ngay','co ban','can ban','advanced','beginner','daily','basic')


def query_units(phrase):
    remaining = phrase
    concepts = {}
    aliases = sorted(((alias,index) for index,group in enumerate(CONCEPTS) for alias in group),
                     key=lambda item:len(item[0]),reverse=True)
    for alias,index in aliases:
        pattern = r'(?<!\w)' + re.escape(alias) + r'(?!\w)'
        match = re.search(pattern,remaining)
        if match:
            key = f'__concept_{index}__'
            concepts.setdefault(key, {'literal':alias, 'alternatives':CONCEPTS[index], 'importance':1})
            remaining = re.sub(pattern, f' {key} ', remaining)
    for filler in FILLER_PHRASES:
        remaining = re.sub(r'(?<!\w)'+re.escape(filler)+r'(?!\w)', ' ', remaining)
    terms = list(dict.fromkeys(token for token in remaining.split() if token not in STOP_WORDS))[:20]
    if not terms:
        return [{'literal':term,'alternatives':(), 'importance':1} for term in dict.fromkeys(phrase.split())][:20]
    contextual = set()
    for context in CONTEXT_PHRASES:
        if re.search(r'(?<!\w)'+re.escape(context)+r'(?!\w)',phrase): contextual.update(context.split())
    has_specific = any(term in concepts or term not in contextual for term in terms)
    return [concepts[term] if term in concepts else {'literal':term,'alternatives':(),
            'importance':.2 if has_specific and term in contextual else 1} for term in terms]


def ranker(query, vocabulary):
    phrase = normalize(query)
    units = query_units(phrase)
    fuzzy = {unit['literal']:get_close_matches(unit['literal'],vocabulary,n=3,cutoff=.70)
             if not unit['alternatives'] and len(unit['literal'])>=4 else [] for unit in units}
    def phrase_weight(words,text):
        tokens = text.split()
        return min((words.get(token,0) for token in tokens),default=0)
    def rank(document):
        words = document['words']
        values, exact = [], 0
        for unit in units:
            term = unit['literal']
            literal = phrase_weight(words,term)
            if literal:
                values.append(literal*unit['importance']); exact += 1
                continue
            choices = [phrase_weight(words,alias)*.65 for alias in unit['alternatives']]
            choices.extend(weight*.85 for word,weight in words.items() if len(term)>=3 and ' ' not in term and word.startswith(term))
            if not unit['alternatives']:
                choices.extend(words[word]*SequenceMatcher(None,term,word).ratio()*.7 for word in fuzzy[term] if word in words)
            values.append(max(choices,default=0)*unit['importance'])
        # A match only on 'advanced/daily' must not compete with the actual topic.
        if not any(value>0 and unit['importance']==1 for value,unit in zip(values,units)):
            return (0,0,0,0,0)
        matched = sum(value>0 for value in values)
        phrase_bonus = max((20 if phrase==text else 10 if phrase in text else 0 for text in document['phrases']), default=0) if phrase else 0
        return (int(bool(units) and exact==len(units)), int(bool(units) and matched==len(units)),
                matched, exact, sum(values)+phrase_bonus)
    return rank


def discover_data(request, owner):
    cached = snapshot(request.language)
    query = request.GET.get('q','').strip()[:200]
    level = request.GET.get('level','').strip()[:10]
    topic = normalize(request.GET.get('topic','')[:100])
    parent = max(0,int(request.GET.get('folder') or 0))
    browsing = request.GET.get('browse') == '1'
    try:
        history = json.loads(request.GET.get('recent','[]')[:10000])
    except (ValueError,TypeError): raise ValueError('Invalid search history.')
    if not isinstance(history,list): raise ValueError('Invalid search history.')
    history = [q.strip()[:200] for q in history[:5] if isinstance(q,str) and q.strip()]
    raw_ids = request.GET.get('recent_folders','').split(',')[:30]
    recent_ids = [int(value) for value in raw_ids if value.isdecimal()]
    documents = list(cached['documents'].values())
    # A folder URL is authorized only through a currently visible public deck.
    folder_ids = {folder['id'] for document in documents for folder in document['chain']}
    if parent and parent not in folder_ids: raise Http404
    documents = [document for document in documents
        if (not level or document['deck']['level']==level)
        and (not topic or topic in normalize(document['deck']['topic']))
        and (not parent or any(folder['id']==parent for folder in document['chain']))]
    rank = ranker(query, cached['vocabulary'])
    history_rankers = [ranker(q,cached['vocabulary']) for q in history]
    def recent(document):
        chain = {folder['id'] for folder in document['chain']}
        clicked = max((30-index for index,pk in enumerate(recent_ids) if pk in chain),default=0)
        searched = max(((len(history)-index)*int(score[2]>0) for index,score in enumerate(fn(document) for fn in history_rankers)),default=0)
        return searched, clicked
    scored = [(rank(document), recent(document), document) for document in documents]
    matched = [row for row in scored if row[0][2]]
    # If no term matches, keep the closest eligible suggestions. Hard filters
    # and visibility remain mandatory, even for these fallback results.
    if query and matched: scored = matched
    approximate = bool(query and scored and not any(score[0] for score,_,_ in scored))
    def order(row):
        score, recency, document = row
        fallback = max((SequenceMatcher(None,normalize(query),text).ratio() for text in document['phrases']),default=0) if query and not score[2] else 0
        return (score[0], score[1], score[4], score[2], score[3], fallback, *recency, document['deck']['updated_at'], document['deck']['id'])
    scored.sort(key=order,reverse=True)
    saved = dict(Deck.objects.filter(owner=owner,archived=False,source_deck__isnull=False).values_list('source_deck_id','id')) if owner else {}
    def deck_summary(document):
        deck = document['deck'];chain = document['chain']
        return {'kind':'deck','id':deck['id'],'title':deck['title'],'description':deck['description'],
            'level':deck['level'],'topic':deck['topic'],'count':deck['count'],'author':document['author'],
            'folder_id':chain[-1]['id'] if chain else None,'root_id':chain[0]['id'] if chain else None,
            'folder_path':[{'id':folder['id'],'title':folder['name']} for folder in chain],
            'saved_id':deck['id'] if owner and deck['owner_id']==owner.pk and not deck['archived'] else saved.get(deck['id'])}
    rows = []
    if browsing:
        grouped = {}
        statistics = {}
        for document in documents:
            for item in document['chain']:
                stats = statistics.setdefault(item['id'], {'decks':0,'cards':0,'levels':set()})
                stats['decks'] += 1; stats['cards'] += document['deck']['count']; stats['levels'].add(document['deck']['level'])
        for row in scored:
            chain = row[2]['chain']
            index = next((i+1 for i,folder in enumerate(chain) if folder['id']==parent),0) if parent else 0
            folder = chain[index] if index<len(chain) else None
            key = ('folder',folder['id']) if folder else ('deck',row[2]['deck']['id'])
            if key not in grouped: grouped[key] = (row, folder)
        for row,folder in grouped.values():
            if not folder: rows.append(deck_summary(row[2])); continue
            stats = statistics[folder['id']]
            index = next(i for i,f in enumerate(row[2]['chain']) if f['id']==folder['id'])
            rows.append({'kind':'folder','id':folder['id'],'root_id':row[2]['chain'][0]['id'],
                'title':folder['name'],'author':row[2]['author'],'deck_count':stats['decks'],
                'count':stats['cards'],
                'levels':sorted(stats['levels']),
                'folder_path':[{'id':f['id'],'title':f['name']} for f in row[2]['chain'][:index+1]]})
    else: rows = [deck_summary(row[2]) for row in scored]
    total = len(rows); pages = max(1,(total+23)//24)
    page = min(pages,max(1,int(request.GET.get('page',1))))
    current = next((document['chain'] for document in cached['documents'].values() if any(folder['id']==parent for folder in document['chain'])),[])
    ancestors=[]
    for folder in current:
        ancestors.append({'id':folder['id'],'title':folder['name']})
        if folder['id']==parent: break
    if not parent: ancestors=[]
    return {'results':rows[(page-1)*24:page*24],'page':page,'pages':pages,'total':total,
            'approximate':approximate,'ancestors':ancestors,'folder':parent or None}
