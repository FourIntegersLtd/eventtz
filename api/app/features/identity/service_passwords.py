"""Passwords: forgot (email a reset link), reset (follow it), and change (signed in).

Staff password events are written to the audit log; everyone gets a "password changed" email.
"""

from __future__ import annotations

from datetime import UTC, datetime

from app.core.auth import Principal
from app.core.logging import get_logger
from app.core.ports import Mailer
from app.features.identity import repository, repository_auth
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
from app.features.identity.domain_limits import (
    CHANGE_PASSWORD_PER_IP,
    CHANGE_PASSWORD_PER_USER,
    EMAILS_PER_ADDRESS,
    EMAILS_PER_IP,
    LINK_CLICKS_PER_IP,
)
from app.features.identity.errors import (
    AuthServiceUnavailable,
    CurrentPasswordIncorrect,
    PasswordUnchanged,
    PasswordUpdateFailed,
    ResetLinkInvalid,
    ResetLinkUsed,
    ResetSignInFailed,
    TooManyLinkAttempts,
    TooManyPasswordChanges,
    TooManyResetRequests,
    WeakPassword,
)
from app.features.identity.schemas import AuthSession, ChangePasswordResponse, ResetPasswordResponse
from app.features.identity.service_accounts import account_view, is_rate_limited
from app.features.notifications import service as notifications
from app.features.staff import service as staff

log = get_logger(__name__)

_TABLE: repository.TokenTable = "password_reset_tokens"


def _audit_if_staff(*, user_id: str, user_type: str | None, action: str) -> None:
    """Staff password events go in the audit log (`password.reset_requested`, `.reset`, `.changed`)."""
    if user_type == "admin":
        staff.record_admin_action(admin_user_id=user_id, action=action, entity_type="user", entity_id=user_id)


def _check_strength(password: str, user_type: str | None) -> None:
    """Raise `WeakPassword` with the specific rule the password breaks."""
    problem = password_problem(password, user_type)
    if problem is not None:
        raise WeakPassword(problem)


def request_reset(raw_email: str, *, client_ip: str | None, mailer: Mailer) -> str:
    """Email a reset link when an open account has this address. The same message either way."""
    email = normalise_email(raw_email)
    if is_rate_limited(
        "forgot-password",
        account_key=email,
        client_ip=client_ip,
        per_account=EMAILS_PER_ADDRESS,
        per_ip=EMAILS_PER_IP,
    ):
        raise TooManyResetRequests()
    profile = repository.find_profile_by_email(email)
    if profile is None or profile.deleted_at:
        return GENERIC_FORGOT_MESSAGE
    to_email = normalise_email(profile.email) or email
    now = datetime.now(UTC)
    raw_token, token_hash = new_one_click_token()
    try:
        repository.invalidate_unused_tokens(_TABLE, user_id=profile.id, now=now)
        repository.insert_token(
            _TABLE, user_id=profile.id, token_hash=token_hash, expires_at=token_expiry(now)
        )
    except Exception:
        log.exception("reset link could not be stored user_id=%s", profile.id)
        return GENERIC_FORGOT_MESSAGE
    notifications.send_password_reset(
        mailer,
        email=to_email,
        reset_url=reset_password_link(raw_token, user_type=profile.user_type),
        expires_minutes=ONE_CLICK_EXPIRY_MINUTES,
        user_type=profile.user_type,
    )
    _audit_if_staff(user_id=profile.id, user_type=profile.user_type, action="password.reset_requested")
    return GENERIC_FORGOT_MESSAGE


def reset_with_link(
    raw_token: str, new_password: str, *, client_ip: str | None, mailer: Mailer
) -> ResetPasswordResponse:
    """Follow a reset link: set the new password, end other sessions, and sign the user in.

    Following the link also proves the user owns the address, so it marks the email verified.
    """
    if is_rate_limited(
        "reset-link", account_key=None, client_ip=client_ip, per_account=None, per_ip=LINK_CLICKS_PER_IP
    ):
        raise TooManyLinkAttempts()
    if not token_is_well_formed(raw_token):
        raise ResetLinkInvalid()
    token = repository.find_token(_TABLE, hash_token(raw_token.strip()))
    if token is None:
        raise ResetLinkInvalid()
    now = datetime.now(UTC)
    state = token_state(used_at=token.used_at, expires_at=token.expires_at, now=now)
    if state == "used":
        raise ResetLinkUsed()
    if state == "expired":
        raise ResetLinkInvalid()
    profile = repository.get_profile(token.user_id)
    user_type = profile.user_type if profile else None
    _check_strength(new_password, user_type)
    email = normalise_email(profile.email if profile else None)
    if not email:
        raise PasswordUpdateFailed()
    if not repository_auth.set_password(token.user_id, new_password):
        raise PasswordUpdateFailed()
    repository.mark_token_used(_TABLE, token_id=token.id, now=now)
    repository.invalidate_unused_tokens(_TABLE, user_id=token.user_id, now=now)
    _audit_if_staff(user_id=token.user_id, user_type=user_type, action="password.reset")
    notifications.send_password_changed(mailer, email=email, user_type=user_type)
    outcome = repository_auth.sign_in(email=email, password=new_password)
    if isinstance(outcome, str):
        raise ResetSignInFailed()
    # Anyone who had the old password is signed out everywhere except this new session.
    repository_auth.revoke_sessions(outcome.tokens.access_token, "others")
    repository.update_profile(token.user_id, {"email_verified_at": now.isoformat()})
    user = account_view(outcome.identity, repository.get_profile(token.user_id))
    return ResetPasswordResponse(user=user, session=AuthSession(**outcome.tokens.model_dump()))


def change_password(
    principal: Principal,
    *,
    current_password: str,
    new_password: str,
    client_ip: str | None,
    mailer: Mailer,
) -> ChangePasswordResponse:
    """Check the current password, set the new one, and end every session of this account.

    The caller signs in again afterwards (the router clears their cookies).
    """
    email = normalise_email(principal.email)
    if not email:
        raise PasswordUpdateFailed()
    if is_rate_limited(
        "change-password",
        account_key=principal.id,
        client_ip=client_ip,
        per_account=CHANGE_PASSWORD_PER_USER,
        per_ip=CHANGE_PASSWORD_PER_IP,
    ):
        raise TooManyPasswordChanges()
    profile = repository.get_profile(principal.id)
    user_type = profile.user_type if profile else None
    _check_strength(new_password, user_type)
    if current_password == new_password:
        raise PasswordUnchanged()
    check = repository_auth.sign_in(email=email, password=current_password)
    if check == "unavailable":
        raise AuthServiceUnavailable()
    if isinstance(check, str):
        raise CurrentPasswordIncorrect()
    if not repository_auth.set_password(principal.id, new_password):
        raise PasswordUpdateFailed()
    # Signs out every device, including the session the password check just opened.
    repository_auth.revoke_sessions(check.tokens.access_token, "global")
    _audit_if_staff(user_id=principal.id, user_type=user_type, action="password.changed")
    notifications.send_password_changed(mailer, email=email, user_type=user_type)
    return ChangePasswordResponse(message=PASSWORD_UPDATED_REAUTH, requires_sign_in=True)
