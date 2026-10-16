#!/usr/bin/env bash
# Run api/ on :8001 over its docker-compose Postgres, with every outside service switched off.
set -euo pipefail
ACCEPTANCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ACCEPTANCE_DIR/.." && pwd)"

# Outside services off: no emails, payments, AI, uploads, analytics or error reports leave the machine.
export STRIPE_SECRET_KEY="" STRIPE_WEBHOOK_SECRET="" RESEND_API_KEY="" OPENAI_API_KEY=""
export AWS_ACCESS_KEY="" AWS_SECRET_ACCESS_KEY="" SENTRY_DSN="" MIXPANEL_TOKEN=""
export CURSOR_AUTOMATION_WEBHOOK_URL="" CURSOR_AUTOMATION_WEBHOOK_SECRET=""
export OS_PLACES_API_KEY="" GETADDRESS_API_KEY=""
# Empty keeps local visibility rules generic.
export QA_CLIENT_VENDOR_VISIBILITY=""
export FRONTEND_URL="http://localhost:3001" LOG_LEVEL=WARNING
# The acceptance super admin (see support/accounts.py) relies on the email fallback.
export SUPER_ADMIN_EMAILS="acceptance-super-admin@example.com"

cd "$REPO_ROOT/api"
# api/'s own Postgres (:5434) and Redis (:6381), migrated to head. Settings'
# local defaults point at them; nothing hosted is ever read.
#
# API_PORT and API_DB_NAME let several worktrees run their own server and
# database against the one shared compose Postgres at the same time
# (workstream N uses port 81NN and database eventtz_wsN). The matching test
# run sets BASE_URL and ACCEPTANCE_DATABASE_URL, which conftest.py honours.
api_port="${API_PORT:-8001}"
api_db_name="${API_DB_NAME:-eventtz}"
export APP_ENV=local
export DATABASE_URL="postgresql+psycopg://postgres:postgres@127.0.0.1:5434/$api_db_name"
docker compose up -d --wait
# Create the database on first use; the stock `eventtz` already exists.
docker compose exec -T postgres psql -U postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname = '$api_db_name'" | grep -q 1 ||
  docker compose exec -T postgres createdb -U postgres "$api_db_name"
env -u VIRTUAL_ENV poetry run alembic upgrade head
exec env -u VIRTUAL_ENV poetry run uvicorn app.main:app --host 127.0.0.1 --port "$api_port"
