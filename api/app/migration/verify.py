"""`verify`: compare the live source and target databases after a `load`.

Three checks, each cheap enough to run against production-sized data without a
maintenance-window budget blowing out:

1. **Row counts** per table, source vs target.
2. **Spot checks**: a handful of ids per table, fetched from both sides and
   compared column by column.
3. **Users with no password hash** in the target — every one of them needs a
   reset email before they can sign in (the runbook says so).
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import Any

import psycopg

from app.migration.tables import PUBLIC_TABLES, primary_key_columns

# How many rows per table the spot check pulls. Small on purpose: this is a
# sanity check that the load moved the right *shape* of data, not a full diff.
SPOT_CHECK_ROWS_PER_TABLE = 5


@dataclass
class TableCountMismatch:
    """One table whose source and target row counts disagree."""

    table: str
    source_count: int
    target_count: int


@dataclass
class SpotCheckMismatch:
    """One row that differs between source and target on at least one column."""

    table: str
    row_id: str
    differing_columns: dict[str, tuple[object, object]]


@dataclass
class VerifyReport:
    """Everything `verify` found, ready for `report.py` to render."""

    source_counts: dict[str, int] = field(default_factory=dict)
    target_counts: dict[str, int] = field(default_factory=dict)
    count_mismatches: list[TableCountMismatch] = field(default_factory=list)
    spot_checked_rows: int = 0
    spot_check_mismatches: list[SpotCheckMismatch] = field(default_factory=list)
    users_without_password_hash: list[str] = field(default_factory=list)

    def is_clean(self) -> bool:
        """Whether the load matches the source exactly: no count or spot-check mismatches."""
        return not self.count_mismatches and not self.spot_check_mismatches


def _row_count(connection: psycopg.Connection[tuple[Any, ...]], table: str) -> int:
    """`SELECT count(*)` for one table, from the fixed `PUBLIC_TABLES` allow-list."""
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT count(*) FROM public.{table}")  # noqa: S608 - table from a fixed allow-list
        row = cursor.fetchone()
        return int(row[0]) if row else 0


def compare_row_counts(
    source: psycopg.Connection[tuple[Any, ...]], target: psycopg.Connection[tuple[Any, ...]]
) -> tuple[dict[str, int], dict[str, int], list[TableCountMismatch]]:
    """Row counts for every table in `PUBLIC_TABLES`, and the ones that disagree."""
    source_counts = {table: _row_count(source, table) for table in PUBLIC_TABLES}
    target_counts = {table: _row_count(target, table) for table in PUBLIC_TABLES}
    mismatches = [
        TableCountMismatch(table=table, source_count=source_counts[table], target_count=target_counts[table])
        for table in PUBLIC_TABLES
        if source_counts[table] != target_counts[table]
    ]
    return source_counts, target_counts, mismatches


def _fetch_row(
    connection: psycopg.Connection[tuple[Any, ...]], table: str, row_key: tuple[object, ...]
) -> dict[str, object] | None:
    """One row's columns as a dict, or `None` if `row_key` is not there.

    `row_key` is the primary key's values, in `primary_key_columns(table)` order
    — one value for every table but `job_runs`, which has a composite key.
    """
    key_columns = primary_key_columns(table)
    where_clause = " AND ".join(f'"{column}" = %s' for column in key_columns)
    with connection.cursor(row_factory=psycopg.rows.dict_row) as cursor:
        cursor.execute(f"SELECT * FROM public.{table} WHERE {where_clause}", row_key)  # noqa: S608
        return cursor.fetchone()


def _sample_ids(
    connection: psycopg.Connection[tuple[Any, ...]], table: str, sample_size: int
) -> list[tuple[object, ...]]:
    """Up to `sample_size` random primary keys from `table`, for the spot check."""
    key_columns = primary_key_columns(table)
    quoted_columns = ", ".join(f'"{column}"' for column in key_columns)
    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT {quoted_columns} FROM public.{table} ORDER BY random() LIMIT %s",  # noqa: S608
            (sample_size,),
        )
        return [tuple(row) for row in cursor.fetchall()]


def _format_row_key(table: str, row_key: tuple[object, ...]) -> str:
    """`row_key` as `col=value` pairs, so a composite key like `job_runs`'s reads clearly in a report."""
    columns = primary_key_columns(table)
    return ", ".join(f"{column}={value}" for column, value in zip(columns, row_key, strict=True))


def spot_check(
    source: psycopg.Connection[tuple[Any, ...]],
    target: psycopg.Connection[tuple[Any, ...]],
    *,
    sample_size: int = SPOT_CHECK_ROWS_PER_TABLE,
    random_seed: int | None = None,
) -> tuple[int, list[SpotCheckMismatch]]:
    """Compare `sample_size` random rows per table between `source` and `target`, column by column."""
    if random_seed is not None:
        random.seed(random_seed)
    mismatches: list[SpotCheckMismatch] = []
    checked = 0
    for table in PUBLIC_TABLES:
        for row_key in _sample_ids(source, table, sample_size):
            source_row = _fetch_row(source, table, row_key)
            target_row = _fetch_row(target, table, row_key)
            checked += 1
            if source_row is None:
                continue
            row_id = _format_row_key(table, row_key)
            if target_row is None:
                missing_columns: dict[str, tuple[object, object]] = {"<row>": ("present", "missing")}
                mismatch = SpotCheckMismatch(table=table, row_id=row_id, differing_columns=missing_columns)
                mismatches.append(mismatch)
                continue
            differing = {
                column: (source_row[column], target_row.get(column))
                for column in source_row
                if column in target_row and source_row[column] != target_row[column]
            }
            if differing:
                mismatch = SpotCheckMismatch(table=table, row_id=row_id, differing_columns=differing)
                mismatches.append(mismatch)
    return checked, mismatches


def users_without_password_hash(target: psycopg.Connection[tuple[Any, ...]]) -> list[str]:
    """Emails of open (`deleted_at IS NULL`) target users with no password hash to sign in with."""
    with target.cursor() as cursor:
        cursor.execute(
            "SELECT email FROM public.users WHERE password_hash IS NULL AND deleted_at IS NULL ORDER BY email"
        )
        return [row[0] for row in cursor.fetchall()]


def run_verify(
    source: psycopg.Connection[tuple[Any, ...]],
    target: psycopg.Connection[tuple[Any, ...]],
    *,
    random_seed: int | None = None,
) -> VerifyReport:
    """Run every check and return one report."""
    source_counts, target_counts, count_mismatches = compare_row_counts(source, target)
    spot_checked_rows, spot_check_mismatches = spot_check(source, target, random_seed=random_seed)
    return VerifyReport(
        source_counts=source_counts,
        target_counts=target_counts,
        count_mismatches=count_mismatches,
        spot_checked_rows=spot_checked_rows,
        spot_check_mismatches=spot_check_mismatches,
        users_without_password_hash=users_without_password_hash(target),
    )
