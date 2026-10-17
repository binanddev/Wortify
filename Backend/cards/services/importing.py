import csv
import json
from django.core.exceptions import ValidationError

FIELDS = ['german_text', 'vietnamese_meaning', 'example_german', 'example_vietnamese', 'part_of_speech', 'notes', 'usage', 'article', 'plural_form']


def parse_cards(text, separator):
    from cards.forms import CardForm
    if separator not in (',', '\t', ';', '|'):
        raise ValidationError('Invalid separator.')
    normalized = text.lstrip('\ufeff').strip()
    if normalized.startswith('['):
        try:
            cards = json.loads(normalized)
        except (ValueError, RecursionError):
            raise ValidationError('Invalid JSON. Paste the complete array of cards.')
        if not isinstance(cards, list) or not 1 <= len(cards) <= 2000:
            raise ValidationError('Enter between 1 and 2000 cards.')
        rows, errors = [], []
        for index, card in enumerate(cards, 1):
            if not isinstance(card, dict) or set(card) - set(FIELDS) or any(not isinstance(value, str) for value in card.values()):
                errors.append(f'Card {index}: use the named fields from the guide with text values.')
                continue
            form = CardForm({**card, 'position': len(rows)})
            if not form.is_valid():
                errors.append(f'Card {index}: check {", ".join(form.errors)}.')
                continue
            rows.append({field: form.cleaned_data.get(field, '') for field in FIELDS})
        if errors:
            raise ValidationError(errors[:20])
        return rows
    # Quizlet copies two columns separated by a tab.
    lines = [line for line in text.splitlines() if line.strip()]
    if lines and all(line.count('\t') == 1 for line in lines):
        separator = '\t'
    rows, errors = [], []
    for line_number, line in enumerate(text.lstrip('\ufeff').splitlines(), 1):
        if not line.strip():
            continue
        if len(rows) >= 2000:
            raise ValidationError('Up to 2000 cards per import.')
        try:
            columns = next(csv.reader([line], delimiter=separator, skipinitialspace=True, strict=True))
        except csv.Error:
            errors.append(f'Line {line_number}: invalid quotation marks.')
            continue
        if not 2 <= len(columns) <= len(FIELDS):
            errors.append(f'Line {line_number}: expected 2–9 columns. Quote content that contains the separator.')
            continue
        data = dict(zip(FIELDS, [value.strip() for value in columns]))
        form = CardForm({**data, 'position': len(rows)})
        if not form.is_valid():
            labels = ', '.join(str(form.fields[key].label or key) for key in form.errors if key in form.fields)
            errors.append(f'Line {line_number}: check {labels}.')
            continue
        rows.append({field: form.cleaned_data.get(field, '') for field in FIELDS})
    if errors:
        raise ValidationError(errors[:20])
    if not rows:
        raise ValidationError('Enter at least one line containing a German term and Vietnamese meaning.')
    return rows
