# Rules for every api/ piece (read once per piece; they apply in full)

## Where you are
Repo /Users/yahayakenny/Documents/Projects/eventtz, branch `rebuild/osce-architecture`. Work directly
on it: never create, switch or check out a branch, never make a worktree, never push, never deploy.
If `git status` shows uncommitted changes under api/, web/ or acceptance/ when you start, stop and
say so in one line. Untracked .claude/, .qwen/, .vscode/, .clineignore, supabase/.branches and
supabase/.temp are expected: never stage them.

Eventtz is a UK events marketplace being rebuilt. api/ (FastAPI + SQLAlchemy 2.0 async + Alembic +
procrastinate, on Postgres) replaces backend/ (FastAPI + supabase-py, the live site). web/ replaces
frontend/. backend/ and frontend/ are the behaviour reference: read them, NEVER edit them.

Read first: AGENTS.md, api/CONTRIBUTING.md, docs/domain-rules.md, and the README of every slice you
touch. The piece prompt names the baseline files.

## Safety (non-negotiable)
- Never touch the hosted Supabase DB. Never run `.cursor/start.sh`.
- Never read backend/.env, frontend/.env.local or acceptance/.env.local. Never commit secrets.
- Test data only with @example.com emails. Never commit real emails or real user UUIDs.
- Never make a live-mode Stripe call. Stripe goes through the PaymentGateway port; tests use
  FakePaymentGateway.
- Ask the user first (stop and ask; don't work around it) for: new Poetry or npm dependencies,
  deleting a route, a migration against any non-local DB, force-push.

## Method: freeze first
1. If the behaviour you port has no acceptance test, write it in acceptance/test_<area>.py and get it
   green against the BASELINE first:
   - `cd acceptance && make serve` (baseline on :8000 over local Supabase; leave it running)
   - `make test ARGS=test_<area>.py`
   Then add the new tests to `NOT_YET_ON_API` in acceptance/conftest.py (strict xfail) and commit
   the freeze on its own.
2. Build in api/ until `TARGET=api` passes, then delete those `NOT_YET_ON_API` lines (strict: a
   passing xfail fails the run).
   - `cd api && make db-up && make migrate`, then `cd acceptance && make serve TARGET=api` (:8001)
   - `make test TARGET=api ARGS=test_<area>.py`
   If :8000 or :8001 is already serving, reuse it; restart :8001 after changing api code.

## Slice shape (enforced by api/tests/guards/)
- Files: README.md (Purpose, Use cases, Invariants, Routes), domain*.py (pure, no I/O), models.py,
  repository*.py (the ONLY place for select()/execute()/model imports; may flush, never commit),
  service*.py (never commit or flush), schemas*.py, errors.py, router*.py (thin), optional jobs.py.
- A slice imports only another slice's service*, schemas, errors or jobs. core never imports a
  feature. To read another slice's table use a sqlalchemy table()/column() handle in your own
  repository (see bookings/repository.py).
- Sessions: `from app.core.db import SessionDep`. Only core/db.py and core/jobs.py commit.
- Errors: raise AppError subclasses (InvalidInput 400, Unauthenticated 401, Forbidden 403,
  NotFound 404, Conflict 409, Unavailable 503) with a stable `code` and the baseline's exact
  message text. Never HTTPException.
- Routes: response_model (unless 204/streaming/plain) and responses=error_responses(...). Paths and
  methods must match api/openapi.baseline.json.
- Auth principals from app.core.auth (CurrentClient, CurrentVendor, CurrentStaff, CurrentSuperAdmin…).
- Outside services only through app.core.ports; tests inject fakes from api/tests/support/fakes.py.
  `patch("app.…")` is banned.
- Payments: only the payments code writes payment_status, with a conditional write on the expected
  old value. Every Stripe Transfer/Refund has an idempotency key.
- Schema change → a new Alembic revision in api/alembic/versions/ (next free number after the
  current head; review autogenerate by hand). The current head is 0003.

## Style
Descriptive names (no single letters, even in comprehensions). A docstring on every module, class
and function; comment any non-obvious "why". %-style logging via `log = get_logger(__name__)`.
Money as integer pence in domain code. ruff line length 110, mypy strict. Test behaviour with
literal expected values.

## Generated files
If you add or change a route: `cd api && make openapi`, then
`cd web && npm run api:types`, and commit api/openapi.json and
web/src/foundation/platform-client/schema.d.ts with your piece.
Node: `export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"`.
Traps: use `poetry run python -m pytest -q` (not `poetry run pytest`); check exit codes, not log
tails; without Docker the db tests are SKIPPED, so confirm they ran.

## Working method (credits are limited)
- Read the files the prompt names in one pass. Don't re-read a file you already read or just wrote.
- Write each new file complete once. Run the fast checks while building
  (`poetry run python -m pytest -q tests/unit tests/http -k <area>`); run `make ci` once at the end.
- If what you find doesn't match the prompt (a file moved, a name differs), take the obvious step
  toward the stated goal and mention it in one line of the report.

## Done means
1. `cd api && make ci` exits 0 with the db tests actually run.
2. The piece's acceptance tests pass on TARGET=api, and still pass on the baseline.
3. The running :8001 server was exercised for your routes (curl or the acceptance run).
4. Slice README updated (Use cases / Routes / Invariants).
5. `git status` shows changes only under the paths the piece allows. Stage explicit paths; check
   `git diff --cached` for secrets, real emails and UUIDs.
6. Commit with the piece's message, ending with the trailer
   `Co-Authored-By: Cursor Agent <noreply@cursor.com>`.
7. Report in 12 lines or fewer: commit hash(es), what you built, exact test counts
   (`make ci` passed count, acceptance passed/xfailed), anything from the baseline left out and why.
