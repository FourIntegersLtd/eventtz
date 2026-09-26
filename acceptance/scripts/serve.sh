#!/usr/bin/env bash
# Run the API under test against a LOCAL database with every outside service switched off.
#
#   scripts/serve.sh baseline   # a copy of backend/ on :8000 over local Supabase (the behaviour we freeze)
#   scripts/serve.sh api        # the rebuilt api/ on :8001 over its docker-compose Postgres (must match)
#
# The baseline runs from a copy in acceptance/.run/ that has no .env file, so the
# hosted credentials in backend/.env can never be loaded. backend/ itself is only read.
set -euo pipefail
ACCEPTANCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ACCEPTANCE_DIR/.." && pwd)"
target="${1:-baseline}"

# Outside services off: no emails, payments, AI, uploads, analytics or error reports leave the machine.
export STRIPE_SECRET_KEY="" STRIPE_WEBHOOK_SECRET="" RESEND_API_KEY="" OPENAI_API_KEY=""
export AWS_ACCESS_KEY="" AWS_SECRET_ACCESS_KEY="" SENTRY_DSN="" MIXPANEL_TOKEN=""
export CURSOR_AUTOMATION_WEBHOOK_URL="" CURSOR_AUTOMATION_WEBHOOK_SECRET=""
export OS_PLACES_API_KEY="" GETADDRESS_API_KEY=""
# The baseline defaults this to real QA accounts; empty keeps local visibility rules generic.
export QA_CLIENT_VENDOR_VISIBILITY=""
export IS_PRODUCTION=false FRONTEND_URL="http://localhost:3000" LOG_LEVEL=WARNING
# The acceptance super admin (see support/accounts.py) relies on the email fallback.
export SUPER_ADMIN_EMAILS="acceptance-super-admin@example.com"

case "$target" in
  baseline)
    [ -f "$ACCEPTANCE_DIR/.env.local" ] || "$ACCEPTANCE_DIR/scripts/local_env.sh"
    set -a
    # shellcheck disable=SC1091
    . "$ACCEPTANCE_DIR/.env.local"
    set +a
    run_dir="$ACCEPTANCE_DIR/.run/backend"
    mkdir -p "$run_dir"
    rsync -a --delete --exclude '.env' --exclude '.env.*' --exclude '.venv' \
      --exclude '__pycache__' --exclude 'logs' "$REPO_ROOT/backend/" "$run_dir/"
    python_bin="$(cd "$REPO_ROOT/backend" && env -u VIRTUAL_ENV poetry env info -p)/bin/python"
    export LOG_DIR="$run_dir/logs"
    cd "$run_dir"
    exec "$python_bin" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
    ;;
  api)
    cd "$REPO_ROOT/api"
    # api/'s own Postgres (:5434) and Redis (:6381), migrated to head. Settings'
    # local defaults point at them; nothing hosted is ever read.
    export APP_ENV=local DATABASE_URL="postgresql+psycopg://postgres:postgres@127.0.0.1:5434/eventtz"
    docker compose up -d --wait
    env -u VIRTUAL_ENV poetry run alembic upgrade head
    exec env -u VIRTUAL_ENV poetry run uvicorn app.main:app --host 127.0.0.1 --port 8001
    ;;
  *) echo "usage: serve.sh baseline|api" >&2; exit 2 ;;
esac
