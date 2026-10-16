# Cut-over: pointing traffic at `api/` + `web/` on the same Supabase database

This is the human-run procedure for the real cut-over: replacing `backend/` +
`frontend/` (the live baseline) with `api/` + `web/`, keeping the same URLs.
**The data does not move** (ADR 0002): `api/` uses the same Supabase Postgres
as plain Postgres, through the session pooler. Cut-over adopts that database
into Alembic, copies the password hashes out of Supabase Auth, and switches DNS.

**Nothing here has been run against the hosted database.** It has been
rehearsed on a copy of the local Supabase stack and on a restored backup of live
(see "What was rehearsed").

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

First, read-only, check that no vendor-day is already over its daily cap
(below, "The over-capacity query"). `0005` adds the daily-capacity trigger,
which fires on `UPDATE` too, so an over-cap booking could no longer be
rescheduled or re-activated. Expect 0; if not, resolve those bookings with the
vendor before going on.

From `api/`, with `DATABASE_URL` set to the session-pooler URL:

```bash
alembic upgrade 0001   # procrastinate's queue: the one part Supabase does not have yet
alembic stamp 0002     # the baseline schema: there, but drifted (see "Live drift")
alembic upgrade head   # 0003 sign-in tables, 0004 users comment + Data API grants revoked,
                       # 0005 aligns live's drift with the 0002 snapshot
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

## Live drift: how live differs from `backend/sql/` (2026-10-16 backup)

A schema-only restore of a live backup (`public` + `auth`), compared catalog by
catalog (columns, defaults, constraints, indexes, triggers, views, functions,
sequences, comments, RLS, policies, enums) with the local baseline. Live is
missing or behind:

- `backend/sql/033` daily capacity: functions `eventtz_parse_max_bookings_per_day`
  and `enforce_booking_daily_capacity`, trigger `trg_booking_requests_daily_capacity`,
  index `idx_booking_requests_vendor_active_dates`. Live has no database-level cap.
- `backend/sql/006` view `admin_vendor_list`. Nothing in `api/` or `backend/` reads it.
- `backend/sql/071`: `messages_body_len` still caps at 5000, not 15000; the
  `messages.body` comment is missing.
- `vendors` keeps the pre-`003` names `vendor_onboarding_pkey`, `_user_id_key`,
  `_current_step_check`, `_status_check`. `077` added `vendors_user_id_fkey`
  (`ON DELETE RESTRICT`) but dropped the old key by its new name, so the
  `ON DELETE CASCADE` key `vendor_onboarding_user_id_fkey` survives alongside it.
- Column comments in older wording (`users.share_address`,
  `booking_requests.paid_at`, `booking_requests.vendor_adjustments`,
  `conversations.kind`) or missing (`messages.metadata`): the `backend/sql/` files
  were edited after live ran them.

`0005` fixes all of these idempotently with `0002`'s definitions (a no-op on a
database built by `upgrade head`). Left alone, because Alembic does not compare
them and the API's `postgres` role owns every table (so RLS does not apply to it):

- RLS is on for every table (7 more than `backend/sql/` enables). Live's
  `rls_auto_enable` event trigger (Supabase's, on `CREATE TABLE` in `public`) also
  turns it on for the tables `0001` and `0003` create; nothing uses `FORCE`.
- `vendor_review_stats` has `security_invoker = on`.
- The function `public.rls_auto_enable`.

If `backend/sql/` gains a file before cut-over, diff live again: a live fix that
reached only one side will show up here.

## The over-capacity query

Read-only. Vendor-days where pending/accepted bookings already exceed the
vendor's `maxBookingsPerDay` (the trigger's rule; the parser is inlined because
live lacks `eventtz_parse_max_bookings_per_day`, and was checked against it on
every live vendor payload). It prints counts only:

```sql
WITH caps AS (
  SELECT users.id AS vendor_user_id,
         CASE
           WHEN vendors.payload IS NULL THEN 1
           WHEN cleaned.raw IS NULL OR cleaned.raw !~ '^([0-9]+\.?[0-9]*|\.[0-9]+)$' THEN 1
           WHEN cleaned.raw::numeric >= 2147483647.5 THEN 1
           ELSE GREATEST(1, LEAST(20, round(cleaned.raw::numeric)::int))
         END AS cap
  FROM public.users
  LEFT JOIN public.vendors ON vendors.user_id = users.id
  CROSS JOIN LATERAL (
    SELECT NULLIF(regexp_replace(COALESCE(vendors.payload ->> 'maxBookingsPerDay', '1'), '[^0-9.]', '', 'g'), '') AS raw
  ) AS cleaned
),
booked_days AS (
  SELECT booking.id AS booking_id, booking.vendor_user_id, booked_day::date AS day
  FROM public.booking_requests AS booking
  CROSS JOIN LATERAL generate_series(booking.event_date,
                                     COALESCE(booking.event_end_date, booking.event_date),
                                     interval '1 day') AS booked_day
  WHERE booking.status IN ('pending', 'accepted')
),
over_cap AS (
  SELECT booked_days.vendor_user_id, booked_days.day, count(*) AS bookings, caps.cap,
         array_agg(booked_days.booking_id) AS booking_ids
  FROM booked_days JOIN caps USING (vendor_user_id)
  GROUP BY booked_days.vendor_user_id, booked_days.day, caps.cap
  HAVING count(*) > caps.cap
)
SELECT count(*) AS vendor_days_over_cap,
       count(DISTINCT vendor_user_id) AS vendors,
       (SELECT count(DISTINCT booking_id) FROM over_cap, unnest(booking_ids) AS booking_id) AS bookings_involved
FROM over_cap;
```

To see which bookings, select from `over_cap` instead, in a private session.

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

### Rehearsal on a restored live backup (2026-10-16)

A read-only `pg_dump -Fc -n public -n auth` of live, restored with owners and
grants into a new database on the same local container (`supabase_db_workspace`
already has Supabase's roles), plus live's RLS event trigger recreated, since
schema dumps leave event triggers out:

```bash
docker exec supabase_db_workspace psql -U supabase_admin -d postgres \
  -c 'CREATE DATABASE eventtz_live_rehearsal OWNER postgres'
docker exec -i supabase_db_workspace pg_restore -U supabase_admin -d eventtz_live_rehearsal < live-public-auth.dump
# one expected error: schema "public" already exists
docker exec supabase_db_workspace psql -U postgres -d eventtz_live_rehearsal -c \
  "CREATE EVENT TRIGGER ensure_rls ON ddl_command_end WHEN TAG IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') EXECUTE FUNCTION public.rls_auto_enable()"
```

Then §2 and §3 exactly as written, as `postgres`. Findings:

- The over-capacity query found 0 vendor-days (live had 4 pending/accepted bookings).
- Without `0005`, `alembic check` failed on the leftover `vendor_onboarding_user_id_fkey`;
  with it, "No new upgrade operations detected."
- `adopt-auth` matched 169 users and copied 169 bcrypt hashes; no closed accounts and
  no open account without an `auth.users` row. A second run copied 0.
- The catalog of the adopted database matched a fresh `upgrade head` on the same
  server except the RLS flags, `security_invoker` and `rls_auto_enable` listed under
  "Live drift".
- `api/` on it, with Stripe/Resend/OpenAI/AWS/Sentry/Mixpanel blank: `/health` 200,
  `/api/v1/vendors/explore/search?limit=6` 200 with 6 vendors, admin
  `dashboard-summary` 401 without a token. The acceptance suite was not run: it
  writes rows, and this copy holds real customer data.
