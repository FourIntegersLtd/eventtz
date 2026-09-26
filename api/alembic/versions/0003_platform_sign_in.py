"""Platform sign-in: passwords and refresh tokens live in our own database

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-26

On Supabase, `auth.users` held the password and handed out `users.id`. Here
the API does both (ADR 0003), so `users` gains:

- `password_hash`: argon2, or an imported Supabase bcrypt hash until that
  person next signs in. Nullable: an account imported without one is sent a
  reset link.
- a default id, since nothing upstream mints one any more.
- a unique email. Supabase Auth enforced it; now only this table can. Closed
  accounts null their email, and Postgres lets NULLs repeat, so tombstones
  never collide with a new sign-up.

`refresh_chains` / `refresh_tokens` are OSCE's shape: one chain per sign-in,
every issued token kept so reuse of a spent one can be told from forgery.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES_WITH_UPDATED_AT = ("refresh_chains", "refresh_tokens")


def upgrade() -> None:
    """Add the password column, id default and unique email; create the refresh tables."""
    op.add_column("users", sa.Column("password_hash", sa.Text(), nullable=True))
    op.alter_column("users", "id", server_default=sa.text("gen_random_uuid()"))
    op.create_unique_constraint(op.f("uq_users_email"), "users", ["email"])

    op.create_table(
        "refresh_chains",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.String(length=32), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_refresh_chains_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_chains")),
    )
    op.create_index("ix_refresh_chains_user_id", "refresh_chains", ["user_id"])
    op.create_table(
        "refresh_tokens",
        sa.Column("chain_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["chain_id"],
            ["refresh_chains.id"],
            name=op.f("fk_refresh_tokens_chain_id_refresh_chains"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_refresh_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_refresh_tokens_token_hash")),
    )
    op.create_index("ix_refresh_tokens_chain_id", "refresh_tokens", ["chain_id"])

    # The baseline's own trigger function, so every table stamps `updated_at` the same way.
    for table in TABLES_WITH_UPDATED_AT:
        op.execute(
            f"CREATE TRIGGER trg_{table}_updated_at BEFORE UPDATE ON public.{table} "
            "FOR EACH ROW EXECUTE FUNCTION public.eventtz_set_updated_at()"
        )


def downgrade() -> None:
    """Remove the refresh tables and the sign-in columns."""
    for table in TABLES_WITH_UPDATED_AT:
        op.execute(f"DROP TRIGGER IF EXISTS trg_{table}_updated_at ON public.{table}")
    op.drop_index("ix_refresh_tokens_chain_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
    op.drop_index("ix_refresh_chains_user_id", table_name="refresh_chains")
    op.drop_table("refresh_chains")
    op.drop_constraint(op.f("uq_users_email"), "users", type_="unique")
    op.alter_column("users", "id", server_default=None)
    op.drop_column("users", "password_hash")
