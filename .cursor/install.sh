#!/usr/bin/env bash
# Idempotent repository bootstrap for the Eventtz Cloud Agent environment.
# Toolchain (Python 3.13, Poetry, Node, Docker, Supabase CLI) lives in the base
# image/snapshot; this script only refreshes source-derived dependency state.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"

echo "==> Backend: poetry install (Python 3.13)"
cd "$REPO_ROOT/backend"
poetry env use python3.13 >/dev/null
poetry install --extras dev --no-interaction

echo "==> Frontend: npm ci"
cd "$REPO_ROOT/frontend"
npm ci

echo "==> install.sh complete"
