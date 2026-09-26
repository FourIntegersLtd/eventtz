#!/usr/bin/env bash
# Delete every seeded test account (and everything that hangs off it) from the LOCAL Supabase.
#
# Each run seeds fresh `@example.com` accounts and never deletes them. After a few
# hundred runs the baseline's explore route fails: it lists every vendor id in one
# PostgREST `in.(...)` filter and the URL grows past the limit (414, then a 500).
# Resetting keeps the freeze suite measuring behaviour, not accumulated data.
#
# Only ever touches the local `supabase_db_*` container, never a hosted project,
# and refuses to run if any account outside `@example.com` exists there.
set -euo pipefail
container="$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | head -1)"
if [ -z "$container" ]; then
  echo "reset_data.sh: no local supabase_db_* container is running" >&2
  exit 1
fi
real_accounts="$(docker exec "$container" psql -U postgres -d postgres -Atc \
  "select count(*) from auth.users where email not like '%@example.com'")"
if [ "$real_accounts" != "0" ]; then
  echo "reset_data.sh: $real_accounts non-test accounts found in $container; refusing to reset" >&2
  exit 1
fi
docker exec -i "$container" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
begin;
-- Truncating users cascades to every table that references an account (vendors, bookings, chat...).
truncate table public.users cascade;
delete from auth.users where email like '%@example.com';
commit;
SQL
echo "reset_data.sh: cleared seeded accounts from $container"
