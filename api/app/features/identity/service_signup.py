"""New accounts: sign up, (re)send the verification link, and follow it."""

from __future__ import annotations

from datetime import UTC, datetime

from app.core.logging import get_logger
from app.core.ports import Mailer
from app.features.identity import repository, repository_auth
from app.features.identity.domain_accounts import (
    EMAIL_VERIFIED_SIGN_IN,
    GENERIC_RESEND_MESSAGE,
    ONE_CLICK_EXPIRY_MINUTES,
    SIGNUP_CREATED,
    hash_token,
    new_one_click_token,
    normalise_email,
    token_expiry,
    token_is_well_formed,
    token_state,
    verify_email_link,
)
from app.features.identity.domain_limits import EMAILS_PER_ADDRESS, EMAILS_PER_IP, LINK_CLICKS_PER_IP
from app.features.identity.errors import (
    AuthServiceUnavailable,
    EmailAlreadyRegistered,
    SignupFailed,
    TooManyLinkAttempts,
    TooManyVerificationEmails,
    VerificationLinkInvalid,
    VerifyEmailFailed,
)
from app.features.identity.schemas import SignupRequest, SignupResponse, VerifyEmailResponse
from app.features.identity.service_accounts import account_view, is_rate_limited, profile_only_view
from app.features.notifications import service as notifications
from app.features.referrals import service_partners as referrals

log = get_logger(__name__)

# Verification emails for sign-up and resend share one allowance, per address and per IP.
_ISSUE_BUCKET = "verification-email"
_TABLE: repository.TokenTable = "email_verification_tokens"


def _check_issue_allowance(email: str, client_ip: str | None) -> None:
    """Raise `TooManyVerificationEmails` when this address or IP has had too many links this hour."""
    if is_rate_limited(
        _ISSUE_BUCKET,
        account_key=email,
        client_ip=client_ip,
        per_account=EMAILS_PER_ADDRESS,
        per_ip=EMAILS_PER_IP,
    ):
        raise TooManyVerificationEmails()


def _send_verification_link(mailer: Mailer, *, user_id: str, email: str, user_type: str | None) -> None:
    """Replace the account's unused links with a new one and email it. Never raises.

    If the token cannot be stored no email is sent (a link that cannot work is worse than none).
    """
    now = datetime.now(UTC)
    raw_token, token_hash = new_one_click_token()
    try:
        repository.invalidate_unused_tokens(_TABLE, user_id=user_id, now=now)
        repository.insert_token(_TABLE, user_id=user_id, token_hash=token_hash, expires_at=token_expiry(now))
    except Exception:
        log.exception("verification link could not be stored user_id=%s", user_id)
        return
    notifications.send_email_verification(
        mailer,
        email=email,
        verify_url=verify_email_link(raw_token),
        expires_minutes=ONE_CLICK_EXPIRY_MINUTES,
        user_type=user_type,
    )


def _save_new_profile(*, user_id: str, email: str, user_type: str) -> None:
    """Create the `users` row, unless a closed account with this id is there. Never raises."""
    try:
        existing = repository.get_profile(user_id)
        if existing is not None and existing.deleted_at:
            log.warning("sign-up kept a closed account's tombstone user_id=%s", user_id)
            return
        repository.save_new_profile(user_id=user_id, email=email, user_type=user_type)
    except Exception:
        log.exception("sign-up could not save the users row user_id=%s", user_id)


def sign_up(body: SignupRequest, *, client_ip: str | None, mailer: Mailer) -> SignupResponse:
    """Create an unverified client or vendor account and email the verification link.

    The account exists even if the email allowance is used up (then `TooManyVerificationEmails`
    is raised and the user asks for a new link later).
    """
    email = normalise_email(body.email)
    outcome = repository_auth.sign_up(email=email, password=body.password, user_type=body.user_type)
    if outcome == "email_taken":
        raise EmailAlreadyRegistered()
    if outcome == "unavailable":
        raise AuthServiceUnavailable()
    if isinstance(outcome, str):
        raise SignupFailed()
    user_id = outcome.id
    _save_new_profile(user_id=user_id, email=email, user_type=body.user_type)
    if body.user_type == "vendor" and body.referral_code:
        referrals.attribute_vendor_signup(user_id, body.referral_code)
    # We run our own verification, so Supabase must not also demand a confirmation.
    repository_auth.confirm_email(user_id)
    _check_issue_allowance(email, client_ip)
    _send_verification_link(mailer, user_id=user_id, email=email, user_type=body.user_type)
    user = account_view(outcome, repository.get_profile(user_id))
    return SignupResponse(user=user, session=None, message=SIGNUP_CREATED)


def resend_verification(raw_email: str, *, client_ip: str | None, mailer: Mailer) -> str:
    """Send a new link to an unverified client or vendor. The same message either way."""
    email = normalise_email(raw_email)
    _check_issue_allowance(email, client_ip)
    profile = repository.find_profile_by_email(email)
    if profile is None or profile.user_type == "admin" or profile.email_verified_at or profile.deleted_at:
        return GENERIC_RESEND_MESSAGE
    to_email = normalise_email(profile.email) or email
    _send_verification_link(mailer, user_id=profile.id, email=to_email, user_type=profile.user_type)
    return GENERIC_RESEND_MESSAGE


def _verified_response(user_id: str) -> VerifyEmailResponse:
    """The success answer: the account, and a prompt to sign in (no session is issued)."""
    profile = repository.get_profile(user_id)
    if profile is None or not normalise_email(profile.email):
        raise VerifyEmailFailed()
    return VerifyEmailResponse(message=EMAIL_VERIFIED_SIGN_IN, user=profile_only_view(profile), session=None)


def verify_email(raw_token: str, *, client_ip: str | None, mailer: Mailer) -> VerifyEmailResponse:
    """Follow a verification link. Following it again after success still succeeds."""
    if is_rate_limited(
        "verify-link", account_key=None, client_ip=client_ip, per_account=None, per_ip=LINK_CLICKS_PER_IP
    ):
        raise TooManyLinkAttempts()
    if not token_is_well_formed(raw_token):
        raise VerificationLinkInvalid()
    token = repository.find_token(_TABLE, hash_token(raw_token.strip()))
    if token is None:
        raise VerificationLinkInvalid()
    now = datetime.now(UTC)
    state = token_state(used_at=token.used_at, expires_at=token.expires_at, now=now)
    if state == "used":
        profile = repository.get_profile(token.user_id)
        already_verified = profile is None or profile.user_type == "admin" or bool(profile.email_verified_at)
        if already_verified:
            return _verified_response(token.user_id)
        raise VerificationLinkInvalid()
    if state == "expired":
        raise VerificationLinkInvalid()
    repository.update_profile(token.user_id, {"email_verified_at": now.isoformat()})
    repository.mark_token_used(_TABLE, token_id=token.id, now=now)
    repository.invalidate_unused_tokens(_TABLE, user_id=token.user_id, now=now)
    response = _verified_response(token.user_id)
    repository_auth.confirm_email(token.user_id)
    if response.user is not None and response.user.email:
        notifications.send_welcome(mailer, email=response.user.email, user_type=response.user.user_type)
    return response
