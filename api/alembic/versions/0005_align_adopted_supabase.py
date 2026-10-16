"""Align an adopted Supabase database with the 0002 snapshot

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-16

Cut-over stamps the live Supabase database as `0002` (`docs/runbooks/cutover.md`),
but live was built by `backend/sql/` over years and differs from the snapshot.
A schema-only restore of a live backup, compared catalog by catalog, found:

- `backend/sql/033` never applied: the daily-capacity functions, trigger and
  partial index are missing.
- `backend/sql/006`'s `admin_vendor_list` view is missing (nothing reads it).
- `backend/sql/071` never applied: `messages_body_len` still caps at 5000.
- `vendors` keeps the `vendor_onboarding_*` constraint names from before
  `backend/sql/003`'s table rename. `077` added the `ON DELETE RESTRICT` key
  `vendors_user_id_fkey` but dropped the old one by its new name, so the
  `ON DELETE CASCADE` key `vendor_onboarding_user_id_fkey` is still there too.
- Six column comments are older wordings or missing.

`0005_align_adopted_supabase.sql` fixes each one idempotently, with `0002`'s
exact definitions, so on a database built by `upgrade head` it changes nothing.

Left alone on purpose (Alembic does not compare them, and the API's `postgres`
role owns the tables): row-level security on extra tables,
`vendor_review_stats`' `security_invoker`, and Supabase's `rls_auto_enable`
event-trigger function.
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SQL_FILE = Path(__file__).resolve().parent.parent / "sql" / "0005_align_adopted_supabase.sql"


def upgrade() -> None:
    """Run the alignment script as one parameterless string.

    Not `op.execute`: SQLAlchemy's `text()` would read `%I` and `:name`-like text
    in the function bodies as parameters (same reason as `0002`).
    """
    op.get_bind().exec_driver_sql(SQL_FILE.read_text(), execution_options={"no_parameters": True})


def downgrade() -> None:
    """Nothing to undo.

    Every object this revision touches belongs to `0002`'s schema: on a fresh
    database it was already there, and on an adopted one restoring live's
    drift (no capacity trigger, a cascading vendor key, old names) would only
    reintroduce bugs. `0002`'s own downgrade drops these objects.
    """
