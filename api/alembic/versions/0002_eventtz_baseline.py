"""Eventtz baseline: the schema `backend/sql/001–089` built on Supabase

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-26

A schema-only `pg_dump` of a fresh Postgres with every numbered baseline
migration applied, cleaned of what only Supabase needs: the `auth` schema and
row-level security (the API is the only client, so nothing reads through
PostgREST's roles). Every function, trigger and view is kept, including the
daily-capacity trigger from migration 033.

The help centre's categories and articles ride along: the baseline migrations
seeded them, so an empty database without them is not the same product. The
Phase E data load truncates both tables before loading production's rows.

After this snapshot, a live fix added to `backend/sql/` must also land here as
a new revision (AGENTS.md, Traps).
"""

from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SQL_FOLDER = Path(__file__).resolve().parent.parent / "sql"

# Every object 0002 creates, in an order that drops dependents first.
BASELINE_VIEWS = ("vendor_review_stats", "admin_vendor_list")
BASELINE_TABLES = (
    "stripe_webhook_events",
    "referral_attributions",
    "referral_partners",
    "password_reset_tokens",
    "messages",
    "marketplace_events",
    "job_runs",
    "help_articles",
    "help_categories",
    "email_verification_tokens",
    "email_delivery_log",
    "dispute_cases",
    "conversations",
    "contact_submissions",
    "client_saved_vendors",
    "client_events",
    "celebration_plan_items",
    "celebration_plans",
    "booking_reviews",
    "booking_requests",
    "booking_notifications",
    "blog_posts",
    "vendors",
    "admin_audit_log",
    "users",
)
BASELINE_FUNCTIONS = (
    "enforce_booking_daily_capacity()",
    "eventtz_parse_max_bookings_per_day(jsonb)",
    "eventtz_set_updated_at()",
)


def _run_sql_file(name: str) -> None:
    """Send a whole file to Postgres as one parameterless string.

    Not `op.execute`: that wraps the text in SQLAlchemy's `text()`, which reads
    `:word` in the help articles as a bind parameter. `no_parameters` makes the
    driver call `cursor.execute(sql)` with no parameter argument, so psycopg
    uses the simple query protocol: many statements per call, `%` left alone.
    """
    statements = (SQL_FOLDER / name).read_text()
    op.get_bind().exec_driver_sql(statements, execution_options={"no_parameters": True})


def upgrade() -> None:
    """Create the baseline schema, then load the help centre."""
    _run_sql_file("0002_baseline_schema.sql")
    _run_sql_file("0002_help_centre.sql")


def downgrade() -> None:
    """Drop everything the baseline created."""
    for view in BASELINE_VIEWS:
        op.execute(f"DROP VIEW IF EXISTS public.{view}")
    for table in BASELINE_TABLES:
        op.execute(f"DROP TABLE IF EXISTS public.{table} CASCADE")
    for function in BASELINE_FUNCTIONS:
        op.execute(f"DROP FUNCTION IF EXISTS public.{function}")
    op.execute("DROP TYPE IF EXISTS public.user_type")
