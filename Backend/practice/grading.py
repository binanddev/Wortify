import unicodedata

def normalize(value, exercise):
    value = unicodedata.normalize('NFC',value).strip()
    if exercise.ignore_case:
        value = value.lower()
    if exercise.ignore_punctuation:
        value = ''.join(c for c in value if not unicodedata.category(c).startswith('P'))
    return ' '.join(value.split())

def correct(value, question):
    return any(normalize(value,question.exercise) == normalize(a,question.exercise) for a in question.accepted_answers)
