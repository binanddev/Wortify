"""Optional explicit env-file loader for local CLI commands; existing env wins."""
import os
import re
from pathlib import Path

def load_environment():
    filename = os.environ.get('WORTIFY_ENV_FILE')
    if not filename:
        return
    for number, line in enumerate(Path(filename).read_text(encoding='utf-8-sig').splitlines(), 1):
        line = line.strip()
        if not line or line.startswith('#'): continue
        key, separator, value = line.partition('=')
        key, value = key.strip(), value.strip()
        if not separator or not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key):
            raise ValueError(f'Invalid environment entry on line {number}')
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        os.environ.setdefault(key, value)
