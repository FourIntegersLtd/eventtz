"""Adopt the existing Supabase database: one comment, and the Data API roles shut out

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-16

Production stays on the Supabase Postgres the baseline already uses (ADR 0002).
That database was built by `backend/sql/`, not by `0002`, so cut-over adopts it:
`alembic upgrade 0001` (procrastinate's queue, which Supabase does not have),
`alembic stamp 0002` (the baseline schema, already there), `alembic upgrade
head` (`docs/runbooks/cutover.md`). A rehearsal on a copy of local Supabase
found the adopted `public` schema identical to a fresh `upgrade head` except
for the two things this revision settles:

- `users`' table comment. `backend/sql/001` still says it is linked to
  `auth.users`; the `0002` snapshot rewrote it, so `alembic check` fails on an
  adopted database. On a fresh database this is a no-op.
- Supabase's Data API. Supabase's default privileges grant `anon` and
  `authenticated` full access to every table and function the `postgres` role
  creates in `public`, and the anon key is public by design. So
  `refresh_tokens`, `refresh_chains`, `alembic_version` and procrastinate's
  tables and functions (none of them with row-level security) would be
  readable and writable through PostgREST by anyone. After cut-over the API is
  the only client and connects as `postgres`, so both roles lose `public`
  entirely, including the schema's `PUBLIC` usage (which is how `anon` would
  still reach functions, executable by `PUBLIC` by default). `service_role`
  keeps its grants so a rollback to the baseline, which uses that key, still
  works. Plain Postgres has neither role, so this part is skipped there.

Row-level security that `backend/sql/` enabled on 18 tables is left on: the
`postgres` role owns those tables and so bypasses it, and Alembic does not
compare it.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

USERS_COMMENT = "One account; user_type drives client vs vendor vs admin UI."

# Only on Supabase: both Data API roles exist there and nowhere else.
_IF_SUPABASE = (
    "DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') "
    "AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN {statements} END IF; END $$"
)
_OBJECT_KINDS = ("TABLES", "SEQUENCES", "FUNCTIONS")

_SHUT_DATA_API = " ".join(
    [
        *(f"REVOKE ALL ON ALL {kind} IN SCHEMA public FROM anon, authenticated;" for kind in _OBJECT_KINDS),
        # Objects later revisions create, as the `postgres` role that runs them.
        *(
            f"ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON {kind} "
            "FROM anon, authenticated;"
            for kind in _OBJECT_KINDS
        ),
        "REVOKE USAGE ON SCHEMA public FROM anon, authenticated, PUBLIC;",
    ]
)

_REOPEN_DATA_API = " ".join(
    [
        "GRANT USAGE ON SCHEMA public TO anon, authenticated, PUBLIC;",
        *(f"GRANT ALL ON ALL {kind} IN SCHEMA public TO anon, authenticated;" for kind in _OBJECT_KINDS),
        *(
            f"ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON {kind} "
            "TO anon, authenticated;"
            for kind in _OBJECT_KINDS
        ),
    ]
)


def upgrade() -> None:
    """Settle the `users` comment and, on Supabase, shut the Data API roles out of `public`."""
    op.execute(f"COMMENT ON TABLE public.users IS '{USERS_COMMENT}'")
    op.execute(_IF_SUPABASE.format(statements=_SHUT_DATA_API))


def downgrade() -> None:
    """Restore Supabase's default grants. The comment stays: it is `0002`'s own text."""
    op.execute(_IF_SUPABASE.format(statements=_REOPEN_DATA_API))
