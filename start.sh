#!/usr/bin/env bash
set -Eeuo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
export PYTHONUTF8=1
if [[ -x .venv/Scripts/python.exe ]]; then
  PYTHON="$PWD/.venv/Scripts/python.exe"
elif [[ -x .venv/bin/python ]]; then
  PYTHON="$PWD/.venv/bin/python"
else
  command -v python3 >/dev/null || { echo 'Please install Python 3.12+.'; exit 1; }
  python3 -m venv .venv
  if [[ -x .venv/Scripts/python.exe ]]; then PYTHON="$PWD/.venv/Scripts/python.exe"; else PYTHON="$PWD/.venv/bin/python"; fi
fi
command -v npm >/dev/null || { echo 'Please install Node.js 22.12+ (includes npm).'; exit 1; }
"$PYTHON" -m pip install -r requirements.txt
if [[ ! -f frontend-react/node_modules/vite/bin/vite.js ]]; then
  npm --prefix frontend-react ci --cache "$PWD/.npm-cache"
fi
"$PYTHON" manage.py migrate
if [[ "${IMPORT_BOOKS:-0}" == 1 ]]; then "$PYTHON" manage.py import_book_json; fi
npm run build
exec "$PYTHON" tools/run_local.py
