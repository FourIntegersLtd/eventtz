"""Seed the fixed test accounts the acceptance suite signs in as.

Accounts are created straight in the database rather than through `/auth/signup`,
because signup needs the emailed verification link. On the baseline that is local
Supabase (Auth admin API + `public.users`); on api/ it is the `users` row alone,
whose `password_hash` api/ signs in against. Each account is made idempotently, so
re-running the suite reuses it and resets it to a known state (verified, not
suspended, not deleted).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import cache
from typing import Any

from argon2 import PasswordHasher
from supabase import Client

from support.database import LocalDatabase

# One password for every seeded account; the local stack is throwaway.
PASSWORD = "Acceptance-Passw0rd!"


@dataclass(frozen=True)
class SeededAccount:
    """A test account that exists in local Supabase Auth and `public.users`."""

    user_id: str
    email: str
    password: str
    user_type: str


def _find_user_id(admin_db: Client, email: str) -> str | None:
    """The Auth user id for `email`, paging through the local user list.

    Every run seeds fresh accounts, so the list outgrows one page; stopping at
    page one made fixed addresses look new and `create_user` then failed.
    """
    page = 1
    while auth_users := admin_db.auth.admin.list_users(page=page, per_page=1000):
        for auth_user in auth_users:
            if (auth_user.email or "").lower() == email.lower():
                return str(auth_user.id)
        page += 1
    return None


@cache
def _password_hash() -> str:
    """The argon2 hash of `PASSWORD`, as api/ stores it (hashed once; argon2 is slow on purpose)."""
    return PasswordHasher().hash(PASSWORD)


def _seed_api_login(database: LocalDatabase, email: str) -> str:
    """The id of the `users` row for `email` on api/, created if missing, with `PASSWORD` set."""
    existing = database.table("users").select("id").eq("email", email).execute().data
    if existing:
        user_id = str(existing[0]["id"])
        database.table("users").update({"password_hash": _password_hash()}).eq("id", user_id).execute()
        return user_id
    user_id = str(uuid.uuid4())
    database.table("users").insert(
        {"id": user_id, "email": email, "password_hash": _password_hash()}
    ).execute()
    return user_id


def _seed_supabase_login(admin_db: Client, email: str, user_type: str) -> str:
    """The Supabase Auth id for `email` on the baseline, created if missing, with `PASSWORD` set."""
    user_id = _find_user_id(admin_db, email)
    auth_fields: dict[str, Any] = {
        "password": PASSWORD,
        "email_confirm": True,
        "user_metadata": {"user_type": user_type},
    }
    if user_id is None:
        created = admin_db.auth.admin.create_user({"email": email, **auth_fields})
        return str(created.user.id)
    admin_db.auth.admin.update_user_by_id(user_id, auth_fields)
    return user_id


def seed_account(
    admin_db: Client | LocalDatabase,
    email: str,
    user_type: str,
    *,
    admin_role: str | None = None,
    verified: bool = True,
    suspended: bool = False,
    deleted: bool = False,
) -> SeededAccount:
    """Create or reset one account and its `users` row to exactly the given state."""
    now = datetime.now(UTC).isoformat()
    state = {
        "email": email,
        "user_type": user_type,
        "admin_role": admin_role,
        "email_verified_at": now if verified else None,
        "account_suspended": suspended,
        "deleted_at": now if deleted else None,
    }
    if isinstance(admin_db, LocalDatabase):
        user_id = _seed_api_login(admin_db, email)
        admin_db.table("users").update(state).eq("id", user_id).execute()
    else:
        user_id = _seed_supabase_login(admin_db, email, user_type)
        admin_db.table("users").upsert({"id": user_id, **state}).execute()
    return SeededAccount(user_id=user_id, email=email, password=PASSWORD, user_type=user_type)


def unique_email(label: str) -> str:
    """A never-seen-before address, for tests that must start from a brand-new account."""
    return f"acceptance-{label}-{uuid.uuid4().hex[:10]}@example.com"


def close_account(admin_db: Client | LocalDatabase, user_id: str) -> None:
    """Mark an account deleted in `users` only, leaving its session alive.

    (Re-seeding would also reset the password, which revokes sessions and hides
    the behaviour under test.)
    """
    admin_db.table("users").update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", user_id).execute()
