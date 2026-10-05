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
status=0
"$PYTHON" tools/run_local.py --check || status=$?
if [[ "$status" == 10 ]]; then exit 0; fi
if [[ "$status" != 0 ]]; then exit "$status"; fi
command -v npm >/dev/null || { echo 'Please install Node.js 22.12+ (includes npm).'; exit 1; }
"$PYTHON" -m pip install -r Backend/requirements.txt
if [[ ! -f Frontend/node_modules/vite/bin/vite.js ]]; then
  npm --prefix Frontend ci --cache "$PWD/.npm-cache"
fi
"$PYTHON" Backend/manage.py migrate
npm run build
exec "$PYTHON" tools/run_local.py
