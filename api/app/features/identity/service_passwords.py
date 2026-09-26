"""Passwords: forgot (email a reset link), reset (follow it), and change (signed in).

Staff password events are written to the audit log; everyone gets a "password changed" email.
Setting a password ends every existing sign-in by revoking all of the account's refresh chains.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.logging import get_logger
from app.core.ports import Mailer
from app.features.identity import repository
from app.features.identity.domain_accounts import (
    GENERIC_FORGOT_MESSAGE,
    ONE_CLICK_EXPIRY_MINUTES,
    PASSWORD_UPDATED_REAUTH,
    hash_token,
    new_one_click_token,
    normalise_email,
    password_problem,
    reset_password_link,
    token_expiry,
    token_is_well_formed,
    token_state,
)
from app.features.identity.errors import (
    CurrentPasswordIncorrect,
    PasswordUnchanged,
    PasswordUpdateFailed,
    ResetLinkInvalid,
    ResetLinkUsed,
    TooManyLinkAttempts,
    TooManyPasswordChanges,
    TooManyResetRequests,
    WeakPassword,
)
from app.features.identity.schemas import ChangePasswordResponse, ResetPasswordResponse
from app.features.identity.service_accounts import (
    CHANGE_PASSWORD_PER_IP,
    CHANGE_PASSWORD_PER_USER,
    RESET_EMAILS_PER_ADDRESS,
    RESET_EMAILS_PER_IP,
    RESET_LINK_CLICKS_PER_IP,
    account_view,
    is_rate_limited,
)
from app.features.identity.service_session import issue_session
from app.features.identity.tokens import hash_password, verify_password
from app.features.notifications import service as notifications
from app.features.staff import service as staff

log = get_logger(__name__)

_TABLE: repository.TokenTable = "password_reset_tokens"


async def _audit_if_staff(session: AsyncSession, *, user_id: str, user_type: str | None, action: str) -> None:
    """Staff password events go in the audit log (`password.reset_requested`, `.reset`, `.changed`)."""
    if user_type == "admin":
        await staff.record_admin_action(
            session, admin_user_id=user_id, action=action, entity_type="user", entity_id=user_id
        )


def _check_strength(password: str, user_type: str | None) -> None:
    """Raise `WeakPassword` with the specific rule the password breaks."""
    problem = password_problem(password, user_type)
    if problem is not None:
        raise WeakPassword(problem)


async def request_reset(session: AsyncSession, raw_email: str, *, caller: str, mailer: Mailer) -> str:
    """Email a reset link when an open account has this address. The same message either way."""
    email = normalise_email(raw_email)
    if await is_rate_limited(
        account_key=email, per_account=RESET_EMAILS_PER_ADDRESS, caller=caller, per_ip=RESET_EMAILS_PER_IP
    ):
        raise TooManyResetRequests()
    profile = await repository.find_profile_by_email(session, email)
    if profile is None or profile.deleted_at:
        return GENERIC_FORGOT_MESSAGE
    to_email = normalise_email(profile.email) or email
    now = datetime.now(UTC)
    raw_token, token_hash = new_one_click_token()
    await repository.invalidate_unused_tokens(session, _TABLE, user_id=profile.id, now=now)
    await repository.insert_token(
        session, _TABLE, user_id=profile.id, token_hash=token_hash, expires_at=token_expiry(now)
    )
    notifications.send_password_reset(
        mailer,
        email=to_email,
        reset_url=reset_password_link(raw_token, user_type=profile.user_type),
        expires_minutes=ONE_CLICK_EXPIRY_MINUTES,
        user_type=profile.user_type,
    )
    await _audit_if_staff(
        session, user_id=profile.id, user_type=profile.user_type, action="password.reset_requested"
    )
    return GENERIC_FORGOT_MESSAGE


async def reset_with_link(
    session: AsyncSession, raw_token: str, new_password: str, *, caller: str, mailer: Mailer
) -> ResetPasswordResponse:
    """Follow a reset link: set the new password, end every other sign-in, and sign the user in.

    Following the link also proves the user owns the address, so it marks the email verified.
    """
    if await is_rate_limited(
        account_key=None, per_account=None, caller=caller, per_ip=RESET_LINK_CLICKS_PER_IP
    ):
        raise TooManyLinkAttempts()
    if not token_is_well_formed(raw_token):
        raise ResetLinkInvalid()
    token = await repository.find_token(session, _TABLE, hash_token(raw_token.strip()))
    if token is None:
        raise ResetLinkInvalid()
    now = datetime.now(UTC)
    state = token_state(used_at=token.used_at, expires_at=token.expires_at, now=now)
    if state == "used":
        raise ResetLinkUsed()
    if state == "expired":
        raise ResetLinkInvalid()
    profile = await repository.get_profile(session, token.user_id)
    user_type = profile.user_type if profile else None
    _check_strength(new_password, user_type)
    email = normalise_email(profile.email if profile else None)
    if profile is None or not email:
        raise PasswordUpdateFailed()
    await repository.set_password_hash(session, token.user_id, hash_password(new_password))
    await repository.mark_token_used(session, _TABLE, token_id=token.id, now=now)
    await repository.invalidate_unused_tokens(session, _TABLE, user_id=token.user_id, now=now)
    # Anyone who had the old password is signed out everywhere; the new session below is the only one.
    await repository.revoke_all_chains_for_user(
        session, user_id=token.user_id, at=now, reason="password_reset"
    )
    await repository.update_profile(session, token.user_id, {"email_verified_at": now})
    await _audit_if_staff(session, user_id=token.user_id, user_type=user_type, action="password.reset")
    notifications.send_password_changed(mailer, email=email, user_type=user_type)
    tokens = await issue_session(session, user_id=token.user_id, email=email, now=now)
    refreshed = await repository.get_profile(session, token.user_id)
    return ResetPasswordResponse(user=account_view(refreshed or profile), session=tokens)


async def change_password(
    session: AsyncSession,
    principal: Principal,
    *,
    current_password: str,
    new_password: str,
    caller: str,
    mailer: Mailer,
) -> ChangePasswordResponse:
    """Check the current password, set the new one, and end every sign-in of this account.

    The caller signs in again afterwards (the web app drops its tokens on `requires_sign_in`).
    """
    email = normalise_email(principal.email)
    if not email:
        raise PasswordUpdateFailed()
    if await is_rate_limited(
        account_key=principal.id,
        per_account=CHANGE_PASSWORD_PER_USER,
        caller=caller,
        per_ip=CHANGE_PASSWORD_PER_IP,
    ):
        raise TooManyPasswordChanges()
    profile = await repository.get_profile(session, principal.id)
    user_type = profile.user_type if profile else None
    _check_strength(new_password, user_type)
    if current_password == new_password:
        raise PasswordUnchanged()
    credentials = await repository.get_credentials(session, principal.id)
    if credentials is None or not verify_password(credentials.password_hash, current_password):
        raise CurrentPasswordIncorrect()
    now = datetime.now(UTC)
    await repository.set_password_hash(session, principal.id, hash_password(new_password))
    await repository.revoke_all_chains_for_user(
        session, user_id=principal.id, at=now, reason="password_changed"
    )
    await _audit_if_staff(session, user_id=principal.id, user_type=user_type, action="password.changed")
    notifications.send_password_changed(mailer, email=email, user_type=user_type)
    return ChangePasswordResponse(message=PASSWORD_UPDATED_REAUTH, requires_sign_in=True)
