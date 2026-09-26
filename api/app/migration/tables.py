"""Which tables move, in what order, and which side owns tables the other doesn't have.

`PUBLIC_TABLES` is the same 25 tables Alembic revision `0002` snapshotted from
`backend/sql/001-089` (see `BASELINE_TABLES` there), just in dependency order
instead of drop order: parents before the children that foreign-key to them, so
a straight `INSERT` load would work even without disabling triggers. `load.py`
disables triggers anyway (`SET session_replication_role = replica`), which
makes the order academic for correctness, but keeping it dependency-safe means
a future load that can't use that trick still works.
"""

from __future__ import annotations

# Parents first, in an order every foreign key in `backend/sql` respects.
# Keep this the exact reverse of `BASELINE_TABLES` in
# `api/alembic/versions/0002_eventtz_baseline.py` (that list drops dependents
# first; this one loads them last) so the two never quietly drift apart.
PUBLIC_TABLES: tuple[str, ...] = (
    "users",
    "admin_audit_log",
    "vendors",
    "blog_posts",
    "booking_notifications",
    "booking_requests",
    "booking_reviews",
    "celebration_plans",
    "celebration_plan_items",
    "client_events",
    "client_saved_vendors",
    "contact_submissions",
    "conversations",
    "dispute_cases",
    "email_delivery_log",
    "email_verification_tokens",
    "help_categories",
    "help_articles",
    "job_runs",
    "marketplace_events",
    "messages",
    "password_reset_tokens",
    "referral_partners",
    "referral_attributions",
    "stripe_webhook_events",
)

# `help_categories` and `help_articles` are seeded by the baseline schema itself
# (0002's own `_run_sql_file("0002_help_centre.sql")`), so a freshly migrated
# target already has rows in them before the load runs. Truncate those two (and
# every other loaded table, for a clean, repeatable rehearsal) before loading
# production's rows, exactly as the Phase E plan says.
SEEDED_BY_SCHEMA: frozenset[str] = frozenset({"help_categories", "help_articles"})

# `auth.users` is a Supabase-only schema: Postgres Auth's own table, not part of
# `public`. It is never loaded wholesale — only three columns are read from it
# (`load.py`) to fill in `users.password_hash` / `users.email_verified_at`.
SOURCE_ONLY_SCHEMAS: tuple[str, ...] = ("auth", "storage", "realtime", "graphql", "graphql_public", "vault")

# Tables that exist only on the `api/` side because ADR 0003 moved sign-in out
# of Supabase Auth: nothing in the source has rows for them, and the load
# leaves them untouched (a fresh migrated database already has zero rows).
TARGET_ONLY_TABLES: frozenset[str] = frozenset({"refresh_chains", "refresh_tokens"})

# procrastinate ships its own schema (Alembic `0001`, applied verbatim); it is
# job-queue state, not product data, so nothing here reads or writes it. Listed
# so `report.py` can say explicitly that it was seen and skipped, not silently
# dropped.
TARGET_ONLY_SCHEMAS: tuple[str, ...] = ("procrastinate",)

# Every table has an `id` primary key except these two (`backend/sql/075_job_runs.sql`,
# `064_referral_partners.sql`): `verify.py`'s spot check needs the real primary
# key to fetch the *same* row back from both databases, so a table missing
# from here falls back to `("id",)` via `primary_key_columns`.
_NON_STANDARD_PRIMARY_KEYS: dict[str, tuple[str, ...]] = {
    "job_runs": ("job_name", "period_key"),
    "referral_attributions": ("user_id",),
}


def primary_key_columns(table: str) -> tuple[str, ...]:
    """The column(s) that uniquely identify a row in `table`, for the spot check."""
    return _NON_STANDARD_PRIMARY_KEYS.get(table, ("id",))
