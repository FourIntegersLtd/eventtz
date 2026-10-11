# Eventtz API

The rebuilt FastAPI backend (see `../docs/adr/`). It uses the same Supabase project and the same `/api/v1` paths as the baseline `../backend/`, which it will replace at cutover.

```bash
make install   # api/.venv (Python 3.13)
cp .env.example .env
make dev       # http://localhost:8001
make ci        # ruff + mypy + import-linter + guards + tests
```

Layout: `app/core/` (kernel), `app/adapters/` (real vendor clients), `app/features/<slice>/` (one product area each). How to add or rebuild a slice: [CONTRIBUTING.md](CONTRIBUTING.md).

## Deploys

Two Railway services build `api/Dockerfile` (planned, ADR 0002 / 0008). The Dockerfile owns build and
start (its `CMD` runs uvicorn on `$PORT`, one worker, 110 s graceful shutdown); the dashboard owns the
rest. No `railway.toml` (Config as Code stops being read on 2026-12-01), no `.railway/` IaC.

| Dashboard setting | `api` | `worker` |
|---|---|---|
| Builder / Root Directory | Dockerfile / `/api` | Dockerfile / `/api` |
| Custom start command | none (the Dockerfile `CMD` runs) | `python -m app.worker.main` |
| Pre-deploy command | `alembic upgrade head` (the only service that migrates) | none |
| Watch Paths | `/api/**` | `/api/**` |
| Healthcheck path / timeout | `/health` / 120 s | none (no HTTP) |
| Restart policy | on failure, 10 retries | on failure, 10 retries |
| Draining | 120 s | 120 s |
| Variables | names in `api/.env.example` (Railway sets `RAILWAY_ENVIRONMENT` itself) | same |

The deleted `railway.toml` held a 100 s healthcheck and 5 retries; both were raised to the standard
above. Build locally with `docker build -t eventtz-api .`. Changing a setting is a dashboard change and a
row edit here (and in `../docs/runbooks/railway.md`).
