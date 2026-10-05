import unicodedata


def normalize(text, ignore_case=True, ignore_punctuation=True, transliteration=False):
    text = unicodedata.normalize('NFC', text)
    if ignore_case:
        text = text.lower()
    if ignore_punctuation:
        text = ''.join(' ' if unicodedata.category(c).startswith('P') else c for c in text)
    if transliteration:
        for source, dest in [('ä', 'ae'), ('ö', 'oe'), ('ü', 'ue'), ('ß', 'ss'), ('Ä', 'Ae'), ('Ö', 'Oe'), ('Ü', 'Ue')]:
            text = text.replace(source, dest)
    return ' '.join(text.split())


def align(target, actual):
    a, b = target.split(), actual.split()
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        dp[i][0] = i
    for j in range(len(b) + 1):
        dp[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            dp[i][j] = min(dp[i-1][j] + 1, dp[i][j-1] + 1, dp[i-1][j-1] + (a[i-1] != b[j-1]))
    i, j, words = len(a), len(b), []
    while i or j:
        if i and j and dp[i][j] == dp[i-1][j-1] + (a[i-1] != b[j-1]):
            words.append({'kind': 'correct' if a[i-1] == b[j-1] else 'replace', 'expected': a[i-1], 'actual': b[j-1]})
            i, j = i-1, j-1
        elif i and dp[i][j] == dp[i-1][j] + 1:
            words.append({'kind': 'missing', 'expected': a[i-1], 'actual': ''})
            i -= 1
        else:
            words.append({'kind': 'extra', 'expected': '', 'actual': b[j-1]})
            j -= 1
    return {'words': list(reversed(words)), 'score': round(100 * max(0, 1 - dp[-1][-1] / max(len(a), len(b), 1))), 'is_correct': bool(b) and a == b}


def compare(target, transcript, alternatives=(), **options):
    actual = normalize(transcript, **options)
    matches = [{**align(normalize(item, **options), actual), 'matched_target': item, 'normalized_target': normalize(item, **options)} for item in [target, *alternatives]]
    best = max(matches, key=lambda item: (item['is_correct'], item['score']))
    return {**best, 'target': target, 'transcript': transcript, 'normalized_transcript': actual}
