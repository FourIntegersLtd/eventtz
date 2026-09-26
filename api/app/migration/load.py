"""`load`: put an `export` back into a target database that is already at `alembic upgrade head`.

Order:

1. Disable triggers for the session (`SET session_replication_role = replica`).
   This turns off both user triggers (the daily-capacity check from baseline
   migration `033`, `updated_at` stamping) and Postgres's own foreign-key
   checks, so the 25 tables can load in one pass without working out a strict
   dependency order for every row.
2. Truncate every table being loaded, **all in one statement**, before any
   row is inserted — including `help_categories` / `help_articles`, which the
   baseline schema itself seeds (`tables.SEEDED_BY_SCHEMA`). This has to be one
   statement, not a per-table truncate interleaved with that table's insert:
   `TRUNCATE ... CASCADE` cascades to any table with a live foreign key into
   the one being truncated, which is a property of `TRUNCATE` itself, not
   something `session_replication_role = replica` suppresses. `booking_requests`
   is truncated after `booking_notifications` in `PUBLIC_TABLES`' load order,
   and `booking_notifications.booking_id` references it `ON DELETE CASCADE`
   (`backend/sql/011_booking_completed_and_notifications.sql`) — truncating
   `booking_notifications` first, then `booking_requests` on its own later,
   silently wiped the rows `booking_notifications` had just been loaded with.
   Truncating every table together sidesteps the question of order entirely.
3. Insert every exported row.
4. Re-enable triggers (`SET session_replication_role = default`) before the
   transaction commits, so the daily-capacity trigger and `updated_at` stamping
   are protecting the very first write anyone makes after cut-over.
5. Map `auth.users` onto `users.password_hash` / `users.email_verified_at`.

Everything runs inside one transaction: a failure partway through leaves the
target exactly as it was before `load` ran.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from app.migration.export import AUTH_USERS_COLUMNS, ExportManifest
from app.migration.serialization import json_line_to_row
from app.migration.tables import PUBLIC_TABLES


@dataclass
class LoadReport:
    """What `load` did, for `report.py` to render."""

    rows_loaded: dict[str, int] = field(default_factory=dict)
    users_matched_to_auth: int = 0
    users_with_password_set: int = 0
    auth_rows_with_no_matching_user: list[str] = field(default_factory=list)


def _generated_columns(connection: psycopg.Connection[tuple[Any, ...]], table: str) -> set[str]:
    """Column names Postgres computes itself (`GENERATED ALWAYS AS (...) STORED`), never inserted.

    `vendors.business_name_normalized` is one: `export`'s `SELECT *` reads it
    like any other column, but an `INSERT` naming it is refused outright. Asked
    fresh per table rather than hard-coded, so a future generated column does
    not need this file to be touched.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = %s AND is_generated = 'ALWAYS'",
            (table,),
        )
        return {row[0] for row in cursor.fetchall()}


def _json_columns(connection: psycopg.Connection[tuple[Any, ...]], table: str) -> set[str]:
    """Column names typed `json`/`jsonb` in `table`.

    `json_line_to_row` decodes a `jsonb` value back into a plain `dict` or
    `list`, and psycopg only knows how to bind one of those as `jsonb` when it
    is wrapped in `Jsonb`. A `text[]`/`uuid[]` array column (`blog_posts.related_slugs`)
    also decodes to a Python `list`, but psycopg binds *that* correctly as a
    native array on its own — wrapping it in `Jsonb` sends `jsonb` where an
    array was wanted (`DatatypeMismatch`). So only a `json`/`jsonb` column may
    be wrapped, and which columns those are has to come from the schema, not
    from the Python type of the decoded value.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = %s AND data_type IN ('json', 'jsonb')",
            (table,),
        )
        return {row[0] for row in cursor.fetchall()}


def _bind_params(columns: list[str], values: list[Any], json_columns: set[str]) -> list[Any]:
    """`values`, ready for psycopg to bind into an `INSERT`; only a `json_columns` value is wrapped."""
    return [
        Jsonb(value) if column in json_columns and value is not None else value
        for column, value in zip(columns, values, strict=True)
    ]


def _truncate_all_tables(connection: psycopg.Connection[tuple[Any, ...]], tables: tuple[str, ...]) -> None:
    """Truncate every table in `tables` in one statement, before any of them is inserted into.

    `TRUNCATE ... CASCADE` cascades to any table with a live foreign key into
    the one named, regardless of load order or `session_replication_role`.
    Truncating one table at a time, interleaved with that table's own insert,
    means a later `TRUNCATE` can cascade into — and silently re-empty — an
    earlier table that was already truncated *and reloaded*. Naming every
    table in a single `TRUNCATE` statement removes the interleaving that
    makes that possible: nothing has been inserted yet when this runs.
    """
    quoted_tables = ", ".join(f"public.{table}" for table in tables)
    with connection.cursor() as cursor:
        # RESTART IDENTITY is a no-op for a table with no serial/identity column
        # (every loaded table but `help_categories`/`help_articles`, which need
        # it — `tables.SEEDED_BY_SCHEMA`), so applying it to all of them is safe.
        cursor.execute(f"TRUNCATE TABLE {quoted_tables} RESTART IDENTITY CASCADE")  # noqa: S608 - fixed allow-list


def _load_table(
    connection: psycopg.Connection[tuple[Any, ...]], table: str, columns: list[str], data_file: Path
) -> int:
    """Insert every row from `data_file` into `table` (already truncated), in that table's column order."""
    generated = _generated_columns(connection, table)
    # Indices into `columns` (and so into every row's values) that are safe to insert:
    # everything the export recorded except a generated column.
    loadable_indices = [index for index, name in enumerate(columns) if name not in generated]
    loadable_columns = [columns[index] for index in loadable_indices]
    json_columns = _json_columns(connection, table)
    quoted_columns = ", ".join(f'"{name}"' for name in loadable_columns)
    placeholders = ", ".join(["%s"] * len(loadable_columns))
    with connection.cursor() as cursor:
        row_count = 0
        if data_file.exists():
            with data_file.open("r", encoding="utf-8") as handle:
                for line in handle:
                    line = line.strip()
                    if not line:
                        continue
                    row = json_line_to_row(line)
                    raw_values = [row[index] for index in loadable_indices]
                    values = _bind_params(loadable_columns, raw_values, json_columns)
                    cursor.execute(
                        f"INSERT INTO public.{table} ({quoted_columns}) VALUES ({placeholders})",  # noqa: S608
                        values,
                    )
                    row_count += 1
    return row_count


def load_public_schema(
    connection: psycopg.Connection[tuple[Any, ...]], manifest: ExportManifest, out_dir: Path
) -> dict[str, int]:
    """Truncate every table in `PUBLIC_TABLES` and reload it. Caller (`run_load`) manages triggers."""
    rows_loaded: dict[str, int] = {}
    _truncate_all_tables(connection, PUBLIC_TABLES)
    for table in PUBLIC_TABLES:
        columns = manifest.public_tables.get(table, [])
        data_file = out_dir / "data" / f"{table}.ndjson"
        rows_loaded[table] = _load_table(connection, table, columns, data_file)
    return rows_loaded


def load_auth_users(connection: psycopg.Connection[tuple[Any, ...]], out_dir: Path) -> LoadReport:
    """Map each exported `auth.users` row onto the matching `users` row's password and verified-at.

    A `bcrypt` hash lands in `password_hash` untouched: `identity/tokens.py`
    already knows how to verify one and rehash it to argon2 at the user's next
    sign-in (ADR 0003). `email_verified_at` is only backfilled when the loaded
    `users` row does not already have one of its own — Eventtz's own verify
    flow is a different concept from Supabase's `email_confirmed_at`, and the
    public-schema load above already carried across whatever Eventtz recorded.
    """
    report = LoadReport()
    data_file = out_dir / "auth_users.ndjson"
    if not data_file.exists():
        return report
    id_index = AUTH_USERS_COLUMNS.index("id")
    password_index = AUTH_USERS_COLUMNS.index("encrypted_password")
    confirmed_index = AUTH_USERS_COLUMNS.index("email_confirmed_at")
    with connection.cursor() as cursor, data_file.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            values = json_line_to_row(line)
            user_id, password_hash, email_confirmed_at = (
                values[id_index],
                values[password_index],
                values[confirmed_index],
            )
            cursor.execute(
                "UPDATE public.users SET password_hash = %s, "
                "email_verified_at = COALESCE(email_verified_at, %s) WHERE id = %s",
                (password_hash, email_confirmed_at, user_id),
            )
            if cursor.rowcount == 0:
                report.auth_rows_with_no_matching_user.append(str(user_id))
                continue
            report.users_matched_to_auth += 1
            if password_hash:
                report.users_with_password_set += 1
    return report


def run_load(
    connection: psycopg.Connection[tuple[Any, ...]], out_dir: Path
) -> tuple[dict[str, int], LoadReport]:
    """Load `manifest.json`'s tables, then map `auth.users`, all in the caller's transaction.

    Triggers are disabled (`SET session_replication_role = replica`) for both
    steps, not just the public-schema load: `load_auth_users`'s `UPDATE
    public.users SET password_hash = ...` is itself a write, and if the
    `updated_at`-stamping trigger (`eventtz_set_updated_at`) were active for
    it, every migrated user's `updated_at` would be overwritten with the
    cut-over's own timestamp instead of keeping the value carried over from
    the source. Re-enabled once, after both steps, so the daily-capacity
    trigger and `updated_at` stamping are protecting the first write anyone
    makes after cut-over.
    """
    manifest = ExportManifest.read(out_dir)
    with connection.cursor() as cursor:
        cursor.execute("SET session_replication_role = replica")
    try:
        rows_loaded = load_public_schema(connection, manifest, out_dir)
        auth_report = load_auth_users(connection, out_dir)
    finally:
        with connection.cursor() as cursor:
            cursor.execute("SET session_replication_role = default")
    return rows_loaded, auth_report
