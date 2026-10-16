# Railway: how every service is configured

> **2026-10-16:** `api` and `worker` serve production; the `backend` service below no longer
> gets traffic and its source folder is deleted. Delete the service once nothing needs a rollback.

One standard, shared with ClinicalBuddy and OSCE Guide's `platform-api`. Each service's README has its
dashboard table (`backend/README.md`, `api/README.md`); this page keeps them side by side.

- **The repo owns how the app runs.** The `Dockerfile` builds the image and its `CMD` starts the app
  on `$PORT`. No Procfile, no `nixpacks.toml`, no `runtime.txt`: one start command, one place.
- **Railway owns where it runs.** Health check, restart policy, draining, watch paths, replicas and the
  pre-deploy command are set once in the dashboard (service → Settings). Variables are set in
  Variables; names are listed in each service's `.env.example`, values never in git.
- **No `railway.toml` / `railway.json`.** Config as Code stops being read on 2026-12-01. We do not
  use the replacement (`.railway/railway.ts` Infrastructure as Code) either: it must list every
  variable or deletes it on apply, and it has no field for watch paths or restart policy anyway.
- **Pre-deploy owns migrations.** Only one service per database runs `alembic upgrade head`, as its
  pre-deploy command. A worker that shares the image never migrates.
- **Client IP.** No `--proxy-headers` / `FORWARDED_ALLOW_IPS`: Railway publishes no proxy ranges. Each
  app's `client_ip` reads the edge's `X-Real-IP` only when `RAILWAY_ENVIRONMENT` is set.

## Services

| Service | Root dir | Start (Dockerfile `CMD` unless overridden) | Dashboard settings |
|---|---|---|---|
| `backend` (live, project `eventtz`) | `/backend` | Dockerfile `CMD` | Healthcheck `/health`, 120 s · Restart on failure, 10 retries · Draining 120 s · Watch paths `/backend/**` |
| `api` (planned, ADR 0002; DB = Supabase session pooler, see "Database") | `/api` | Dockerfile `CMD` | Pre-deploy `alembic upgrade head` (point it at the live DB only on cut-over day) · Healthcheck `/health`, 120 s · Restart on failure, 10 retries · Draining 120 s · Watch paths `/api/**` |
| `worker` (planned, ADR 0008) | `/api` | override: `python -m app.worker.main` | No pre-deploy, no healthcheck (no HTTP) · Restart on failure, 10 retries · Draining 120 s · Watch paths `/api/**` |

The `backend` values above are what `backend/railway.toml` held until 2026-10-11, moved to the
dashboard when the file was removed. Changing one of them is a dashboard change and a row edit here.

## Database

There is no Railway Postgres: `api` and `worker` use the Supabase project's Postgres (ADR 0002)
through its **session pooler**. Both services set `DATABASE_URL` (Supabase dashboard → Connect →
Session pooler; placeholders only here, the password URL-encoded):

```
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
```

- Not the direct `db.<project-ref>.supabase.co` host: it is IPv6-only and Railway has no outbound IPv6.
- Not the transaction pooler (port 6543): procrastinate needs a real session (LISTEN/NOTIFY, advisory
  locks) and psycopg prepares statements.
- `sslmode=require`: the pooler only takes TLS; the parameter reaches both SQLAlchemy and
  procrastinate's libpq connection unchanged.

**Connection budget.** In session mode every client holds a server connection, and the pooler caps
clients at the plan's pool size (Supabase → Database → Settings → Connection pooling). Each process
opens up to `DATABASE_POOL_SIZE + DATABASE_MAX_OVERFLOW`; the worker adds procrastinate's 4. Keep

```
api replicas × (POOL_SIZE + MAX_OVERFLOW) + worker × (POOL_SIZE + MAX_OVERFLOW + 4) + 2 (migrations, admin)
```

under that pool size, with the baseline's own usage counted until it is switched off. For example,
one `api` at 5 + 5 and one `worker` at 2 + 2 is 10 + 8 + 2 = 20.

Railway's only EU region is Amsterdam (`europe-west4`); Supabase has no Amsterdam region, so expect
~6–10 ms per round trip to a London project. The live `backend` makes the same trip to PostgREST.

## Checks after changing a service

1. Settings → Build shows "Dockerfile" as the builder and the Watch Paths field is editable (it is
   locked while a `railway.toml` exists in the deployed commit).
2. The deploy goes green and `GET /health` on the service domain answers 200.
3. For `api`: the deploy log shows the pre-deploy step ran `alembic upgrade head`.
