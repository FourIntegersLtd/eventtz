#!/usr/bin/env bash
# Write acceptance/.env.local with the LOCAL Supabase URL and service key.
#
# Reads them from `supabase status`, so the harness can never pick up the hosted
# project's credentials from backend/.env. Run after `npx supabase start`.
set -euo pipefail
ACCEPTANCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$ACCEPTANCE_DIR/.." && pwd)"
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"

status_env="$(cd "$REPO_ROOT" && npx -y supabase status -o env 2>/dev/null)"
api_url="$(printf '%s\n' "$status_env" | sed -n 's/^API_URL="\(.*\)"$/\1/p')"
service_key="$(printf '%s\n' "$status_env" | sed -n 's/^SERVICE_ROLE_KEY="\(.*\)"$/\1/p')"

# Refuse anything that is not the local stack: this harness writes test users and data.
case "$api_url" in
  http://127.0.0.1:*|http://localhost:*) ;;
  *) echo "local_env.sh: refusing non-local Supabase URL '$api_url'" >&2; exit 1 ;;
esac

cat > "$ACCEPTANCE_DIR/.env.local" <<ENV
SUPABASE_URL=$api_url
SUPABASE_SERVICE_ROLE_KEY=$service_key
ENV
echo "wrote $ACCEPTANCE_DIR/.env.local ($api_url)"
