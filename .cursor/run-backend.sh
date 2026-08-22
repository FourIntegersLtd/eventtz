#!/usr/bin/env bash
# FastAPI dev server (auto-reload) on :8000. Started by the `backend` terminal.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"
cd "$REPO_ROOT/backend"
exec poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
