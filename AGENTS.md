# Eventtz — AGENTS.md

Instructions for AI coding agents (Claude Code, Cursor) working in this repo.
`CLAUDE.md` contains only `@AGENTS.md`, so every tool reads the same text.

## Project overview

UK events marketplace. Clients browse vendors (caterers, DJs, venues…), send
enquiries, pay through Stripe Checkout; vendors quote, accept and get paid out
via Stripe Connect after the event. Staff moderate vendors and resolve disputes.
Real vendors and clients use the live site.

Stack (`api/`, `web/`), shared with OSCE Guide so both projects use one stack:
FastAPI + SQLAlchemy 2.0 async on psycopg 3 + Alembic, on Supabase Postgres used as
plain Postgres (session pooler); platform-issued JWTs with argon2 passwords;
procrastinate jobs; structlog; optional Redis; Next.js. Stripe Connect, Resend,
OpenAI, S3, Sentry, Mixpanel. Architecture decisions are in `docs/adr/`.

`api/` and `web/` went live on 2026-10-16, replacing the old `backend/` (FastAPI +
supabase-py) and `frontend/`, which were then deleted. Their behaviour is frozen in
`acceptance/` and `api/openapi.baseline.json` (`docs/runbooks/cutover.md`).

## Repo map

| Path | What it is |
|---|---|
| `api/app/core/` | Shared kernel: settings, db client, auth principals, errors, ports, time, money. **Never imports a feature.** |
| `api/app/adapters/` | Real Stripe / Resend / OpenAI / S3 / Mixpanel / address clients behind `core/ports.py` |
| `api/app/features/<slice>/` | One product area. Template in `api/CONTRIBUTING.md` |
| `api/tests/guards/` | AST architecture guards (each with a meta-test) |
| `api/tests/golden/` | Byte-exact fixtures of money maths captured from the old backend |
| `api/alembic/` | Schema for `api/`. `0002` is a snapshot of the old `backend/sql/`; later changes are revisions |
| `web/` | The old `frontend/` copied whole; its Next server proxies `/api/*` to `api/` (`BACKEND_URL`) and keeps the session in httpOnly cookies. URLs are public contracts |
| `docs/adr/` | Architecture decisions. Read before changing structure |
| `docs/domain-rules.md` | Business invariants not yet moved into slice READMEs |
| `web/UI-CONVENTIONS.md` | Feedback, mobile, motion and Lottie rules |
| `.claude/` | Owner agents, rule files, skills and the quality-gate hook (see Agents and routing) |

## Commands

```bash
# api (from api/)
make db-up              # Postgres :5434 + Redis :6381 (docker compose)
make migrate            # alembic upgrade head
make new-migration M=x  # autogenerate, then review by hand
make dev                # uvicorn :8001
make worker             # procrastinate worker
make ci                 # lint + typecheck + arch (incl. alembic check) + tests
make openapi            # regenerate openapi.json (then update web/lib/api-types.ts by hand)

# acceptance (from acceptance/): the freeze suite, black-box over HTTP
make serve              # api/ on :8001 over its compose Postgres (leave running)
make test

# web (from web/)
npm run dev             # :3001
npm test && npm run build  # web has no ci script; lint has 45 errors inherited from the old frontend/
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
- **Tiered client cancels.** `cancelled` + `partially_refunded` with `cancellation_refund_percent` set means the vendor's cancellation preset split the money (`bookings/domain_cancellation.py`); the vendor's share is a Transfer at cancel time, held (`cancellation_payout_at IS NULL`) until their Stripe setup is done.
- **Held funds.** Checkout pays Eventtz; vendor payout is always an explicit `Transfer`. That is what lets disputes block payouts.
- **SSE fans out over Redis** (ADR 0005). Without Redis the in-process bus only works on one replica.
- **The session commits before the response.** Ask for it as `core.db.SessionDep` only
  (`scope="function"`). FastAPI's default runs the commit after the body is sent, so a
  failed commit would follow a 200; a guard and `tests/unit/test_session_scope.py` hold this.
- **Only the `api` service migrates.** Its Railway pre-deploy command is `alembic upgrade head`; the
  `worker` service has none and its start command is `python -m app.worker.main`. Both are dashboard
  settings, not files: see `docs/runbooks/railway.md`.
- **Imported passwords are bcrypt.** Sign-in rehashes them to argon2; delete the bcrypt path once none remain (ADR 0003).
- **Daily capacity** is enforced by a Postgres trigger (migration 033, kept in Alembic `0002`); the Python check is only for friendly errors.
- **Closed accounts are tombstones** (`users.deleted_at`); never restore one on upsert.
- **Local auth mode** logs reset URLs instead of emailing them.
- **One notice per (booking, kind).** `booking_notifications` is unique on `(booking_id, kind)`
  across users, so a notice for both sides needs a `vendor_*` kind (added to migration 0007's
  check constraint and `domain_booking_copy.py`), or the second insert is silently dropped.
- **Terms numbers live twice.** `web/lib/policyConstants.json` (copy) and the api constants/settings
  (`bookings/domain_policy.py`); `tests/unit/test_policy_constants.py` keeps them equal. Booking
  terms are snapshotted at checkout (ADR 0010).
- **`web/lib/api-types.ts` is hand-written.** There is no `api:types` script; update it by hand
  after `make openapi`.
- **Docker hung?** DB tests skip silently. Run them against the compose Postgres directly:
  create a fresh database and set `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5434/<name>`.

## Agents and routing

Every source file under `api/`, `web/` and `acceptance/` has one owner agent
(`.claude/OWNERS.md`; `api/tests/guards/test_ownership.py` fails on a file with none or two).
Work goes to the owner of the paths it touches, through one of three routes:

| Intent | Route |
|---|---|
| New behaviour or a change to one | `/build-feature`, as the owner |
| Something broken | `/fix-bug`, as the owner |
| Review a diff, branch or range | `/review-change` (`reviewer` + `quality-reviewer`, + `/security-review` when high risk) |

| Owner | Area | Rule file / proof |
|---|---|---|
| `access-owner` | Identity, sessions and the proxy, staff team, roles, audit, staff email | `rules/access.md`, `verify-access` |
| `money-owner` | Payments, pricing, referrals, the money files of `bookings/`, receipts | `rules/money.md`, `verify-money` |
| `bookings-owner` | Booking lifecycle, quotes, date changes, capacity, disputes, reviews | `rules/bookings.md`, `verify-bookings` |
| `vendors-owner` | Onboarding, profiles, moderation, visibility, insurance, media, co-pilot | `rules/vendors.md`, `verify-vendors` |
| `marketplace-owner` | Explore, search, favourites, planner, client dashboard | `rules/marketplace.md`, `verify-marketplace` |
| `comms-owner` | Chat, support threads, notifications, email, realtime | `rules/comms.md`, `verify-comms` |
| `platform-owner` | Core, migrations, worker, guards, content, web shell and shared lib | `rules/platform.md`, `verify-platform` |

`.claude/hooks/quality-gate.sh` reminds every prompt of the routes, and on Stop blocks until the
owner (or its verify skill) and `quality-reviewer` ran on the session's code changes; access,
money, `api/alembic/` and CI also need `reviewer` (opus) and `/security-review`, and the user's
review. `QUALITY_GATE_OFF=1` turns it off. A new folder needs an OWNERS.md row; a lesson learned
goes in the owner's rule file or verify skill.

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

## Web

`web/` is the old `frontend/` copied whole (2026-10-16), not redrawn: change a screen only to fix it. It talks
to `api/` only through its Next proxy (`BACKEND_URL`); the browser never sees a token.

## Updating this file

Update it when a slice is rebuilt (repo map), when a trap is learned the hard
way, or when a command changes. Keep it short; detail belongs in slice READMEs
and ADRs.
