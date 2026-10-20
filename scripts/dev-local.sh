#!/usr/bin/env bash
# Local browser dev: API on :8001 (uvicorn --reload) and web on :3001 (Next dev).
# Usage: ./scripts/dev-local.sh
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="${HOME}/.nvm/versions/node/v22.22.3/bin:${PATH}"

for port in 8001 3001; do
  if lsof -ti ":${port}" >/dev/null 2>&1; then
    echo "Stopping process on :${port}…"
    lsof -ti ":${port}" | xargs kill -9 2>/dev/null || true
  fi
done

sleep 1

echo "Starting API (make dev) on http://127.0.0.1:8001 …"
(cd "${repo_root}/api" && make dev) &
api_pid=$!

echo "Starting web (npm run dev) on http://localhost:3001 …"
(cd "${repo_root}/web" && npm run dev) &
web_pid=$!

trap 'kill "$api_pid" "$web_pid" 2>/dev/null || true' INT TERM EXIT

wait
