"""`export`: a data-only copy of the source database, written to plain files on disk.

Equivalent to `pg_dump --data-only --schema=public`, done with `SELECT *` and
psycopg instead of shelling out to the `pg_dump` binary, so the tool has no
dependency on a matching client version being on `PATH` (ADR 0002 already
depends on psycopg for everything else `api/` does). `auth.users` is exported
separately, and only the three columns the load needs.

Nothing here writes into the repository: `out_dir` is always a caller-supplied
scratch directory, never committed (see `docs/runbooks/cutover.md`).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import psycopg

from app.migration.serialization import row_to_json_line
from app.migration.tables import PUBLIC_TABLES

# The only `auth.users` columns the load needs (ADR 0003): the id to match on,
# the email for the report, the bcrypt hash to become `users.password_hash`,
# and the confirmation timestamp to backfill `users.email_verified_at`.
AUTH_USERS_COLUMNS: tuple[str, ...] = ("id", "email", "encrypted_password", "email_confirmed_at")


@dataclass
class ExportManifest:
    """What `export` wrote: every table's column order and row count, for `load` and `report`."""

    public_tables: dict[str, list[str]] = field(default_factory=dict)
    public_row_counts: dict[str, int] = field(default_factory=dict)
    auth_users_columns: list[str] = field(default_factory=list)
    auth_users_row_count: int = 0

    def write(self, out_dir: Path) -> None:
        """Save the manifest as `manifest.json` inside `out_dir`."""
        (out_dir / "manifest.json").write_text(
            json.dumps(
                {
                    "public_tables": self.public_tables,
                    "public_row_counts": self.public_row_counts,
                    "auth_users_columns": self.auth_users_columns,
                    "auth_users_row_count": self.auth_users_row_count,
                },
                indent=2,
            ),
            encoding="utf-8",
        )

    @classmethod
    def read(cls, out_dir: Path) -> ExportManifest:
        """Load a manifest a previous `export` run wrote."""
        payload = json.loads((out_dir / "manifest.json").read_text(encoding="utf-8"))
        return cls(
            public_tables=payload["public_tables"],
            public_row_counts=payload["public_row_counts"],
            auth_users_columns=payload["auth_users_columns"],
            auth_users_row_count=payload["auth_users_row_count"],
        )


def _export_table(
    connection: psycopg.Connection[tuple[Any, ...]], table: str, out_dir: Path
) -> tuple[list[str], int]:
    """One table's rows, one JSON array per line, to `out_dir/data/<table>.ndjson`."""
    (out_dir / "data").mkdir(parents=True, exist_ok=True)
    data_file = out_dir / "data" / f"{table}.ndjson"
    with connection.cursor() as cursor, data_file.open("w", encoding="utf-8") as handle:
        cursor.execute(f"SELECT * FROM public.{table} ORDER BY 1")  # noqa: S608 - table from a fixed allow-list
        columns = [description.name for description in cursor.description or []]
        row_count = 0
        for row in cursor:
            handle.write(row_to_json_line(row))
            handle.write("\n")
            row_count += 1
    return columns, row_count


ColumnsAndCounts = tuple[dict[str, list[str]], dict[str, int]]


def export_public_schema(connection: psycopg.Connection[tuple[Any, ...]], out_dir: Path) -> ColumnsAndCounts:
    """Every table in `PUBLIC_TABLES`, each to its own file. Returns (columns, row counts) by table."""
    columns_by_table: dict[str, list[str]] = {}
    counts_by_table: dict[str, int] = {}
    for table in PUBLIC_TABLES:
        columns, count = _export_table(connection, table, out_dir)
        columns_by_table[table] = columns
        counts_by_table[table] = count
    return columns_by_table, counts_by_table


def export_auth_users(connection: psycopg.Connection[tuple[Any, ...]], out_dir: Path) -> int:
    """`auth.users`' `id`, `email`, `encrypted_password`, `email_confirmed_at`, to `auth_users.ndjson`."""
    column_list = ", ".join(AUTH_USERS_COLUMNS)
    with connection.cursor() as cursor, (out_dir / "auth_users.ndjson").open("w", encoding="utf-8") as handle:
        cursor.execute(f"SELECT {column_list} FROM auth.users ORDER BY id")  # noqa: S608 - fixed column list
        row_count = 0
        for row in cursor:
            handle.write(row_to_json_line(row))
            handle.write("\n")
            row_count += 1
    return row_count


def run_export(connection: psycopg.Connection[tuple[Any, ...]], out_dir: Path) -> ExportManifest:
    """Export `public` and `auth.users`, write the manifest, and return it."""
    out_dir.mkdir(parents=True, exist_ok=True)
    public_columns, public_counts = export_public_schema(connection, out_dir)
    auth_row_count = export_auth_users(connection, out_dir)
    manifest = ExportManifest(
        public_tables=public_columns,
        public_row_counts=public_counts,
        auth_users_columns=list(AUTH_USERS_COLUMNS),
        auth_users_row_count=auth_row_count,
    )
    manifest.write(out_dir)
    return manifest
