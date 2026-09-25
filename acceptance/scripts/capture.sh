#!/usr/bin/env bash
# Run a golden-capture script (acceptance/capture/*.py) with the BASELINE code importable.
#
#   scripts/capture.sh capture/content_goldens.py
#
# The script runs on the baseline's Python against the read-only copy in
# acceptance/.run/backend (no .env, outside services off), so backend/ is never
# written to (no __pycache__) and hosted credentials are never loaded.
set -euo pipefail
ACCEPTANCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ACCEPTANCE_DIR/.." && pwd)"
capture_script="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"

[ -f "$ACCEPTANCE_DIR/.env.local" ] || "$ACCEPTANCE_DIR/scripts/local_env.sh"
set -a
# shellcheck disable=SC1091
. "$ACCEPTANCE_DIR/.env.local"
set +a
export STRIPE_SECRET_KEY="" RESEND_API_KEY="" OPENAI_API_KEY="" SENTRY_DSN="" MIXPANEL_TOKEN=""
export IS_PRODUCTION=false LOG_LEVEL=WARNING

run_dir="$ACCEPTANCE_DIR/.run/backend"
mkdir -p "$run_dir"
rsync -a --delete --exclude '.env' --exclude '.env.*' --exclude '.venv' \
  --exclude '__pycache__' --exclude 'logs' "$REPO_ROOT/backend/" "$run_dir/"
python_bin="$(cd "$REPO_ROOT/backend" && env -u VIRTUAL_ENV poetry env info -p)/bin/python"
export LOG_DIR="$run_dir/logs" PYTHONPATH="$run_dir" PYTHONDONTWRITEBYTECODE=1
cd "$run_dir"
exec "$python_bin" "$capture_script" "$REPO_ROOT/api/tests/golden"
