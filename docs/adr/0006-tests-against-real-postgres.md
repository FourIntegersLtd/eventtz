# 0006 — Tests run against a real Postgres

Status: accepted (2026-09-26). Supersedes "tests against local Supabase".
Source: OSCE Guide `platform-api` ADR 0007.

## Decision
- `api/tests/unit`: pure `domain*.py` code, no database.
- `api/tests/golden`: behaviour captured from the baseline, byte-exact.
- `api/tests/guards`: architecture AST scans, each with a meta-test.
- Repository and HTTP tests (`db` marker) run against Postgres from testcontainers,
  or `TEST_DATABASE_URL` in CI. Alembic upgrades to head once per session; each
  test runs in a transaction that is rolled back.
- External services are reached only through `core/ports.py`; tests inject fakes
  from `api/tests/support/fakes.py`, never `patch("app.…")`.
- `acceptance/` is the black-box freeze suite: green on the baseline first, then on
  `TARGET=api`.

## Consequences
- Tests prove the SQL, constraints, triggers and migrations, not a stand-in.
- Local runs need Docker. Without it `db` tests are skipped, so check they ran.
