"""Database access for user accounts: `users` rows and the one-click email tokens.

The only file in this slice that queries tables (Supabase Auth calls live in `repository_auth.py`).
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from app.core import db
from app.features.identity.models import ContactSettingsRow, OneClickTokenRow, UserProfileRow, UserSummaryRow

_PROFILE_COLUMNS = (
    "id,email,user_type,admin_role,account_suspended,email_verified_at,deleted_at,"
    "preferred_name,client_onboarding_completed_at"
)

# The two token tables share one shape: (user_id, token_hash, expires_at, used_at).
TokenTable = Literal["email_verification_tokens", "password_reset_tokens"]


def list_user_summaries(user_ids: list[str]) -> list[UserSummaryRow]:
    """The named users that exist (unknown ids are simply absent), in one query."""
    unique_ids = sorted({user_id.strip() for user_id in user_ids if user_id and user_id.strip()})
    if not unique_ids:
        return []
    result = (
        db.service_client()
        .table("users")
        .select("id,email,preferred_name,deleted_at")
        .in_("id", unique_ids)
        .execute()
    )
    return [UserSummaryRow.model_validate(row) for row in db.rows(result)]


# --- users -----------------------------------------------------------------------------------------


def get_profile(user_id: str) -> UserProfileRow | None:
    """The account's `users` row, or `None` when it has none."""
    row = db.first(
        db.service_client().table("users").select(_PROFILE_COLUMNS).eq("id", user_id).limit(1).execute()
    )
    return UserProfileRow.model_validate(row) if row else None


def find_profile_by_email(email: str) -> UserProfileRow | None:
    """The `users` row with this (already normalised) email, or `None`."""
    row = db.first(
        db.service_client().table("users").select(_PROFILE_COLUMNS).eq("email", email).limit(1).execute()
    )
    return UserProfileRow.model_validate(row) if row else None


def save_new_profile(*, user_id: str, email: str, user_type: str) -> None:
    """Create or overwrite the `users` row for a new sign-up, marked unverified."""
    db.service_client().table("users").upsert(
        {"id": user_id, "email": email, "user_type": user_type, "email_verified_at": None}
    ).execute()


def update_profile(user_id: str, changes: dict[str, Any]) -> None:
    """Apply `changes` (column → value) to the account's `users` row."""
    db.service_client().table("users").update(changes).eq("id", user_id).execute()


def get_contact_settings(user_id: str) -> ContactSettingsRow | None:
    """The account's contact-sharing columns, or `None` when it has no `users` row."""
    row = db.first(
        db.service_client()
        .table("users")
        .select("contact_phone,share_email,share_phone,share_address")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    return ContactSettingsRow.model_validate(row) if row else None


# --- one-click tokens --------------------------------------------------------------------------------


def invalidate_unused_tokens(table: TokenTable, *, user_id: str, now: datetime) -> None:
    """Mark every unused token of this user as used, so only the newest link works."""
    db.service_client().table(table).update({"used_at": now.isoformat()}).eq("user_id", user_id).is_(
        "used_at", "null"
    ).execute()


def insert_token(table: TokenTable, *, user_id: str, token_hash: str, expires_at: datetime) -> None:
    """Store a new token's hash and expiry."""
    db.service_client().table(table).insert(
        {"user_id": user_id, "token_hash": token_hash, "expires_at": expires_at.isoformat()}
    ).execute()


def find_token(table: TokenTable, token_hash: str) -> OneClickTokenRow | None:
    """The stored token with this hash, used or not, or `None`."""
    row = db.first(
        db.service_client()
        .table(table)
        .select("id,user_id,expires_at,used_at")
        .eq("token_hash", token_hash)
        .limit(1)
        .execute()
    )
    return OneClickTokenRow.model_validate(row) if row else None


def mark_token_used(table: TokenTable, *, token_id: str, now: datetime) -> None:
    """Record that this token's link has been used."""
    db.service_client().table(table).update({"used_at": now.isoformat()}).eq("id", token_id).execute()
