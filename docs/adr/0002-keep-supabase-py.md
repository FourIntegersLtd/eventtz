# 0002 — Keep supabase-py and raw SQL; atomic writes via `.rpc()`

Status: accepted (2026-09-25)

## Context
OSCE Guide uses SQLAlchemy + Alembic. Eventtz has ~25 tables, live data, and no
full-time maintainer.

## Decision
Keep the service-role supabase-py client and numbered raw SQL in `backend/sql/`.
Writes that must be atomic (booking + payment state, webhook ledger + effect) are
Postgres functions added as the next migration and called with `.rpc()` from a
repository. Migrations are applied in numeric order; numbers are unique.

## Consequences
No ORM to maintain. Transactions exist only where a function is written for them,
so any multi-row money write must go through one.
