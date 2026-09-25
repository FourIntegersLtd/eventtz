# Contributing: how to rebuild a slice, tests first

This is the whole method. It is the one OSCE Guide used: freeze what exists, then build to the freeze. Follow the steps in order, because each one produces something the next needs.

## The rule

**No behaviour change without a test in the same commit.** A slice's freeze tests are committed, and passing against the baseline `backend/`, **before** any code for that slice lands in `api/`. The baseline is never edited to make a test pass.

## Names and comments

Code is written to be read by the next engineer to join, so:

- **Every name says what it holds or does.** That means no single-letter names: not `i`, `x`, `p` or `f`, and not in loops or comprehensions either (`for booking in bookings`, not `for b in bookings`). The only exception is `_`, for a value you ignore.
- **Every module, class and function has a docstring**, private helpers and nested route handlers included. The docstring says what the code is for and anything that isn't obvious. Test functions are the one exception, because their names already read as sentences. Test helpers and fixtures still need docstrings.
- **Add an inline comment wherever the *why* isn't obvious**: a baseline quirk kept for parity, a workaround, or a number with a reason behind it.

`test_names_are_descriptive` and `test_code_is_documented` enforce this across `app/` and `tests/`.

## 0. Freeze the baseline (`../acceptance/`)

Turn every route the slice owns into black-box HTTP tests in `acceptance/test_<slice>.py`. Each test covers:

- the success shape
- each error status and `detail`
- the auth matrix: anonymous, client, vendor, admin and super admin

Run them against the baseline (`cd acceptance && make test`, which targets `:8000`). They must pass there first. Then commit them.

- Assert literal values that a user would notice.
- Don't assert values that are allowed to change, such as timestamps, ids and ordering the product does not promise.
- Where the baseline has a bug, freeze the bug and add `# BASELINE BUG:` with a note. Fix it later in a separate commit that changes the test.

Where output must not change byte for byte (pricing breakdowns, service fees, referral discounts, receipts, ranking order), use goldens:

- Capture the output from baseline functions with a script in `acceptance/capture/`. It runs inside `backend/` and only reads it.
- Write the result to `tests/golden/<slice>/*.json`.

## 1. Write the use cases

Before any code, list what people do in this form, at the top of the slice README:

> As a **vendor**, I **accept a booking request** so that the client can pay.

## 2. Guard tests (`tests/guards/`)

The platform guards already cover:

- `core` never imports features
- Supabase calls appear only in `repository*.py`
- routers import only their own `schemas`, `service` and `errors`
- a slice reaches another slice only through its `service*`, `schemas` or `errors`
- `domain.py` does no I/O
- no `HTTPException` in features
- every route declares a response model and its errors
- schemas never import rows
- no `patch("app.…")` in tests
- README headings
- migration numbering
- descriptive names (no single-letter identifiers)
- docstrings on every module, class and function

Add a slice-specific guard only when the slice has a rule of its own. Every guard has a meta-test that plants a violation.

## 3. Domain (`tests/unit/` then `domain.py`)

Write unit tests for the invariants, then write `domain.py` as plain Python: enums, dataclasses, state machines and pricing maths in integer pence. It has no Supabase, FastAPI or I/O.

## 4. Repository (`models.py`, `repository.py`)

`models.py` holds Pydantic row models, so rows are typed rather than `dict[str, Any]`. `repository.py` is the only file that calls `.table()`, `.rpc()` or `.storage`, and it returns row models.

- An atomic multi-row write becomes a Postgres function called with `.rpc()`.
- That function goes in the next `../backend/sql/NNN_<name>.sql`, which is the single migration folder until cutover.

## 5. Service and router, to green

- `schemas.py`: request and response models. Response models are mandatory, and they never re-export rows.
- `service.py`: the use cases. Each takes a `Principal` and any ports, and raises `AppError` subclasses from `errors.py`.
- `router.py`: parses the request, calls one service function, returns the schema, and declares its errors with `error_responses(...)`.

Use exactly the baseline's paths, methods, status codes and `detail` text.

Green means `make ci` passes **and** `cd ../acceptance && TARGET=api make test` passes for the slice.

## 6. Mount and document

- Add the router to `_routers()` in `app/main.py`, the only place `include_router` is called.
- Fill in the slice `README.md`: Purpose, Use cases, Invariants, Routes (CI checks for these headings).
- Run `make openapi` and commit `openapi.json`.

## Cross-slice rules

- Slice A may call slice B's **service**, never its repository, domain or models. If B's service has no function for what you need, that missing function is the point.
- `app/core` never imports `app/features` or `app/adapters`.
- A new external dependency needs a Protocol in `app/core/ports.py` and a fake in `tests/support/fakes.py`, in the same commit. Never `patch("app.…")`: override the dependency with `app.dependency_overrides` instead.

## Tests

| Folder | What | Needs DB |
|---|---|---|
| `tests/guards` | Architecture rules: AST scans over `app/` | no |
| `tests/unit` | `domain.py`, pure helpers, kernel | no |
| `tests/golden` | Byte-exact outputs captured from the baseline | no |
| `tests/http` | Routes via `TestClient` with fakes injected | no |
| `../acceptance` | Black-box freeze suite, run against baseline and api | local Supabase |

## Things that will bite you

- `poetry run pytest -q | tail -2` shows only the last lines, **not** the exit code, so a failing suite can look green. Use `make test`, or check `$?`.
- A globally set `VIRTUAL_ENV` makes poetry use the wrong interpreter. The Makefile runs `env -u VIRTUAL_ENV`.
- Never run `.cursor/start.sh` on this machine: it overwrites `backend/.env`.
- A green suite is not evidence that a feature works. Ask what would fail if the feature were deleted, then check the running app.
