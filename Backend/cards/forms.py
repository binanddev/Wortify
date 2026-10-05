"""Server-side payload validation for API writes; no form rendering."""
from django import forms
from .models import Deck, Card, StudySettings, Folder


class FolderForm(forms.ModelForm):
    class Meta:
        model = Folder
        fields = ['name', 'parent', 'theory_format', 'theory_content']

    def __init__(self, *args, user, language, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['parent'].queryset = Folder.objects.filter(owner=user, language=language)

    def clean_parent(self):
        parent = self.cleaned_data.get('parent')
        seen = {self.instance.pk} if self.instance.pk else set()
        cursor = parent
        depth = 1
        while cursor:
            if cursor.pk in seen:
                raise forms.ValidationError('Không thể chuyển folde vào chính nó hoặc folde bên trong nó.')
            seen.add(cursor.pk)
            cursor = cursor.parent
            depth += 1
        children = {}
        for pk, parent_id in self.fields['parent'].queryset.values_list('pk', 'parent_id'):
            children.setdefault(parent_id, []).append(pk)
        frontier = [self.instance.pk] if self.instance.pk else []
        height = 0
        visited = set()
        while frontier:
            height += 1
            if visited.intersection(frontier):
                raise forms.ValidationError('Cấu trúc folde không hợp lệ.')
            visited.update(frontier)
            frontier = [child for pk in frontier for child in children.get(pk, [])]
        if depth + max(0, height - 1) > 10:
            raise forms.ValidationError('Folde hỗ trợ tối đa 10 cấp.')
        return parent


class DeckForm(forms.ModelForm):
    language = forms.ChoiceField(choices=[('de', 'Tiếng Đức'), ('en', 'Tiếng Anh')])
    level = forms.ChoiceField(choices=[(x,x) for x in ['A1','A2','B1','B2','C1','C2']])
    class Meta:
        model = Deck
        fields = ['title', 'description', 'level', 'topic', 'language', 'folder']

    def __init__(self, *args, user, language=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['folder'].queryset = Folder.objects.filter(owner=user, **({'language': language} if language else {}))
        self.fields['folder'].empty_label = 'Chưa xếp thư mục'


class CardForm(forms.ModelForm):
    accepted_answers = forms.CharField(label='Cách trả lời khác cho từ', required=False, help_text='Mỗi dòng một cách trả lời được chấp nhận. Có thể để trống.')
    accepted_examples = forms.CharField(label='Cách nói khác cho câu ví dụ', required=False, help_text='Mỗi dòng một câu hợp lệ. Có thể để trống.')

    class Meta:
        model = Card
        exclude = ['deck', 'created_at', 'updated_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name in ('accepted_answers', 'accepted_examples'):
            self.initial[name] = '\n'.join(getattr(self.instance, name, []) or [])

    def clean(self):
        data = super().clean()
        for name in ('accepted_answers', 'accepted_examples'):
            value = [line.strip() for line in (data.get(name) or '').splitlines() if line.strip()]
            if len(value) > 20 or any(len(v) > 2000 for v in value):
                self.add_error(name, 'Nhập tối đa 20 dòng, mỗi dòng không quá 2000 ký tự.')
            else:
                data[name] = value
        return data


class SettingsForm(forms.ModelForm):
    class Meta:
        model = StudySettings
        exclude = ['user', 'language']

    def clean_new_cards_per_day(self):
        value = self.cleaned_data['new_cards_per_day']
        if value > 200:
            raise forms.ValidationError('Chọn từ 0 đến 200 thẻ.')
        return value

    def clean_session_minutes(self):
        value = self.cleaned_data['session_minutes']
        if not 1 <= value <= 120:
            raise forms.ValidationError('Chọn từ 1 đến 120 phút.')
        return value
