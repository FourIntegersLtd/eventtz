"""Account rules: email clean-up, password strength, one-click email tokens, and settings changes. Pure.

The user-facing copy here is the baseline's, verbatim, because the web app shows it as-is.
"""

from __future__ import annotations

import hashlib
import re
import secrets
from datetime import UTC, datetime, timedelta
from typing import Literal

from app.core.site import public_url

# --- copy shown on success (refusals live in errors.py) --------------------------------------------

SIGNUP_CREATED = "Account created."
GENERIC_RESEND_MESSAGE = (
    "If an account exists for that email and still needs verification, "
    "we sent a new link. Check your inbox (and spam) for an email from Eventtz."
)
GENERIC_FORGOT_MESSAGE = (
    "If an account exists for that email, we sent a link to reset your password. "
    "Check your inbox (and spam) for an email from Eventtz."
)
EMAIL_VERIFIED_SIGN_IN = "Email verified. You can sign in now."
PASSWORD_UPDATED_REAUTH = "Password updated. Sign in again with your new password."  # noqa: S105 (copy, not a secret)

UserType = Literal["client", "vendor", "admin"]


def normalise_email(raw: str | None) -> str:
    """Emails are compared and stored trimmed and lower-case."""
    return (raw or "").strip().lower()


# --- password strength ------------------------------------------------------------------------------

MIN_PASSWORD_LENGTH = 6


def password_problem(password: str, user_type: str | None) -> str | None:
    """Why `password` is too weak for this account type, or `None` if it is fine.

    Everyone needs 6 characters; staff also need an uppercase letter, a number and a symbol.
    """
    if user_type != "admin":
        if len(password) < MIN_PASSWORD_LENGTH:
            return f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        return None
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Admin password must be at least {MIN_PASSWORD_LENGTH} characters."
    if not re.search(r"[A-Z]", password):
        return "Admin password must include an uppercase letter."
    if not re.search(r"[0-9]", password):
        return "Admin password must include a number."
    if not re.search(r"[^A-Za-z0-9]", password):
        return "Admin password must include a symbol."
    return None


# --- one-click tokens (verify email, reset password) ------------------------------------------------

# Random bytes in a new token, and how long its link works.
ONE_CLICK_TOKEN_BYTES = 32
ONE_CLICK_EXPIRY_MINUTES = 60
# Anything shorter cannot be a token we issued, so it is refused without a lookup.
MIN_TOKEN_LENGTH = 20

TokenState = Literal["usable", "used", "expired"]


def hash_token(raw_token: str) -> str:
    """Only the SHA-256 of a token is stored, so a database leak cannot be replayed as links."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def new_one_click_token() -> tuple[str, str]:
    """A fresh `(raw token for the link, hash to store)` pair."""
    raw_token = secrets.token_urlsafe(ONE_CLICK_TOKEN_BYTES)
    return raw_token, hash_token(raw_token)


def token_expiry(now: datetime) -> datetime:
    """When a token issued at `now` stops working."""
    return now + timedelta(minutes=ONE_CLICK_EXPIRY_MINUTES)


def token_is_well_formed(raw_token: str | None) -> bool:
    """True when the token from a link is long enough to be one we issued."""
    return len((raw_token or "").strip()) >= MIN_TOKEN_LENGTH


def parse_timestamp(value: str | None) -> datetime | None:
    """A Postgres timestamp string as an aware datetime (UTC when it has no zone), or `None`."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)


def token_state(*, used_at: str | None, expires_at: str | None, now: datetime) -> TokenState:
    """Whether a stored token can still be used. A token with an unreadable expiry counts as expired."""
    if used_at:
        return "used"
    expiry = parse_timestamp(expires_at)
    if expiry is None or expiry < now:
        return "expired"
    return "usable"


def verify_email_link(raw_token: str) -> str:
    """The link in the verification email."""
    return public_url(f"/verify-email?token={raw_token}")


def reset_password_link(raw_token: str, *, user_type: str | None) -> str:
    """The link in the reset email; staff land on the admin portal's reset page."""
    if user_type == "admin":
        return public_url(f"/reset-password?portal=admin&token={raw_token}")
    return public_url(f"/reset-password?token={raw_token}")


def needs_email_verification(*, user_type: str | None, profile_exists: bool, verified_at: str | None) -> bool:
    """Clients and vendors must verify their email before signing in; staff never do.

    Accounts with no `users` row predate verification and are treated as verified.
    """
    if user_type == "admin" or not profile_exists:
        return False
    return not verified_at


# --- account settings -------------------------------------------------------------------------------


def clean_optional_text(raw: str | None) -> str | None:
    """Trimmed text, with blank meaning "clear it" (`None`)."""
    if raw is None:
        return None
    return raw.strip() or None


def contact_settings_changes(
    *,
    user_type: str,
    contact_phone: str | None,
    share_email: bool | None,
    share_phone: bool | None,
    share_address: bool | None,
) -> dict[str, object]:
    """The `users` columns a contact-settings save changes. Omitted fields are left alone.

    Vendors keep their phone on their vendor profile and have no address to share, so
    those two fields are ignored for vendors.
    """
    is_vendor = user_type == "vendor"
    changes: dict[str, object] = {}
    if contact_phone is not None and not is_vendor:
        changes["contact_phone"] = clean_optional_text(contact_phone)
    if share_email is not None:
        changes["share_email"] = share_email
    if share_phone is not None:
        changes["share_phone"] = share_phone
    if share_address is not None and not is_vendor:
        changes["share_address"] = share_address
    return changes


def onboarding_changes(
    *, preferred_name: str | None, mark_completed: bool, now: datetime
) -> dict[str, object]:
    """The `users` columns a client-onboarding save changes (name and/or the completed time)."""
    changes: dict[str, object] = {}
    if preferred_name is not None:
        changes["preferred_name"] = clean_optional_text(preferred_name)
    if mark_completed:
        changes["client_onboarding_completed_at"] = now.isoformat()
    return changes
