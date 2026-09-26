# 0008 — Background jobs on procrastinate

Status: accepted (2026-09-26).
Source: OSCE Guide `platform-api` ADR 0006.

## Context
The baseline runs booking maintenance (reminders, payout release, nudges, stale
enquiries) in an hourly asyncio loop inside the web process, deduplicated by a
`job_runs` row per hour. Work is lost when a deploy lands mid-run.

## Decision
- procrastinate, with its tables in the application database (Alembic `0001`).
- Each slice declares tasks in `jobs.py` inside `register()`; periodic work uses
  `@app.periodic(cron=...)`.
- Services enqueue with `defer_in_transaction`, inside the transaction that
  changes the data the job acts on.
- One `worker` Railway service (`python -m app.worker.main`) runs every task, from
  the same image as the API.
- Tasks are idempotent and keyed by the entity they process.

## Consequences
- No lost jobs across deploys; the queue is inspectable with SQL.
- The API and the queue share one driver (psycopg 3) and one database.
