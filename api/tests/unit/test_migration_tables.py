"""`app.migration.tables`: the table list must be the exact reverse of the baseline snapshot's.

If `api/alembic/versions/0002_eventtz_baseline.py` ever gains or loses a table,
this test fails until `tables.PUBLIC_TABLES` is updated to match — the two are
not allowed to drift apart silently.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

from app.migration.tables import PUBLIC_TABLES, TARGET_ONLY_TABLES, primary_key_columns

ALEMBIC_0002 = Path(__file__).resolve().parents[2] / "alembic" / "versions" / "0002_eventtz_baseline.py"


def _load_baseline_tables() -> tuple[str, ...]:
    """`BASELINE_TABLES` from the `0002` migration module, loaded without importing `alembic`."""
    spec = importlib.util.spec_from_file_location("baseline_0002", ALEMBIC_0002)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    baseline_tables: tuple[str, ...] = module.BASELINE_TABLES
    return baseline_tables


def test_public_tables_is_the_reverse_of_the_baseline_snapshot() -> None:
    assert tuple(reversed(_load_baseline_tables())) == PUBLIC_TABLES


def test_public_tables_and_target_only_tables_do_not_overlap() -> None:
    assert set(PUBLIC_TABLES).isdisjoint(TARGET_ONLY_TABLES)


def test_public_tables_has_no_duplicates() -> None:
    assert len(PUBLIC_TABLES) == len(set(PUBLIC_TABLES))


def test_most_tables_key_on_id() -> None:
    assert primary_key_columns("users") == ("id",)
    assert primary_key_columns("booking_requests") == ("id",)


def test_job_runs_keys_on_its_composite_primary_key() -> None:
    """`backend/sql/075_job_runs.sql`: `PRIMARY KEY (job_name, period_key)`, no `id` column at all."""
    assert primary_key_columns("job_runs") == ("job_name", "period_key")


def test_referral_attributions_keys_on_user_id() -> None:
    """`backend/sql/064_referral_partners.sql`: `user_id uuid PRIMARY KEY`, no `id` column."""
    assert primary_key_columns("referral_attributions") == ("user_id",)
