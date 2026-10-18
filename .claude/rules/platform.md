---
paths:
  - "api/app/{main,openapi}.py"
  - "api/app/core/**"
  - "api/app/worker/**"
  - "api/app/features/{admin_insights,content}/**"
  - "api/alembic/**"
  - "api/tests/{guards,support}/**"
  - "api/tests/conftest.py"
  - "acceptance/{conftest.py,support/**,scripts/**}"
  - "web/components/**"
  - "web/lib/**"
  - "web/app/{layout,not-found,global-error}.tsx"
  - "web/app/(marketing)/**"
  - "web/features/{landing,blog,help,contact,errors,internal,dashboard}/**"
  - "web/features/admin/{blog,components,dashboard,layout,report-bug,settings}/**"
---
# Platform: what to know

Owner: `platform-owner`. Proof: `verify-platform`. Review: `quality-reviewer` always, plus `reviewer` (opus) and `/security-review` for `api/alembic/**` and CI workflows.

- **`core/` never imports a feature** (`test_core_is_feature_free`, import-linter in `make arch`). Domain modules do no I/O (`test_domain_is_io_free`).
- **SQL only in a slice's `repository*.py`** (`test_sql_lives_in_repositories`); routers stay thin and call services only (`test_routers_are_thin`, `test_slices_call_services_only`).
- **Only `core/db.py` and `core/jobs.py` commit** (`test_services_never_commit`). Ask for the session as `core.db.SessionDep` only, `scope="function"`, so the commit happens before the response (`test_one_session_dependency`, `tests/unit/test_session_scope.py`).
- **Raise `AppError` subclasses with a stable `code`**; the frontend branches on `code`, never message text (ADR 0004, `test_error_contract`).
- **Schema change = an Alembic revision, reviewed by hand** after `make new-migration`. Only the `api` service migrates (pre-deploy `alembic upgrade head`); the `worker` never does (`docs/runbooks/railway.md`). `0002` is the old `backend/sql/` snapshot. New migrations against the hosted DB: ask first.
- **New setting = `api/app/core/settings.py` + `api/.env.example`.** Never commit secrets or real customer data.
- **`api/openapi.baseline.json` keeps every path and method** (`test_routes_match_baseline`). After API changes run `make openapi`, then hand-edit `web/lib/api-types.ts` (no generator script).
- **Schemas are not rows** (`test_schemas_are_not_rows`); tests use fakes, never `patch("app.…")` (`test_tests_use_fakes`).
- **Every module, class and function has a docstring; no single-letter names** (`test_code_is_documented`, `test_names_are_descriptive`). No em dashes in user copy (`test_copy_has_no_em_dash`).
- **Ownership**: every source file matches exactly one row of `.claude/OWNERS.md` (`test_ownership`); a new folder needs a row.
- **admin_insights owns no table**: reads cross into other slices through local `table()`/`column()` handles. Its quirks are frozen (`days` outside `{7,30,60,90}` falls back to 30, bad dates are `400 invalid_date_filter`, unknown vendor insights are all zero).
- **content**: blog HTML sanitised to an allow-list before storage; a contact message is stored first and every follow-up (classifier, webhook, alert email) may fail without failing it.
- **Web talks to `api/` only through the Next proxy** (`BACKEND_URL`); the browser never sees a token. `web/` is the old `frontend/` copied whole: change a screen only to fix it. `web/lib/policyConstants.json` must equal the api constants (`test_policy_constants`).
- **Web checks**: `npm test && npm run build`; lint has 45 inherited errors, so introduce none new. Follow `web/UI-CONVENTIONS.md` (toasts on mutations, `TOUCH_TARGET`, `min-h-dvh`).

## What a failure looks like here
- A migration that autogenerate produced unreviewed (dropped constraint, missed index or trigger), or applied by the worker service.
- A feature import inside `core/`, or SQL/commit outside the allowed files, hidden behind a guard exemption.
- A route removed or renamed so `openapi.baseline.json` no longer matches, or `api-types.ts` left stale after `make openapi`.
- A setting read from the environment directly, or added without `.env.example`.
- A shared web component or `lib/` change that breaks a screen owned by another area (check every importer).
- A new `ruff`/`mypy`/eslint error, or a guard weakened or its meta-test removed to get green.
