"""`adopt-auth`: copy Supabase Auth's password hashes into `users.password_hash`, inside one database.

Production keeps its Supabase Postgres (ADR 0002), so the people and their
data are already where `api/` reads them. Only the passwords are elsewhere:
Supabase Auth keeps them in `auth.users.encrypted_password` as bcrypt, and the
API signs people in from `public.users.password_hash` (ADR 0003). This command
copies one onto the other for matching ids, once, during the cut-over window.

Rules, each held by a test in `tests/migration/test_adopt_auth.py`:

- Only a bcrypt hash (`$2…`) is copied: it is the one kind `identity/tokens.py`
  can verify, and it is rehashed to argon2 at that person's next sign-in.
- An argon2 hash is never overwritten: that person has already signed in
  through the API, so their current password is the argon2 one.
- An existing bcrypt hash is refreshed if Supabase's differs, so running the
  command again after someone changed their password on the baseline picks up
  the new one. A second run with nothing changed writes nothing.
- A closed account (`deleted_at`) is a tombstone and is never touched.
- Nothing is written to the `auth` schema; it is only read.
- `email_confirmed_at` is not copied. The baseline decides "verified" from
  `public.users.email_verified_at` alone, and Supabase's confirmation emails
  are off, so `email_confirmed_at` is set for everyone and would mark
  unverified accounts verified.

`updated_at` is left alone: the `users` trigger that stamps it is disabled for
this one statement (inside the caller's transaction, so a failure re-enables
it by rolling back), because copying a hash is not a change the person made.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import psycopg

# The trigger `backend/sql/` puts on `users` (kept by Alembic `0002`) that sets `updated_at := now()`.
_UPDATED_AT_TRIGGER = "trg_users_updated_at"

# How each `users` row stands against `auth.users`, counted before anything is written.
_COUNT_SQL = """
SELECT
    count(*) FILTER (WHERE auth_user.id IS NOT NULL) AS matched,
    count(*) FILTER (WHERE auth_user.id IS NULL AND app_user.deleted_at IS NULL) AS without_auth_row,
    count(*) FILTER (WHERE auth_user.id IS NOT NULL AND app_user.deleted_at IS NOT NULL) AS tombstones,
    count(*) FILTER (
        WHERE auth_user.id IS NOT NULL AND app_user.deleted_at IS NULL
          AND app_user.password_hash LIKE '$argon2%'
    ) AS already_argon2,
    count(*) FILTER (
        WHERE auth_user.id IS NOT NULL AND app_user.deleted_at IS NULL
          AND coalesce(auth_user.encrypted_password, '') NOT LIKE '$2%'
    ) AS auth_without_bcrypt
FROM public.users AS app_user
LEFT JOIN auth.users AS auth_user ON auth_user.id = app_user.id
"""

# One statement, so the copy is all-or-nothing and makes one round trip over the pooler.
_COPY_SQL = """
UPDATE public.users AS app_user
SET password_hash = auth_user.encrypted_password
FROM auth.users AS auth_user
WHERE auth_user.id = app_user.id
  AND app_user.deleted_at IS NULL
  AND auth_user.encrypted_password LIKE '$2%'
  AND (app_user.password_hash IS NULL OR app_user.password_hash LIKE '$2%')
  AND app_user.password_hash IS DISTINCT FROM auth_user.encrypted_password
"""


@dataclass(frozen=True)
class AdoptAuthReport:
    """What `adopt-auth` found and did: counts only, never an email or a hash."""

    matched: int
    copied: int
    already_argon2: int
    tombstones: int
    auth_without_bcrypt: int
    without_auth_row: int

    def render(self) -> str:
        """The report as the lines the CLI prints."""
        return "\n".join(
            [
                "adopt-auth",
                f"  users matched to auth.users:          {self.matched}",
                f"  password hashes copied (bcrypt):      {self.copied}",
                f"  kept, already argon2:                 {self.already_argon2}",
                f"  skipped, closed account (tombstone):  {self.tombstones}",
                f"  skipped, no bcrypt hash in auth:      {self.auth_without_bcrypt}",
                f"  open accounts with no auth.users row: {self.without_auth_row} (send a reset link)",
            ]
        )


def has_auth_schema(connection: psycopg.Connection[tuple[Any, ...]]) -> bool:
    """Whether this database has Supabase Auth's `auth.users` table to copy from."""
    row = connection.execute("SELECT to_regclass('auth.users') IS NOT NULL").fetchone()
    return bool(row and row[0])


def run_adopt_auth(connection: psycopg.Connection[tuple[Any, ...]]) -> AdoptAuthReport:
    """Copy bcrypt hashes from `auth.users` onto open `users` rows, in the caller's transaction.

    The caller commits (`cli.py`), so a test can run this and roll back.
    """
    if not has_auth_schema(connection):
        raise RuntimeError("no auth.users table in this database; adopt-auth only runs on Supabase")
    count_row = connection.execute(_COUNT_SQL).fetchone()
    assert count_row is not None  # an aggregate always returns one row
    matched, without_auth_row, tombstones, already_argon2, auth_without_bcrypt = count_row
    connection.execute(f"ALTER TABLE public.users DISABLE TRIGGER {_UPDATED_AT_TRIGGER}")
    copied = connection.execute(_COPY_SQL).rowcount
    connection.execute(f"ALTER TABLE public.users ENABLE TRIGGER {_UPDATED_AT_TRIGGER}")
    return AdoptAuthReport(
        matched=matched,
        copied=copied,
        already_argon2=already_argon2,
        tombstones=tombstones,
        auth_without_bcrypt=auth_without_bcrypt,
        without_auth_row=without_auth_row,
    )
