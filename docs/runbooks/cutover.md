# Cut-over: moving the live Supabase data to `api/`'s Railway Postgres

This is the human-run procedure for the real cut-over: replacing `backend/` +
`frontend/` (the live baseline, on Supabase) with `api/` + `web/` (on Railway
Postgres), keeping the same URLs. **Nothing here has been run against the
hosted database.** It has only been rehearsed locally, between the local
Supabase container and a throwaway local database — see "What was rehearsed"
at the bottom, including the exact commands.

The tool this runbook drives is `api/app/migration/` (`python -m app.migration
export|load|verify|report`). It refuses to run against anything that is not
`localhost`/`127.0.0.1` unless given `--i-have-approval-for-hosted`
(`app/app/migration/safety.py`) — that flag is this runbook's line in the
sand: nobody passes it without having read this document first.

## Before you start: read this first

- **This is the one irreversible-feeling step in the rebuild.** Everything
  else in `docs/rebuild-workstreams.md` can be redone; a cut-over that goes
  wrong mid-flight, with real bookings and payments in flight, cannot be
  casually retried. Budget a maintenance window, not a quick deploy.
- The whole procedure assumes `api/` and `web/` already pass parity: `make
  ci` green, the acceptance suite green with `TARGET=api`, and the route
  parity script reporting 0 missing of 178 (workstream 18).
- Real customer emails and password hashes will pass through your terminal.
  Never paste them into a chat, ticket, or log aggregator. The migration tool
  itself never writes them anywhere but the target database and a local
  scratch directory you control (never inside the repository — `export`'s
  default `--out-dir` is `/tmp/eventtz-cutover-rehearsal`; use a fresh,
  non-repository directory for the real run and delete it afterwards).

## 1. Maintenance window: stop writes to Supabase

1. Announce the window (vendors and clients currently mid-checkout should see
   a "back shortly" page, not a silent failure).
2. Put the baseline (`backend/`) behind a maintenance page, or scale it to
   zero, so nothing writes to Supabase Postgres or Supabase Auth once the
   export starts. A row written after `export` runs and before `api/` goes
   live is a row that never reaches Railway.
3. Confirm no background jobs are still running against Supabase (the
   baseline's own job runner, any Stripe webhook retries in flight).

## 2. Export

From `api/`, against the **hosted** Supabase Postgres connection string
(get it from the Supabase dashboard, not from a checked-in `.env`) and the
service-role connection needed to read `auth.users`:

```bash
python -m app.migration export \
  --source-url "postgresql://postgres:<password>@<supabase-host>:5432/postgres" \
  --out-dir /path/outside/the/repo/cutover-export \
  --i-have-approval-for-hosted
```

This writes one `.ndjson` file per table under `<out-dir>/data/`, one
`auth_users.ndjson` with `id` / `email` / `encrypted_password` /
`email_confirmed_at`, and a `manifest.json` recording each table's column
order and row count. Nothing is written back to Supabase.

Sanity-check the manifest against what you expect (`cat
<out-dir>/manifest.json`, or the row counts the export command prints)
before continuing — a suspiciously low count for `users` or `booking_requests`
is worth stopping over.

## 3. Deploy `api/`, `web/` and the worker — but do not point DNS at them yet

Deploy the Railway services (`api`, its worker, `web`) so the target database
exists and is at `alembic upgrade head` (the `api` service's pre-deploy step
runs this automatically; do not run `alembic upgrade head` from your own
machine against the hosted database). Confirm the deploy is healthy
(`/health`) before the next step. Keep DNS / the load balancer still pointing
at the baseline — this deploy is not live traffic yet.

## 4. Load

```bash
python -m app.migration load \
  --target-url "$DATABASE_URL_FROM_RAILWAY" \
  --out-dir /path/outside/the/repo/cutover-export \
  --i-have-approval-for-hosted
```

This truncates and reloads all 25 tables inside one transaction (rolling back
entirely if anything fails partway through), disabling triggers for the
load and re-enabling them — including the daily-capacity trigger from
baseline migration `033` — before it commits. It then maps
`auth.users.encrypted_password` onto `users.password_hash` and backfills
`users.email_verified_at` from `auth.users.email_confirmed_at` wherever
Eventtz's own verification had not already set it.

## 5. Verify

```bash
python -m app.migration verify \
  --source-url "postgresql://postgres:<password>@<supabase-host>:5432/postgres" \
  --target-url "$DATABASE_URL_FROM_RAILWAY" \
  --out-dir /path/outside/the/repo/cutover-export \
  --i-have-approval-for-hosted
```

Read the printed report (also saved as `<out-dir>/verify_report.json`):

- **Row counts** must match exactly for every table. A mismatch means stop
  and investigate before going further — do not proceed on a "close enough"
  count.
- **Spot check** mismatches: any listed column difference needs a manual
  look before continuing.
- **Users with no password hash**: expected for the `public.users` rows the
  local rehearsal found with no matching `auth.users` row (accounts created
  directly in the database, never through Supabase Auth signup — the local
  rehearsal found 17). Every email on this list needs a password-reset email
  once `api/` is live (§7).

Do not go further than this until the report is clean or every difference is
explained and accepted.

## 6. Point traffic at `api/` / `web/`

- Switch DNS / the load balancer to the new services, on the **same URLs**
  the baseline served (`AGENTS.md`: "serving the same URLs").
- The Stripe webhook URL does not change — Stripe was already pointed at
  `https://api.eventtz.com/api/v1/webhooks/stripe` (or whatever the
  production URL is); `api/` serves that same path, so nothing needs
  re-registering with Stripe. Confirm this in the Stripe dashboard rather
  than assuming it.
- Take the baseline out of maintenance mode only if you are rolling back
  (§9); otherwise leave it stopped.

## 7. Smoke test

```bash
python3 scripts/smoke/smoke_test.py --base-url https://api.eventtz.com
```

See `docs/runbooks/post-deploy-smoke-test.md` for what each check proves.
Additionally, right after cut-over:

- Sign in as one real (not `@example.com`) vendor and one client account by
  hand, in a browser, and confirm each can see their own bookings/vendors —
  proof the imported data reads back correctly for a real person, not just a
  seeded one.
- Send the bcrypt-drain query's cohort a password-reset email in the days
  after cut-over (below) rather than all at once, so a mistake in the import
  does not lock out every user in the same minute.

## 8. Keep Supabase read-only for 30 days

Do not delete or unpause the Supabase project. Revoke write access (rotate
the service-role key, or set the database to a read-only replica if the
Supabase plan supports it) so it cannot silently diverge from Railway, but
keep it queryable as a reference for at least 30 days in case `verify`'s
spot check missed something that only shows up later.

## 9. Rollback plan

If something is wrong after cut-over and it is faster to roll back than fix
forward:

1. Point DNS / the load balancer back at the baseline (`backend/` /
   `frontend/`), which has not been touched and still has its own,
   unmodified Supabase data — nothing was deleted from Supabase in step 2 or
   4, only read from it.
2. Any booking, payment or message created against `api/` **after** cut-over
   and **before** the rollback is now only in the Railway database, not in
   Supabase. Export those rows by hand (their `created_at` is after the cut-over
   timestamp you noted in step 1) and re-apply them to Supabase manually, or
   accept the gap and notify the affected users — a decision for whoever
   is running the cut-over, not this tool.
3. Take `api/` back out of traffic once the baseline is confirmed healthy.
4. Treat the failed attempt as a rehearsal finding: fix whatever `verify`
   would have caught, and re-rehearse locally (below) before trying again.

## The bcrypt-drain query (ADR 0003)

Imported Supabase passwords stay as bcrypt hashes until the owner's next
sign-in, when `app/features/identity/tokens.py` verifies against bcrypt and
`service_session.py` rehashes to argon2 in the same request. Track progress
with:

```sql
SELECT count(*) FILTER (WHERE password_hash LIKE '$2%') AS still_bcrypt,
       count(*) AS total
FROM public.users
WHERE deleted_at IS NULL AND password_hash IS NOT NULL;
```

Once `still_bcrypt` is 0, delete `_verify_imported_bcrypt` and the `bcrypt`
Poetry dependency (ADR 0003, "Consequences"; the `AGENTS.md` trap "Imported
passwords are bcrypt").

## What was rehearsed (this workstream)

Rehearsed locally between the local Supabase container (source,
`127.0.0.1:54322`) and a fresh database on the `api/` compose Postgres
(target, `127.0.0.1:5434/eventtz_cutover_rehearsal`), migrated with `alembic
upgrade head`. The exact commands:

```bash
# Target database, migrated to head
docker exec eventtz-api-postgres-1 psql -U postgres -d postgres \
  -c 'CREATE DATABASE eventtz_cutover_rehearsal'
cd api
DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:5434/eventtz_cutover_rehearsal \
  poetry run python -m alembic upgrade head

# Export from the local Supabase container
poetry run python -m app.migration export \
  --source-url postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  --out-dir /tmp/eventtz-cutover-rehearsal

# Load into the rehearsal database
poetry run python -m app.migration load \
  --target-url postgresql://postgres:postgres@127.0.0.1:5434/eventtz_cutover_rehearsal \
  --out-dir /tmp/eventtz-cutover-rehearsal

# Verify
poetry run python -m app.migration verify \
  --source-url postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  --target-url postgresql://postgres:postgres@127.0.0.1:5434/eventtz_cutover_rehearsal \
  --out-dir /tmp/eventtz-cutover-rehearsal
```

The verify report from that run, and a sign-in against the migrated data
proving a bcrypt hash verifies and is rehashed to argon2, are quoted in the
workstream 17 hand-off note (final commit message on this branch).

The first rehearsal caught a real bug in `load.py`: truncating and loading
one table at a time (`booking_notifications`, then later `booking_requests`)
meant a later table's `TRUNCATE ... CASCADE` silently wiped rows an earlier
table had already been loaded with, whenever the earlier table foreign-keyed
forward to the later one — `booking_notifications.booking_id` references
`booking_requests.id` `ON DELETE CASCADE`. `TRUNCATE ... CASCADE` cascades to
every table with a live foreign key into the one truncated regardless of
`session_replication_role`, so six tables (`booking_notifications`,
`booking_requests`, `booking_reviews`, `celebration_plans`,
`celebration_plan_items`, `contact_submissions`) came back empty on the first
`load`, even though `load` itself reported success. Fixed by truncating every
table in one statement before any row is inserted, so no truncate ever runs
after an insert; a regression test
(`api/tests/migration/test_pipeline.py::test_load_keeps_a_row_whose_table_loads_before_the_table_it_references`)
covers it. This is exactly why this runbook says to rehearse first.
