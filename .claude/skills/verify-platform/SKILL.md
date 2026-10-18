---
name: verify-platform
description: How to prove a change to the platform works (api core kernel, Alembic migrations, worker, admin_insights, content, guards, test support, acceptance harness, shared web components/lib/layouts/marketing). Use before calling any platform change done. Lists the proof each kind of change needs and the traps that make a green run meaningless.
---

# Verify platform

Pick the **lowest level that can see your change**, run it, and report the command and its output.

| Your change | Minimum proof |
|---|---|
| `core/`, guards, test support, admin_insights, content | Level 1 (`make ci`) |
| A migration | Level 1 + Level 2 on a fresh DB; plus `reviewer` (opus) and `/security-review` |
| A setting | Level 1; confirm it is in `settings.py` and `api/.env.example` |
| Route added/changed | Level 1; `make openapi`, then hand-edit `web/lib/api-types.ts` |
| Shared web component, `web/lib`, layout, marketing page | Level 1 web + Level 3 on a screen that imports it |
| Worker / jobs | Level 1 + Level 3 with `make worker` running |

## Level 1: CI (do not run it while another agent is running tests)

```bash
cd api && make db-up && make migrate
make ci            # lint + typecheck + arch (lint-imports + alembic check) + tests
make guards        # the architecture guards alone, fast
cd ../web && export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
npm test && npm run build
```

Platform's own test files: `tests/guards`, `tests/unit/test_{admin_insights_domain,content_domain,errors,health,openai_language_model,session_scope}.py`,
`tests/repository/test_unique_writes.py`, `tests/golden/test_content_goldens.py`. Web `lib/` and
`components/` tests run inside `npm test`. Not run on 2026-10-18 (documented only). GitHub Actions CI is broken:
this local run is the only gate before pushing `main`. Web lint has 45 inherited errors: add none.

## Level 2: migrations and acceptance

```bash
cd api && make db-up
# fresh database so old state cannot hide a bad revision
docker compose exec -T postgres psql -U postgres -c "create database mig_check"
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5434/mig_check make migrate
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5434/mig_check poetry run alembic check
make migrate-down && make migrate    # the new revision must reverse and reapply
cd ../acceptance && make serve       # leave running
make test ARGS="test_admin_dashboards.py test_content_blog.py test_content_contact.py test_content_help.py"
```

Use the exact env var name `api/app/core/settings.py` reads for the database URL. `alembic check`
must report no drift. Never run a new migration against the hosted DB without asking first.

## Level 3: the running app

`make dev` (:8001), `make worker`, `npm run dev` (:3001). Check the changed screen at phone width
(no horizontal scroll), the admin shell loads, a toast shows on a mutation, and a job enqueued from
the api is picked up by the worker log. Outside services are off locally.

## Traps

- DB tests **skip silently** without Docker: read the "skipped" count (must be 0), also in `make ci`.
- Check pytest's **exit code**, not the tail. Use `poetry run python -m pytest`, not `pytest`.
- Docker hung: fresh database and `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/<name>`.
- Autogenerate misses constraints, triggers and index changes: read the revision by hand. Daily capacity is a Postgres trigger (migration 033, in `0002`).
- Only the `api` service migrates; the worker has no pre-deploy command (`docs/runbooks/railway.md`).
- Never weaken a guard or delete its meta-test to get green; `test_ownership` fails on any file matching no row or two rows.
- `openapi.baseline.json` fails CI if a path disappears. `web/lib/api-types.ts` is hand-written.
