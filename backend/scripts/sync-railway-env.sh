#!/usr/bin/env bash
# Push KEY=value lines from backend/.env to Railway (skips comments and blanks).
# Usage: cd backend && ./scripts/sync-railway-env.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

if ! command -v railway >/dev/null 2>&1; then
  echo "Railway CLI not found. Install: brew install railway" >&2
  exit 1
fi

cd "$ROOT"

if ! railway status >/dev/null 2>&1; then
  echo "Not linked to a Railway project. Run: railway link" >&2
  exit 1
fi

args=()
count=0
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" || "$line" == \#* ]] && continue

  # Normalize KEY = "value" → KEY=value
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    val="${BASH_REMATCH[2]}"
    val="${val#\"}"; val="${val%\"}"
    val="${val#\'}"; val="${val%\'}"
    args+=(--set "${key}=${val}")
    count=$((count + 1))
  fi
done < "$ENV_FILE"

if [[ $count -eq 0 ]]; then
  echo "No variables found in $ENV_FILE" >&2
  exit 1
fi

echo "Setting $count Railway variable(s) on service: $(railway status 2>/dev/null | awk -F': ' '/Service:/ {print $2}')"
railway variables "${args[@]}" --skip-deploys
echo "Done. Run 'railway variables -k' to verify (values hidden for secrets)."
