#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if [[ ! -x .venv/bin/python ]]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python manage.py migrate
exec .venv/bin/python manage.py runserver "127.0.0.1:${WORTIFY_BACKEND_PORT:-8000}"
