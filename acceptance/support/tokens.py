"""Seed one-click email tokens directly in local Supabase, standing in for the email link.

The baseline never reveals the raw token over HTTP (it only appears in an outgoing email,
which `RESEND_API_KEY=""` suppresses in this environment). Both `email_verification_tokens`
and `password_reset_tokens` store only a SHA-256 hash of the token, so we can mint a raw
token here, insert its hash the same way the baseline does, and hand the raw value to a
test as if it had arrived by email.
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from supabase import Client


def _hash_token(raw_token: str) -> str:
    """The same SHA-256 hex digest the baseline stores for a raw one-click token."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def seed_email_verification_token(
    admin_db: Client,
    user_id: str,
    *,
    expires_in_minutes: float = 60,
    used: bool = False,
) -> str:
    """Insert a verify-email token row for `user_id` and return the raw token to send to the API."""
    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(minutes=expires_in_minutes)
    row = {
        "user_id": user_id,
        "token_hash": _hash_token(raw_token),
        "expires_at": expires_at.isoformat(),
    }
    if used:
        row["used_at"] = datetime.now(UTC).isoformat()
    admin_db.table("email_verification_tokens").insert(row).execute()
    return raw_token


def seed_password_reset_token(
    admin_db: Client,
    user_id: str,
    *,
    expires_in_minutes: float = 60,
    used: bool = False,
) -> str:
    """Insert a reset-password token row for `user_id` and return the raw token to send to the API."""
    raw_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(minutes=expires_in_minutes)
    row = {
        "user_id": user_id,
        "token_hash": _hash_token(raw_token),
        "expires_at": expires_at.isoformat(),
    }
    if used:
        row["used_at"] = datetime.now(UTC).isoformat()
    admin_db.table("password_reset_tokens").insert(row).execute()
    return raw_token
