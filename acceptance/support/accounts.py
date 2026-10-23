"""Seed the fixed test accounts the acceptance suite signs in as.

Accounts are created straight in the database rather than through `/auth/signup`,
because signup needs the emailed verification link: the `users` row alone, whose
`password_hash` api/ signs in against. Each account is made idempotently, so
re-running the suite reuses it and resets it to a known state (verified, not
suspended, not deleted).
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import cache
from pathlib import Path

from argon2 import PasswordHasher

from support.database import LocalDatabase

# One password for every seeded account; the local stack is throwaway.
PASSWORD = "Acceptance-Passw0rd!"


# The web copy of the policy numbers; `api/tests/unit/test_policy_constants.py` keeps its
# `termsVersion` equal to the api's `terms_version` setting.
POLICY_CONSTANTS = Path(__file__).resolve().parents[2] / "web" / "lib" / "policyConstants.json"


@cache
def current_terms_version() -> str:
    """The Terms version the api under test requires users to have accepted.

    Real accounts have accepted the current Terms (the gate, ADR 0010, answers 409 otherwise), so
    seeded ones must too or every gated route fails for a reason the frozen tests are not about.
    `ACCEPTANCE_TERMS_VERSION` overrides it for a server run with a different setting.
    """
    override = os.environ.get("ACCEPTANCE_TERMS_VERSION")
    if override:
        return override
    return str(json.loads(POLICY_CONSTANTS.read_text())["termsVersion"])


@dataclass(frozen=True)
class SeededAccount:
    """A test account that exists in the local `users` table."""

    user_id: str
    email: str
    password: str
    user_type: str


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


def seed_account(
    admin_db: LocalDatabase,
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
        "terms_accepted_version": current_terms_version(),
        "terms_accepted_at": now,
    }
    user_id = _seed_api_login(admin_db, email)
    admin_db.table("users").update(state).eq("id", user_id).execute()
    return SeededAccount(user_id=user_id, email=email, password=PASSWORD, user_type=user_type)


def unique_email(label: str) -> str:
    """A never-seen-before address, for tests that must start from a brand-new account."""
    return f"acceptance-{label}-{uuid.uuid4().hex[:10]}@example.com"


def close_account(admin_db: LocalDatabase, user_id: str) -> None:
    """Mark an account deleted in `users` only, leaving its session alive.

    (Re-seeding would also reset the password, which revokes sessions and hides
    the behaviour under test.)
    """
    admin_db.table("users").update({"deleted_at": datetime.now(UTC).isoformat()}).eq("id", user_id).execute()
