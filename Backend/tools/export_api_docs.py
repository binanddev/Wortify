"""Export shareable API docs without starting a web server."""
import json
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()
from api.api_reference import reference_data, markdown_reference, postman_collection

if __name__ == '__main__':
    destination = ROOT / 'docs'
    destination.mkdir(exist_ok=True)
    data = reference_data()
    (destination / 'API_REFERENCE.md').write_text(markdown_reference(data), encoding='utf-8')
    (destination / 'wortify.postman_collection.json').write_text(
        json.dumps(postman_collection(data), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Exported {len(data["endpoints"])} API paths to {destination}')
