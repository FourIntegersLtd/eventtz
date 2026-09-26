# Uptime checks (draft)

Apply these by hand in whichever uptime tool the team already uses (UptimeRobot
is referenced elsewhere in this repo — `api/app/main.py`'s `/health` docstring
says "Liveness for Railway and UptimeRobot (which sends HEAD)" — so these
checks assume it, but any HTTP uptime tool works the same way).

## `api`

- **URL:** `GET https://<api-host>/health`
- **Method:** GET (or HEAD; the route explicitly supports both, see
  `api/app/main.py`).
- **Expected:** HTTP 200, `{"status": "ok"}`.
- **Interval:** 1 minute.
- **Alert after:** 2 consecutive failures (avoids paging on a single dropped
  packet).
- **Note:** this only proves the process is up and can respond — it does not
  touch the database. Railway's own `railway.toml` `healthcheckPath =
  "/health"` already uses this route to gate a deploy; this uptime check is
  the same probe watched continuously *after* a deploy, not just during one.

## `web`

- **URL:** `GET https://<web-host>/` (the marketing homepage, once `web/`
  is deployed) or a dedicated `/api/health` route if `web/` adds one —
  confirm with whichever workstream owns `web/`'s routes.
- **Expected:** HTTP 200.
- **Interval:** 1 minute.
- **Alert after:** 2 consecutive failures.

## `worker` — proposed heartbeat (not built; flagged per §11)

The worker has no HTTP surface at all (`api/app/worker/main.py` just runs
`jobs_app.run_worker(...)` — see `api/railway.worker.toml`: `startCommand =
"python -m app.worker.main"`, no server). An uptime tool can only poll HTTP,
so there is nothing today it can check for "is the worker actually draining
jobs" versus "the worker process is technically running but stuck."

**This was not built in this workstream — it needs a new route, and §11 of
`docs/rebuild-workstreams.md` says to flag that rather than add it.**
Proposed design, for whoever picks it up:

1. **A periodic procrastinate task**, registered on the shared
   `jobs_app` from `api/app/core/jobs.py` (the same app both `api` and
   `worker` import), using procrastinate's built-in periodic-task
   scheduling (`@app.periodic(cron="*/5 * * * *")` stacked with
   `@app.task(...)`, per procrastinate's own docs — this repo has no
   periodic task yet to pattern-match against). The task body does one
   thing: write the current UTC timestamp to a new table, e.g.
   `worker_heartbeats(id, updated_at)` with a single row upserted each run
   (mirrors the "small, boring, obviously-correct" shape of the rest of
   `core/jobs.py`).
2. **A new route**, most naturally on `api` (the worker has no HTTP server
   to add it to) — something like `GET /health/worker` — that reads that one
   row and returns 200 if `updated_at` is newer than, say, 3x the periodic
   task's interval, and a 5xx otherwise. This is the "new route" §11 flags:
   it needs a slice decision (which slice owns a cross-cutting heartbeat
   table — `core`? a new thin `ops`/`health` slice?), a migration, and a
   README, so it is a small but real piece of work, not a one-line add.
3. **The uptime check** then polls `GET /health/worker` on the same
   interval/threshold as the `api` check above.

Why a timestamp-in-Postgres design rather than, e.g., a Redis key: it needs
no extra infrastructure beyond what `worker` already writes to (Postgres,
via the same connection `procrastinate.PsycopgConnector` already holds), and
it directly proves the thing that matters — that a scheduled job actually
ran recently — rather than proving only that the process is alive (which
Sentry's own "no events received" alert already covers more cheaply; see
`sentry-alerts.md` rule 4).

## Applying these

Uptime checks and their alert routing are created in the uptime tool's own
dashboard; this repo has no config-as-code for that tool, so this stays a
manual runbook rather than a file to commit.
