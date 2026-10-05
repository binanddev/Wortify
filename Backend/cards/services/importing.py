import csv
from django.core.exceptions import ValidationError

FIELDS = ['german_text', 'vietnamese_meaning', 'example_german', 'example_vietnamese', 'part_of_speech', 'notes', 'usage', 'article', 'plural_form']


def parse_cards(text, separator):
    from cards.forms import CardForm
    if separator not in (',', '\t', ';', '|'):
        raise ValidationError('Dấu phân cách không hợp lệ.')
    rows, errors = [], []
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            continue
        if len(rows) >= 2000:
            raise ValidationError('Mỗi lần nhập tối đa 2000 thẻ.')
        try:
            columns = next(csv.reader([line], delimiter=separator, skipinitialspace=True, strict=True))
        except csv.Error:
            errors.append(f'Dòng {line_number}: dấu ngoặc kép chưa đúng.')
            continue
        if not 2 <= len(columns) <= len(FIELDS):
            errors.append(f'Dòng {line_number}: cần 2–9 cột. Nếu nội dung có dấu phân cách, đặt nội dung trong ngoặc kép.')
            continue
        data = dict(zip(FIELDS, [value.strip() for value in columns]))
        form = CardForm({**data, 'position': len(rows)})
        if not form.is_valid():
            labels = ', '.join(str(form.fields[key].label or key) for key in form.errors if key in form.fields)
            errors.append(f'Dòng {line_number}: kiểm tra {labels}.')
            continue
        rows.append({field: form.cleaned_data.get(field, '') for field in FIELDS})
    if errors:
        raise ValidationError(errors[:20])
    if not rows:
        raise ValidationError('Hãy nhập ít nhất một dòng gồm từ tiếng Đức và nghĩa tiếng Việt.')
    return rows
