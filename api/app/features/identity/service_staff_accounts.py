"""Admin accounts, for the staff slice's team console.

The staff slice may only call another slice's public surface (`service*`,
`schemas`, `errors`, `jobs` — see `tests/guards/test_slices_call_services_only.py`),
so every account-creation and password-link primitive the team console needs
lives here rather than in `staff/repository.py`.

Unlike the baseline, which asks Supabase Auth's admin API to create a user (and
so must invent a random throwaway password even for invite-link accounts), the
rebuild's own password machinery accepts `password_hash=None`: an invited admin
with no password set is simply an account whose sign-in fails until they follow
their setup link. That link uses the same `password_reset_tokens` table and
`reset_with_link` flow as an ordinary password reset; only the email copy
("purpose") differs.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ports import Mailer
from app.features.identity import repository
from app.features.identity.domain_accounts import (
    ONE_CLICK_EXPIRY_MINUTES,
    new_one_click_token,
    normalise_email,
    reset_password_link,
    token_expiry,
)
from app.features.identity.rows import UserProfileRow
from app.features.identity.tokens import hash_password
from app.features.notifications import service as notifications

_TABLE: repository.TokenTable = "password_reset_tokens"


async def find_admin_account_by_email(session: AsyncSession, email: str) -> UserProfileRow | None:
    """The account with this (not yet normalised) email, whatever its `user_type`, or `None`."""
    return await repository.find_profile_by_email(session, normalise_email(email))


async def create_admin_account(session: AsyncSession, *, email: str, password: str | None) -> str | None:
    """Insert a brand-new admin account and return its id; `None` if the email is already taken.

    `password` is `None` for an invite-link account (see the module docstring);
    callers that pass a password have already checked its strength.
    """
    return await repository.create_account(
        session,
        email=normalise_email(email),
        user_type="admin",
        password_hash=hash_password(password) if password else None,
        admin_role="admin",
        email_verified_at=datetime.now(UTC),  # staff never go through the client/vendor verify flow
    )


async def promote_to_admin(session: AsyncSession, user_id: str, *, password: str | None) -> None:
    """Turn an existing client/vendor account into a plain admin, optionally setting a password."""
    changes: dict[str, object] = {"user_type": "admin", "admin_role": "admin"}
    if password:
        changes["password_hash"] = hash_password(password)
    await repository.update_profile(session, user_id, changes)


async def set_account_password(session: AsyncSession, user_id: str, password: str) -> None:
    """Set (or replace) an account's password hash directly, bypassing the one-click-link flow.

    Used only when the team console is given a password at invite time; the
    account can still sign in through the ordinary reset flow afterwards.
    """
    await repository.set_password_hash(session, user_id, hash_password(password))


async def _send_password_link(
    session: AsyncSession, mailer: Mailer, *, email: str, user_id: str, purpose: str
) -> bool:
    """Issue a fresh one-click token and email its link, reusing the reset-password machinery."""
    now = datetime.now(UTC)
    raw_token, token_hash = new_one_click_token()
    await repository.invalidate_unused_tokens(session, _TABLE, user_id=user_id, now=now)
    await repository.insert_token(
        session, _TABLE, user_id=user_id, token_hash=token_hash, expires_at=token_expiry(now)
    )
    return notifications.send_password_reset(
        mailer,
        email=email,
        reset_url=reset_password_link(raw_token, user_type="admin"),
        expires_minutes=ONE_CLICK_EXPIRY_MINUTES,
        user_type="admin",
        purpose=purpose,  # type: ignore[arg-type]
    )


async def send_admin_setup_link(session: AsyncSession, mailer: Mailer, *, email: str, user_id: str) -> bool:
    """Email a brand-new (or just-promoted) admin their password-setup link."""
    return await _send_password_link(session, mailer, email=email, user_id=user_id, purpose="setup")


async def send_admin_reset_link(session: AsyncSession, mailer: Mailer, *, email: str, user_id: str) -> bool:
    """Email an existing admin a password-reset link (the "send reset link" team action)."""
    return await _send_password_link(session, mailer, email=email, user_id=user_id, purpose="reset")
