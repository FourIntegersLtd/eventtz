"""Seed the fixed test accounts the acceptance suite signs in as.

Accounts are created straight in local Supabase (Auth admin API + `public.users`)
rather than through `/auth/signup`, because signup needs the emailed verification
link. Each account is made idempotently, so re-running the suite reuses it and
resets it to a known state (verified, not suspended, not deleted).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from supabase import Client

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
    """The Auth user id for `email`, searching the (small, local) user list."""
    for auth_user in admin_db.auth.admin.list_users(page=1, per_page=1000):
        if (auth_user.email or "").lower() == email.lower():
            return str(auth_user.id)
    return None


def seed_account(
    admin_db: Client,
    email: str,
    user_type: str,
    *,
    admin_role: str | None = None,
    verified: bool = True,
    suspended: bool = False,
    deleted: bool = False,
) -> SeededAccount:
    """Create or reset one account and its `public.users` row to exactly the given state."""
    user_id = _find_user_id(admin_db, email)
    auth_fields: dict[str, Any] = {
        "password": PASSWORD,
        "email_confirm": True,
        "user_metadata": {"user_type": user_type},
    }
    if user_id is None:
        created = admin_db.auth.admin.create_user({"email": email, **auth_fields})
        user_id = str(created.user.id)
    else:
        admin_db.auth.admin.update_user_by_id(user_id, auth_fields)
    now = datetime.now(UTC).isoformat()
    admin_db.table("users").upsert(
        {
            "id": user_id,
            "email": email,
            "user_type": user_type,
            "admin_role": admin_role,
            "email_verified_at": now if verified else None,
            "account_suspended": suspended,
            "deleted_at": now if deleted else None,
        }
    ).execute()
    return SeededAccount(user_id=user_id, email=email, password=PASSWORD, user_type=user_type)


def unique_email(label: str) -> str:
    """A never-seen-before address, for tests that must start from a brand-new account."""
    return f"acceptance-{label}-{uuid.uuid4().hex[:10]}@example.com"


def close_account(admin_db: Client, user_id: str) -> None:
    """Mark an account deleted in `public.users` only, leaving its Auth session alive.

    (Re-seeding would also reset the password, which revokes sessions and hides
    the behaviour under test.)
    """
    admin_db.table("users").update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", user_id).execute()
