"""`adopt-auth` against a migrated Postgres with a stand-in for Supabase's `auth.users`.

Each test runs on one connection inside one transaction that is rolled back,
so the stand-in `auth` schema and every row vanish afterwards. `auth.users`
gets a trigger that raises on any write: if `adopt-auth` ever wrote to it, the
test would fail with that error, not just with a wrong value.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any
from uuid import UUID, uuid4

import psycopg
import pytest

from app.migration import db as migration_db
from app.migration.adopt_auth import run_adopt_auth
from app.migration.cli import main

BCRYPT_HASH = "$2a$10$abcdefghijklmnopqrstuuSupabaseHashForAcceptanceOnly000"
NEWER_BCRYPT_HASH = "$2a$10$abcdefghijklmnopqrstuuSupabaseHashChangedOnBaseline00"
ARGON2_HASH = "$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHQ$aGFzaGhhc2hoYXNoaGFzaA"

Connection = psycopg.Connection[tuple[Any, ...]]


@pytest.fixture
def connection(migrated_database: str) -> Iterator[Connection]:
    """One connection to the migrated database with a write-proof `auth.users`, rolled back at the end."""
    with migration_db.connect(migration_db.normalise(migrated_database)) as open_connection:
        open_connection.execute("CREATE SCHEMA auth")
        open_connection.execute(
            "CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, encrypted_password text, "
            "email_confirmed_at timestamptz)"
        )
        open_connection.execute(
            "CREATE FUNCTION auth.refuse_write() RETURNS trigger LANGUAGE plpgsql AS "
            "$$ BEGIN RAISE EXCEPTION 'adopt-auth wrote to auth.users'; END $$"
        )
        open_connection.execute(
            "CREATE TRIGGER refuse_write BEFORE INSERT OR UPDATE OR DELETE ON auth.users "
            "FOR EACH STATEMENT EXECUTE FUNCTION auth.refuse_write()"
        )
        try:
            yield open_connection
        finally:
            open_connection.rollback()


def _add_person(
    connection: Connection,
    *,
    auth_hash: str | None,
    app_hash: str | None = None,
    closed: bool = False,
    with_auth_row: bool = True,
) -> UUID:
    """A `users` row (and, unless told otherwise, its `auth.users` twin); returns the shared id."""
    person_id = uuid4()
    email = f"adopt-auth-{person_id.hex[:10]}@example.com"
    connection.execute(
        "INSERT INTO public.users (id, email, user_type, password_hash, deleted_at, updated_at) "
        "VALUES (%s, %s, 'client', %s, CASE WHEN %s THEN now() END, '2026-01-02T03:04:05+00:00')",
        (person_id, None if closed else email, app_hash, closed),
    )
    if with_auth_row:
        connection.execute("ALTER TABLE auth.users DISABLE TRIGGER refuse_write")
        connection.execute(
            "INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at) "
            "VALUES (%s, %s, %s, now())",
            (person_id, email, auth_hash),
        )
        connection.execute("ALTER TABLE auth.users ENABLE TRIGGER refuse_write")
    return person_id


def _stored(connection: Connection, person_id: UUID) -> tuple[Any, ...]:
    """`(password_hash, email_verified_at, updated_at as text)` of one `users` row."""
    row = connection.execute(
        "SELECT password_hash, email_verified_at, "
        "to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') "
        "FROM public.users WHERE id = %s",
        (person_id,),
    ).fetchone()
    assert row is not None
    return row


@pytest.mark.db
def test_copies_a_bcrypt_hash_and_leaves_verified_and_updated_at_alone(connection: Connection) -> None:
    person_id = _add_person(connection, auth_hash=BCRYPT_HASH)

    report = run_adopt_auth(connection)

    assert report.copied == 1
    assert _stored(connection, person_id) == (BCRYPT_HASH, None, "2026-01-02 03:04:05")


@pytest.mark.db
def test_a_second_run_writes_nothing_until_supabase_changes(connection: Connection) -> None:
    person_id = _add_person(connection, auth_hash=BCRYPT_HASH)
    run_adopt_auth(connection)

    assert run_adopt_auth(connection).copied == 0

    connection.execute("ALTER TABLE auth.users DISABLE TRIGGER refuse_write")
    connection.execute(
        "UPDATE auth.users SET encrypted_password = %s WHERE id = %s", (NEWER_BCRYPT_HASH, person_id)
    )
    connection.execute("ALTER TABLE auth.users ENABLE TRIGGER refuse_write")
    assert run_adopt_auth(connection).copied == 1
    assert _stored(connection, person_id)[0] == NEWER_BCRYPT_HASH


@pytest.mark.db
def test_never_overwrites_an_argon2_hash(connection: Connection) -> None:
    person_id = _add_person(connection, auth_hash=BCRYPT_HASH, app_hash=ARGON2_HASH)

    report = run_adopt_auth(connection)

    assert (report.copied, report.already_argon2) == (0, 1)
    assert _stored(connection, person_id)[0] == ARGON2_HASH


@pytest.mark.db
def test_never_touches_a_closed_account(connection: Connection) -> None:
    person_id = _add_person(connection, auth_hash=BCRYPT_HASH, closed=True)

    report = run_adopt_auth(connection)

    assert (report.copied, report.tombstones) == (0, 1)
    assert _stored(connection, person_id) == (None, None, "2026-01-02 03:04:05")


@pytest.mark.db
def test_counts_accounts_without_a_hash_to_copy(connection: Connection) -> None:
    # Other db tests commit `users` rows with no auth twin, so that count is compared before and after.
    already_without_auth_row = run_adopt_auth(connection).without_auth_row
    _add_person(connection, auth_hash=None)
    _add_person(connection, auth_hash=None, with_auth_row=False)

    report = run_adopt_auth(connection)

    assert (report.copied, report.auth_without_bcrypt) == (0, 1)
    assert report.without_auth_row == already_without_auth_row + 1


@pytest.mark.db
def test_only_reads_the_auth_schema(connection: Connection) -> None:
    # The trigger raises on any write to auth.users; a clean run with a copy is the proof.
    _add_person(connection, auth_hash=BCRYPT_HASH)

    assert run_adopt_auth(connection).copied == 1
    row = connection.execute("SELECT count(*), max(encrypted_password) FROM auth.users").fetchone()
    assert row == (1, BCRYPT_HASH)


def test_the_cli_refuses_a_hosted_database_without_approval() -> None:
    hosted = "postgresql://postgres.projectref:secret@aws-0-eu-west-2.pooler.supabase.com:5432/postgres"

    assert main(["adopt-auth", "--target-url", hosted]) == 2
