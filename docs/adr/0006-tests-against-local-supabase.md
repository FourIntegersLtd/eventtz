# 0006 — Test layers and local Supabase

Status: accepted (2026-09-25)

## Decision
- `api/tests/unit` — pure `domain.py` and services with fakes; no network, no DB.
- `api/tests/guards` — architecture AST scans.
- `api/tests/golden` — money maths fixtures captured from pre-rebuild code; byte-exact.
- `api/tests/http` — FastAPI TestClient with ports faked.
- Repository/migration tests run in CI against `supabase start` with every
  `backend/sql` file applied, proving migrations apply cleanly to an empty DB.
External services are reached only through `core/ports.py`; tests inject fakes from
`api/tests/support/fakes.py` instead of `patch("app.…")`.
