# Cut-over: pointing traffic at `api/` + `web/` on the same Supabase database

This is the human-run procedure for the real cut-over: replacing `backend/` +
`frontend/` (the live baseline) with `api/` + `web/`, keeping the same URLs.
**The data does not move** (ADR 0002): `api/` uses the same Supabase Postgres
as plain Postgres, through the session pooler. Cut-over adopts that database
into Alembic, copies the password hashes out of Supabase Auth, and switches DNS.

**Nothing here has been run against the hosted database.** It has been
rehearsed on a copy of the local Supabase stack (see "What was rehearsed").

## Before you start: read this first

- Budget a maintenance window, not a quick deploy: the schema changes and the
  hash copy must happen while nothing writes.
- `api/` and `web/` must already pass parity: `make ci` green, the acceptance
  suite green with `TARGET=api`, route parity 0 missing.
- **Schema changes reach the shared database only on cut-over day.** Until then
  the baseline migrates it from `backend/sql/`; do not point any `api/`
  deploy's `DATABASE_URL` at it earlier, or its pre-deploy `alembic upgrade head`
  would run.
- Get the session-pooler URL from the Supabase dashboard (Connect → Session
  pooler), never from a checked-in `.env`:
  `postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require`.
  URL-encode the password. Check the plan's pooler pool size against the
  connection budget in `docs/runbooks/railway.md` ("Database").
- Take (or confirm) a fresh Supabase backup / PITR point just before step 2.
  It is the rollback for everything below.
- `app/migration` refuses any host but localhost unless given
  `--i-have-approval-for-hosted`. Nobody passes that flag without having read
  this document.

## 1. Maintenance window: stop writes

1. Announce the window; clients mid-checkout should see a "back shortly" page.
2. Put the baseline (`backend/`) behind a maintenance page or scale it to zero,
   so nothing writes to Postgres or Supabase Auth.
3. Confirm no background jobs or Stripe webhook retries are still landing on the
   baseline.

## 2. Adopt the schema

From `api/`, with `DATABASE_URL` set to the session-pooler URL:

```bash
alembic upgrade 0001   # procrastinate's queue: the one part Supabase does not have yet
alembic stamp 0002     # the baseline schema: already there, built by backend/sql/
alembic upgrade head   # 0003 sign-in tables, 0004 users comment + Data API grants revoked
alembic check          # must print "No new upgrade operations detected."
```

The order matters: `stamp 0002` on its own would mark `0001` as applied too, and
the queue tables would never be created (the worker fails on start). `0004`
revokes Supabase's default `anon`/`authenticated` access to `public`, so the
public anon key can no longer read `refresh_tokens` or the queue through the
Data API; `service_role` keeps its grants, so a rollback to the baseline works.

If `backend/sql/` gained a file after `0002`'s snapshot that has no Alembic
revision yet, stop: it must land as a revision first (AGENTS.md, "Two schemas").

## 3. Copy the password hashes

```bash
python -m app.migration adopt-auth \
  --target-url "$SESSION_POOLER_URL" \
  --i-have-approval-for-hosted
```

One transaction. It copies `auth.users.encrypted_password` (bcrypt) onto
`users.password_hash` for matching ids, never overwrites an argon2 hash, never
touches a closed account, and only reads the `auth` schema. It prints counts
only. Running it again is safe (it copies nothing new). "Open accounts with no
auth.users row" are people who need a password-reset email after go-live (§6).

## 4. Deploy `api/`, the worker and `web/`

Set the Railway variables (`DATABASE_URL` = the session-pooler URL, pool sizes
from the budget) and deploy. The `api` pre-deploy runs `alembic upgrade head`,
which is now a no-op. Confirm `/health` answers 200 on the Railway domain.

## 5. Point traffic at `api/` / `web/`

- Switch DNS / the load balancer to the new services on the **same URLs**.
- The Stripe webhook path is unchanged (`/api/v1/webhooks/stripe`); confirm the
  endpoint in the Stripe dashboard rather than assuming it.
- In Supabase, turn off the Data API for `public` (or the Data API entirely) and
  disable new Auth sign-ups: nothing uses either any more. Keep the project.

## 6. Smoke test

```bash
python3 scripts/smoke/smoke_test.py --base-url https://api.eventtz.com
```

See `docs/runbooks/post-deploy-smoke-test.md`. Then sign in by hand as one real
vendor and one real client and check each sees their own bookings. Send the
"no auth.users row" cohort (§3) and later the bcrypt-drain cohort a reset email
in batches, not all at once.

## 7. Rollback

Nothing was copied anywhere, so rollback is a switch, not a data repair:

1. Point DNS back at the baseline and scale it up. It still works on the same
   database: the new columns and tables are additive, Supabase Auth was only read,
   and `service_role` (the baseline's key) kept its grants.
2. Anyone who signed in through `api/` now has an argon2 hash in
   `users.password_hash`, which the baseline ignores; their Supabase Auth password
   is unchanged. Passwords changed or reset through `api/` exist only there, so
   those people use "forgot password" on the baseline.
3. Leave the schema as it is; the baseline does not mind it. If it must go,
   `alembic downgrade 0002` removes `0004` and `0003` (grants back, sign-in tables
   and `password_hash` dropped). **Never downgrade below `0002`**: its downgrade
   drops every baseline table. For anything more, restore the backup taken before §2.

## The bcrypt-drain query (ADR 0003)

Imported hashes stay bcrypt until the owner's next sign-in, when
`app/features/identity/tokens.py` verifies them and `service_session.py`
rehashes to argon2 in the same request:

```sql
SELECT count(*) FILTER (WHERE password_hash LIKE '$2%') AS still_bcrypt,
       count(*) AS total
FROM public.users
WHERE deleted_at IS NULL AND password_hash IS NOT NULL;
```

Once `still_bcrypt` is 0, delete `_verify_imported_bcrypt` and the `bcrypt`
Poetry dependency (ADR 0003).

## What was rehearsed (2026-10-16)

On the local Supabase container (`supabase_db_workspace`, Postgres 17, with
`backend/sql/` applied and the baseline's acceptance data), copied so the
baseline's own database was untouched, and migrated as the non-superuser
`postgres` role exactly as the pooler user would be:

```bash
docker exec supabase_db_workspace psql -U supabase_admin -d postgres \
  -c 'CREATE DATABASE eventtz_supa_rehearsal OWNER postgres'
docker exec supabase_db_workspace sh -c \
  'pg_dump -U supabase_admin -d postgres | psql -U supabase_admin -d eventtz_supa_rehearsal -q'
cd api
export DATABASE_URL=postgresql+psycopg://postgres:postgres@127.0.0.1:54322/eventtz_supa_rehearsal
poetry run alembic upgrade 0001 && poetry run alembic stamp 0002 && poetry run alembic upgrade head
poetry run alembic check
poetry run python -m app.migration adopt-auth --target-url "${DATABASE_URL/+psycopg/}"
```

Findings:

- `stamp 0002` alone skipped procrastinate's schema (0 queue tables): hence §2's
  `upgrade 0001` first.
- A `pg_dump -s -n public` of the adopted database matched a fresh `upgrade head`
  on the same server except the `users` comment (`0004` fixes it) and the RLS
  `backend/sql/` enabled on 18 tables (left on: the owning `postgres` role
  bypasses it).
- Supabase's default privileges gave `anon` full access to `refresh_tokens`,
  `refresh_chains` and `alembic_version`, with no RLS: `0004` revokes it.
- A URL-encoded password broke Alembic's config (`%` interpolation); fixed in
  `alembic/env.py`.
- `adopt-auth` copied 1678 hashes, skipped 4 closed accounts, found 34 open
  accounts with no `auth.users` row; a second run copied 0. A baseline-created
  account then signed in through `api/` and its hash became argon2.
- The acceptance suite passed 734/734 with `api/` on the adopted copy, and a
  procrastinate job was deferred and run on it.
