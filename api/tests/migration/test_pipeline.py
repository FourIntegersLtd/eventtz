"""The real `export` -> `load` -> `verify` pipeline, against two migrated Postgres databases.

`migrated_database` (session-scoped, `tests/conftest.py`) is the source: the
same database every other `db`-marked test writes rows into, already at
`alembic upgrade head`. This module additionally creates a second, empty
database on the same server, migrates it the same way, and proves a row
written on one side is readable on the other after `export` and `load`, and
that `verify` reports it clean.
"""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

import psycopg
import pytest

from app.migration import db as migration_db
from app.migration.export import run_export
from app.migration.load import run_load
from app.migration.verify import run_verify

API_ROOT = Path(__file__).resolve().parents[2]


def _first_column(row: tuple[Any, ...] | None) -> Any:
    """`row[0]`, asserting `row` was actually found (`fetchone()` returning `None` is a broken test setup)."""
    assert row is not None
    return row[0]


def _server_admin_url(database_url: str) -> str:
    """`database_url` with its database name swapped for `postgres`, to run `CREATE`/`DROP DATABASE`."""
    parts = urlsplit(database_url)
    return urlunsplit(parts._replace(path="/postgres"))


def _with_database(url: str, database_name: str) -> str:
    """`url` pointed at `database_name` instead of whatever database it names."""
    parts = urlsplit(url)
    return urlunsplit(parts._replace(path=f"/{database_name}"))


@pytest.fixture
def source_with_auth_schema(migrated_database: str) -> Iterator[str]:
    """`migrated_database`, plus a minimal stand-in for Supabase's `auth.users`.

    `migrated_database` is a plain Postgres at `alembic upgrade head` (`public`
    schema only); the real source of a cut-over is Supabase, which also owns an
    `auth` schema this tool reads from (`export_auth_users`). Rather than
    reproducing all of Supabase Auth, this creates just the four columns
    `export_auth_users` selects, function-scoped so it never leaks into a test
    that does not ask for it.
    """
    plain_url = migration_db.normalise(migrated_database)
    with migration_db.connect(plain_url) as connection:
        connection.execute("CREATE SCHEMA IF NOT EXISTS auth")
        connection.execute(
            "CREATE TABLE IF NOT EXISTS auth.users ("
            "id uuid PRIMARY KEY, email text, encrypted_password text, email_confirmed_at timestamptz)"
        )
        connection.commit()
    try:
        yield plain_url
    finally:
        with migration_db.connect(plain_url) as connection:
            connection.execute("DROP TABLE IF EXISTS auth.users")
            connection.execute("DROP SCHEMA IF EXISTS auth")
            connection.commit()


@pytest.fixture
def second_migrated_database(migrated_database: str) -> Iterator[str]:
    """A second, empty database on the same server as `migrated_database`, at `alembic upgrade head`.

    Created and migrated for each test that asks for it (not session-scoped,
    unlike `migrated_database`) and dropped afterwards, so `load`'s truncate
    step always starts from a clean, known target.
    """
    plain_url = migration_db.normalise(migrated_database)
    database_name = f"eventtz_migration_pipeline_{uuid4().hex[:12]}"
    admin_url = _server_admin_url(plain_url)
    with psycopg.connect(admin_url, autocommit=True) as admin_connection:
        admin_connection.execute(f'CREATE DATABASE "{database_name}"')  # noqa: S608 - generated name
    target_url = _with_database(plain_url, database_name)
    subprocess.run(  # noqa: S603 - fixed argv, not shell text
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=API_ROOT,
        env={**os.environ, "DATABASE_URL": target_url},
        check=True,
        capture_output=True,
    )
    try:
        yield target_url
    finally:
        with psycopg.connect(admin_url, autocommit=True) as admin_connection:
            admin_connection.execute(f'DROP DATABASE "{database_name}" WITH (FORCE)')  # noqa: S608


@pytest.mark.db
def test_export_then_load_moves_a_row_to_the_target(
    source_with_auth_schema: str, second_migrated_database: str, tmp_path: Path
) -> None:
    source_url = source_with_auth_schema
    marker_email = f"migration-pipeline-{uuid4().hex[:10]}@example.com"
    with migration_db.connect(source_url) as source_connection:
        source_connection.execute(
            "INSERT INTO public.users (id, email, user_type) VALUES (gen_random_uuid(), %s, 'client')",
            (marker_email,),
        )
        source_connection.commit()

    out_dir = tmp_path / "export"
    with migration_db.connect(source_url) as source_connection:
        run_export(source_connection, out_dir)

    with migration_db.connect(second_migrated_database) as target_connection:
        run_load(target_connection, out_dir)
        target_connection.commit()

    with migration_db.connect(second_migrated_database) as target_connection:
        row = target_connection.execute(
            "SELECT email FROM public.users WHERE email = %s", (marker_email,)
        ).fetchone()
    assert row == (marker_email,)


@pytest.mark.db
def test_verify_reports_clean_after_a_load(
    source_with_auth_schema: str, second_migrated_database: str, tmp_path: Path
) -> None:
    source_url = source_with_auth_schema
    out_dir = tmp_path / "export"
    with migration_db.connect(source_url) as source_connection:
        run_export(source_connection, out_dir)
    with migration_db.connect(second_migrated_database) as target_connection:
        run_load(target_connection, out_dir)
        target_connection.commit()

    with (
        migration_db.connect(source_url) as source_connection,
        migration_db.connect(second_migrated_database) as target_connection,
    ):
        report = run_verify(source_connection, target_connection, random_seed=1)

    assert report.count_mismatches == []
    assert report.is_clean()


@pytest.mark.db
def test_load_keeps_a_row_whose_table_loads_before_the_table_it_references(
    source_with_auth_schema: str, second_migrated_database: str, tmp_path: Path
) -> None:
    """A table that foreign-keys *forward* to one loaded later must still have its rows after `load`.

    `booking_notifications` loads before `booking_requests` in `PUBLIC_TABLES`
    (parents-before-children order, `tables.py`), but
    `booking_notifications.booking_id` foreign-keys to `booking_requests.id`
    `ON DELETE CASCADE` (`backend/sql/011_booking_completed_and_notifications.sql`).
    Truncating `booking_notifications`, loading it, and only then truncating
    `booking_requests` on its own would cascade the second truncate back onto
    the row `booking_notifications` just received. `load_public_schema`
    truncates every table in one statement before any insert to rule that out;
    this proves it end to end rather than trusting the mechanism.
    """
    source_url = source_with_auth_schema
    client_email = f"migration-pipeline-client-{uuid4().hex[:10]}@example.com"
    with migration_db.connect(source_url) as source_connection:
        client_id = _first_column(
            source_connection.execute(
                "INSERT INTO public.users (id, email, user_type) VALUES (gen_random_uuid(), %s, 'client') "
                "RETURNING id",
                (client_email,),
            ).fetchone()
        )
        vendor_owner_id = _first_column(
            source_connection.execute(
                "INSERT INTO public.users (id, email, user_type) VALUES (gen_random_uuid(), %s, 'vendor') "
                "RETURNING id",
                (f"migration-pipeline-vendor-{uuid4().hex[:10]}@example.com",),
            ).fetchone()
        )
        source_connection.execute(
            "INSERT INTO public.vendors (id, user_id) VALUES (gen_random_uuid(), %s)",
            (vendor_owner_id,),
        )
        booking_id = _first_column(
            source_connection.execute(
                "INSERT INTO public.booking_requests "
                "(id, client_user_id, vendor_user_id, event_name, event_date, total_label) "
                "VALUES (gen_random_uuid(), %s, %s, 'Migration pipeline test event', CURRENT_DATE + 30, "
                "'£100') RETURNING id",
                (client_id, vendor_owner_id),
            ).fetchone()
        )
        source_connection.execute(
            "INSERT INTO public.booking_notifications (id, user_id, booking_id, kind) "
            "VALUES (gen_random_uuid(), %s, %s, 'booking_accepted')",
            (client_id, booking_id),
        )
        source_connection.commit()

    out_dir = tmp_path / "export"
    with migration_db.connect(source_url) as source_connection:
        run_export(source_connection, out_dir)
    with migration_db.connect(second_migrated_database) as target_connection:
        run_load(target_connection, out_dir)
        target_connection.commit()

    with migration_db.connect(second_migrated_database) as target_connection:
        notification_count = _first_column(
            target_connection.execute(
                "SELECT count(*) FROM public.booking_notifications WHERE booking_id = %s", (booking_id,)
            ).fetchone()
        )
        booking_count = _first_column(
            target_connection.execute(
                "SELECT count(*) FROM public.booking_requests WHERE id = %s", (booking_id,)
            ).fetchone()
        )
    assert booking_count == 1
    assert notification_count == 1


@pytest.mark.db
def test_load_disables_and_restores_the_daily_capacity_trigger(
    source_with_auth_schema: str, second_migrated_database: str, tmp_path: Path
) -> None:
    """The business trigger from baseline migration `033` is enabled again once `load` returns."""
    source_url = source_with_auth_schema
    out_dir = tmp_path / "export"
    with migration_db.connect(source_url) as source_connection:
        run_export(source_connection, out_dir)
    with migration_db.connect(second_migrated_database) as target_connection:
        run_load(target_connection, out_dir)
        target_connection.commit()

    with migration_db.connect(second_migrated_database) as target_connection:
        row = target_connection.execute(
            "SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'public.booking_requests'::regclass "
            "AND tgname = 'trg_booking_requests_daily_capacity'"
        ).fetchone()
    # 'O' = origin (fires normally); the disabled states are 'D' and 'R'.
    assert row is not None
    assert row[0] == "O"
