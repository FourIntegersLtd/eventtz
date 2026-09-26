# Eventtz — AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor) working in this repo.
`CLAUDE.md` contains only `@AGENTS.md`, so every tool reads the same text.

## Project overview

UK events marketplace. Clients browse vendors (caterers, DJs, venues…), send
enquiries, pay through Stripe Checkout; vendors quote, accept and get paid out
via Stripe Connect after the event. Staff moderate vendors and resolve disputes.
Real vendors and clients use the live site.

Baseline stack (live): FastAPI + supabase-py + Supabase Auth, raw numbered SQL
migrations, Next.js + axios. Rebuild stack (`api/`, `web/`), copied from OSCE Guide
so both projects share one stack: FastAPI + SQLAlchemy 2.0 async on psycopg 3 +
Alembic, on Railway Postgres; platform-issued JWTs with argon2 passwords;
procrastinate jobs; structlog; optional Redis; Next.js with a fetch client and
generated types. Both: Stripe Connect, Resend, OpenAI, S3, Sentry, Mixpanel.

The code is being rebuilt to the architecture in `docs/adr/` (borrowed from OSCE
Guide `platform-api` / `platform-web`) in **new folders**: `api/` replaces
`backend/`, `web/` replaces `frontend/`, serving the same URLs. At cutover the
Supabase data (and bcrypt password hashes) move to Railway Postgres. `backend/` and `frontend/` are the **baseline** that runs the
live site: do not edit them (only critical live fixes, and only when asked). When
`api/`/`web/` reach parity they are deployed in place of the baseline, which is then deleted.

## Repo map

| Path | What it is |
|---|---|
| `api/app/core/` | Shared kernel: settings, db client, auth principals, errors, ports, time, money. **Never imports a feature.** |
| `api/app/adapters/` | Real Stripe / Resend / OpenAI / S3 / Mixpanel / address clients behind `core/ports.py` |
| `api/app/features/<slice>/` | One product area. Template in `api/CONTRIBUTING.md` |
| `api/tests/guards/` | AST architecture guards (each with a meta-test) |
| `api/tests/golden/` | Byte-exact fixtures of money maths captured from the baseline code |
| `api/alembic/` | Schema for `api/`. `0002` is a snapshot of `backend/sql/`; later changes are revisions |
| `backend/sql/NNN_*.sql` | Baseline migrations for the live Supabase DB, until cutover |
| `web/app/` | Routes only. URLs are public contracts |
| `web/{surfaces,domains,capabilities,foundation}/` | Frontend tiers, imports downwards only |
| `backend/`, `frontend/` | **Baseline** (live). Reference for behaviour; do not edit |
| `docs/adr/` | Architecture decisions. Read before changing structure |
| `docs/domain-rules.md` | Business invariants not yet moved into slice READMEs |
| `frontend/UI-CONVENTIONS.md` | Feedback, mobile, motion and Lottie rules |

## Commands

```bash
# api (from api/)
make db-up              # Postgres :5434 + Redis :6381 (docker compose)
make migrate            # alembic upgrade head
make new-migration M=x  # autogenerate, then review by hand
make dev                # uvicorn :8001 (baseline backend keeps :8000)
make worker             # procrastinate worker
make ci                 # lint + typecheck + arch (incl. alembic check) + tests
make openapi            # regenerate openapi.json (then web: npm run api:types)

# acceptance (from acceptance/): the freeze suite, same tests on both targets
make serve              # baseline on :8000 over local Supabase (leave running)
make test               # must stay green on the baseline
make serve TARGET=api   # api/ on :8001 over its compose Postgres (db-up + migrate first)
make test TARGET=api    # unbuilt behaviour is listed in conftest.NOT_YET_ON_API (strict xfail)

# web (from web/)
npm run dev             # :3001 (baseline frontend keeps :3000)
npm run ci              # types + lint + tests + build
```

Traps in this machine's shell:

- Node is not on PATH: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`.
- `poetry run pytest` can hit a stale shebang; use `poetry run python -m pytest -q`.
- Check pytest's **exit code**, not the tail of its output.
- Without Docker the `db` tests are skipped, not failed. Check they ran.

## Boundaries

### Always do

- Keep API paths and methods stable: `openapi.baseline.json` fails CI if one disappears.
- Put SQL (`select()`, `.execute()`, model imports) only in a slice's `repository*.py`. Only `core/db.py` and `core/jobs.py` commit.
- Raise `AppError` subclasses with a stable `code`; the frontend branches on `code`, never on message text.
- Keep money as integer pence inside `domain.py`; format only at the edge.
- New setting → `api/app/core/settings.py` + `api/.env.example`. Schema change → an Alembic revision (review autogenerate by hand).
- Name things for what they hold or do. No single-letter names, even in loops: `for booking in bookings`. Give every module, class and function a docstring, and comment any *why* that isn't obvious. New engineers onboard by reading the code (guarded in `api/tests/guards/`).
- Fix the lint and type errors you introduce.

### Ask first

- New Poetry / npm dependencies, new migrations against the hosted DB, deleting routes, anything that moves money in Stripe live mode, force-push.

### Never do

- Commit secrets or real customer data (`.env`, emails, UUIDs of real users).
- Filter public vendors by `approval_status` by hand — use the visibility helpers (see `docs/domain-rules.md`).
- Trust client-supplied prices. List prices come from `vendors.payload`.
- Call Stripe inside a shared read path, or create a Transfer/Refund without an idempotency key.
- `patch("app.…")` in tests — inject a fake from `tests/support/fakes.py`.
- Commit or push unless asked.

## Traps

- **Payments are two lifecycles.** `booking_requests.status` is the request; `payment_status` is money. Only the payments slice writes `payment_status`, with conditional `.eq("payment_status", expected)` writes.
- **Held funds.** Checkout pays Eventtz; vendor payout is always an explicit `Transfer`. That is what lets disputes block payouts.
- **SSE fans out over Redis** (ADR 0005). Without Redis the in-process bus only works on one replica.
- **The session commits before the response.** Ask for it as `core.db.SessionDep` only
  (`scope="function"`). FastAPI's default runs the commit after the body is sent, so a
  failed commit would follow a 200; a guard and `tests/unit/test_session_scope.py` hold this.
- **The worker has its own Railway config** (`api/railway.worker.toml`, no pre-deploy step),
  so only the `api` service runs `alembic upgrade head`.
- **Two schemas until cutover.** A live fix added to `backend/sql/` must also land as an Alembic revision in `api/`.
- **Imported passwords are bcrypt.** Sign-in rehashes them to argon2; delete the bcrypt path once none remain (ADR 0003).
- **Daily capacity** is enforced by a Postgres trigger (migration 033, kept in Alembic `0002`); the Python check is only for friendly errors.
- **Closed accounts are tombstones** (`users.deleted_at`); never restore one on upsert.
- **Local auth mode** logs reset URLs instead of emailing them.

## Engineering principles

When you apply one, say which decision it changed.

- **Laziness protocol.** Smallest change that solves the problem. No new layer or wrapper without a second real caller.
- **Subtract before you add.** Delete dead code first, then build on the simpler base.
- **Migrate callers, then delete.** A replacement lands with the deletion of what it replaces; no compatibility shims.
- **Fix root causes.** Reproduce, trace, fix there.
- **Test behaviour, not implementation.** Assert literal expected values. A test that passes with every import stubbed out is deleted.
- **Prove it works.** Done means the running app, stored row or rendered screen was checked, not just CI.

## Token discipline

- `Explore` agents for read-only sweeps, always with `model` set (`haiku`/`sonnet`); cap at 3–4 concurrent.
- Batch related greps/reads into one shell call; send long output to a file and read the tail.

## Cursor Cloud specific instructions

The Cloud Agent environment is self-contained via scripts in **`.cursor/`**:

- **`install.sh`** — `poetry install --extras dev` (backend) + `npm ci` (frontend).
- **`start.sh`** — starts Docker, brings up a **local Supabase stack** (`supabase start`, config in **`supabase/`**), applies **`backend/sql/*.sql`** on first boot (+ `supabase-grants.sql`), and writes **`backend/.env`**. If `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are provided as secrets, it uses that hosted project instead.
- **`run-backend.sh` / `run-frontend.sh`** — dev servers (FastAPI `:8000`, Next.js `:3000`).

Local Supabase Studio is at `http://127.0.0.1:54323`.

## Updating this file

Update it when a slice is rebuilt (repo map), when a trap is learned the hard
way, or when a command changes. Keep it short; detail belongs in slice READMEs
and ADRs.
