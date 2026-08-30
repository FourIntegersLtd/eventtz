#!/usr/bin/env bash
# Next.js dev server on :3000 (proxies /api/v1 -> FastAPI). Started by the `frontend` terminal.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/frontend"
exec npm run dev
