# Piece 16 — CI jobs for api/ and web/, mypy errors in the guard tests, stale "not rebuilt yet" comments

First read `.qwen/next20/rules-api.md` and follow it in full. There are no dependencies. Don't run it at the same time as another api piece; it touches several slices lightly.

## Part A — `.github/workflows/ci.yml`
### Facts
- Today it has the jobs `frontend` (the baseline), `backend` (the baseline) and `ci-gate`. It runs on `pull_request` and pushes to `main`.
- Actions are pinned by SHA. Reuse the **same SHAs** already in the file for checkout, setup-node, setup-python, install-poetry and cache.
- api `make ci` = `lint typecheck arch test`. `arch` runs `lint-imports` and `alembic check`, which **needs a migrated database**.
- api tests use `TEST_DATABASE_URL` when set (otherwise testcontainers), and `REDIS_DISABLED=1`.
- Python 3.13, Poetry. Web: Node 22, `npm ci`, then `npm run ci` (types, lint, test, build).
- Locally, compose runs Postgres 16 on :5434. In CI, use a service container on 5432.

### Build
- Job `api` (working-directory `api`):
  - `services.postgres: image postgres:16`, env `POSTGRES_USER/PASSWORD/DB = postgres/postgres/eventtz_test`, a health-check, port 5432.
  - env:
    - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eventtz_test`
    - `TEST_DATABASE_URL` the same
    - `REDIS_DISABLED=1`
    - `APP_ENV=test`
    - `SENTRY_DSN=""`
    - plus any settings `api/app/core/settings.py` requires in `test` (read `REQUIRED_WHEN_DEPLOYED`; test shouldn't need them).
  - Steps: checkout, setup-python 3.13, install-poetry, cache the venv, `poetry install --no-interaction` (use the extras or groups `api/Makefile` expects; read `api/pyproject.toml`), `poetry run alembic upgrade head`, then `make ci`.
  - timeout-minutes: 25.
- Job `web` (working-directory `web`): setup-node 22 with npm cache on `web/package-lock.json`, `npm ci`, `npm run ci`. timeout-minutes: 15.
- `ci-gate`: add `api` and `web` to its `needs`, and make sure its result check covers them. Read the existing gate step and follow its pattern.
- Don't remove the baseline jobs.

### Prove it
You can't run GitHub Actions locally. Validate the YAML with Python: `python -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"`, via `poetry run python` in api/. Then run the exact job commands locally, in the same order, against a fresh database:
- `createdb` isn't available, so use a fresh compose db: `make db-up` and `alembic upgrade head`;
- `make ci`, and check its exit code;
- `cd ../web && npm run ci`, and check its exit code.

## Part B — mypy errors in tests
- `api/tests/guards/test_routes_match_baseline.py:69` and `:77`: `rebuilt` needs a type annotation, `rebuilt: dict[str, Any] = {...}`.
- `api/tests/guards/test_error_contract.py:51`: `response_class.__name__` on `DefaultPlaceholder`. Narrow it with `isinstance(response_class, type)`, or cast; keep the guard's behaviour identical.
- Run `poetry run mypy tests/guards` and get 0 errors. If `make typecheck` only checks `app`, say whether you added `tests/guards` to it. Recommend adding it, but only if the whole `tests/` passes mypy or it's scoped to `tests/guards`.

## Part C — stale comments and table handles
For each one, check whether the owning slice is now rebuilt (it is: bookings, reviews and disputes all exist). Then either swap the table handle for a call to the owning slice's **service**, or, where a service call would cost a lot (e.g. inside an explore SQL join), keep the join and fix the comment to say why it stays.
- `api/app/features/bookings/repository.py:80`: "Reviews and disputes belong to slices not rebuilt yet…"
- `api/app/features/bookings/repository_admin.py:83`: "Disputes are a slice not rebuilt yet…"
- `api/app/features/marketplace/repository_explore.py:4-5`: bookings and reviews "not rebuilt yet". This is a hot read path, so keep the SQL join and rewrite the docstring to explain the handles are deliberate for speed.
- `api/app/features/messaging/repository_bookings.py:1-4`: move to `bookings` service calls if the two facts can be served by an existing or new small bookings service function; otherwise rewrite the comment.
- `api/app/features/content/repository.py:279-280`: "Reads `booking_requests` directly until the bookings slice is rebuilt". Replace it with a call to `bookings.service…` (e.g. a `get_booking_parties` service function) from content's **service**, not its repository, and delete the repository function.
- `api/app/features/vendors/domain_price_list.py:11`: check the comment and fix it.
- `api/app/features/identity/errors.py:57`: "kept on purpose until the web app is rebuilt". **Leave the behaviour** (the acceptance freeze asserts it) and only change the comment to "kept on purpose: the acceptance freeze pins this baseline quirk".

Every change keeps `make ci` and acceptance `TARGET=api` green. Run the full acceptance on api after Part C.

## Allowed paths
- `.github/workflows/ci.yml`
- `api/tests/guards/**` and `api/Makefile` (typecheck scope only)
- the files listed in Part C, plus any service function they need in `bookings/`

## Commits (three)
1. `ci: run api and web checks in GitHub Actions (ws18)`
2. `api: fix mypy errors in guard tests (ws18)`
3. `api: replace stale not-rebuilt-yet handles and comments (ws18)`
