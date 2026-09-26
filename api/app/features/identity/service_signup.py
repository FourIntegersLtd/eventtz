"""New accounts: sign up, (re)send the verification link, and follow it."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import Mailer
from app.features.identity import repository
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
from app.features.identity.errors import (
    EmailAlreadyRegistered,
    TooManyLinkAttempts,
    TooManyVerificationEmails,
    VerificationLinkInvalid,
    VerifyEmailFailed,
)
from app.features.identity.schemas import SignupRequest, SignupResponse, VerifyEmailResponse
from app.features.identity.service_accounts import (
    VERIFICATION_EMAILS_PER_ADDRESS,
    VERIFICATION_EMAILS_PER_IP,
    VERIFY_LINK_CLICKS_PER_IP,
    account_view,
    is_rate_limited,
)
from app.features.identity.tokens import hash_password
from app.features.notifications import service as notifications
from app.features.referrals import service_partners as referrals

log = get_logger(__name__)

_TABLE: repository.TokenTable = "email_verification_tokens"


async def _check_issue_allowance(email: str, caller: str) -> None:
    """Raise `TooManyVerificationEmails` when this address or caller has had too many links this hour."""
    if await is_rate_limited(
        account_key=email,
        per_account=VERIFICATION_EMAILS_PER_ADDRESS,
        caller=caller,
        per_ip=VERIFICATION_EMAILS_PER_IP,
    ):
        raise TooManyVerificationEmails()


async def _send_verification_link(
    session: AsyncSession, mailer: Mailer, *, user_id: str, email: str, user_type: str | None
) -> None:
    """Replace the account's unused links with a new one and email it."""
    now = datetime.now(UTC)
    raw_token, token_hash = new_one_click_token()
    await repository.invalidate_unused_tokens(session, _TABLE, user_id=user_id, now=now)
    await repository.insert_token(
        session, _TABLE, user_id=user_id, token_hash=token_hash, expires_at=token_expiry(now)
    )
    notifications.send_email_verification(
        mailer,
        email=email,
        verify_url=verify_email_link(raw_token),
        expires_minutes=ONE_CLICK_EXPIRY_MINUTES,
        user_type=user_type,
    )


async def sign_up(
    session: AsyncSession, body: SignupRequest, *, caller: str, mailer: Mailer
) -> SignupResponse:
    """Create an unverified client or vendor account and email the verification link.

    The account exists even if the email allowance is used up: then
    `TooManyVerificationEmails` is raised (it keeps the account, see
    `persist_effects`) and the user asks for a new link later.
    """
    email = normalise_email(body.email)
    user_id = await repository.create_account(
        session, email=email, user_type=body.user_type, password_hash=hash_password(body.password)
    )
    if user_id is None:
        raise EmailAlreadyRegistered()
    if body.user_type == "vendor" and body.referral_code:
        await referrals.attribute_vendor_signup(session, user_id, body.referral_code)
    await _check_issue_allowance(email, caller)
    await _send_verification_link(session, mailer, user_id=user_id, email=email, user_type=body.user_type)
    profile = await repository.get_profile(session, user_id)
    assert profile is not None  # created above, in this transaction
    return SignupResponse(user=account_view(profile), session=None, message=SIGNUP_CREATED)


async def resend_verification(session: AsyncSession, raw_email: str, *, caller: str, mailer: Mailer) -> str:
    """Send a new link to an unverified client or vendor. The same message either way."""
    email = normalise_email(raw_email)
    await _check_issue_allowance(email, caller)
    profile = await repository.find_profile_by_email(session, email)
    if profile is None or profile.user_type == "admin" or profile.email_verified_at or profile.deleted_at:
        return GENERIC_RESEND_MESSAGE
    to_email = normalise_email(profile.email) or email
    await _send_verification_link(
        session, mailer, user_id=profile.id, email=to_email, user_type=profile.user_type
    )
    return GENERIC_RESEND_MESSAGE


async def _verified_response(session: AsyncSession, user_id: str) -> VerifyEmailResponse:
    """The success answer: the account, and a prompt to sign in (no session is issued)."""
    profile = await repository.get_profile(session, user_id)
    if profile is None or not normalise_email(profile.email):
        raise VerifyEmailFailed()
    return VerifyEmailResponse(message=EMAIL_VERIFIED_SIGN_IN, user=account_view(profile), session=None)


async def verify_email(
    session: AsyncSession, raw_token: str, *, caller: str, mailer: Mailer
) -> VerifyEmailResponse:
    """Follow a verification link. Following it again after success still succeeds."""
    if await is_rate_limited(
        account_key=None, per_account=None, caller=caller, per_ip=VERIFY_LINK_CLICKS_PER_IP
    ):
        raise TooManyLinkAttempts()
    if not token_is_well_formed(raw_token):
        raise VerificationLinkInvalid()
    token = await repository.find_token(session, _TABLE, hash_token(raw_token.strip()))
    if token is None:
        raise VerificationLinkInvalid()
    now = datetime.now(UTC)
    state = token_state(used_at=token.used_at, expires_at=token.expires_at, now=now)
    if state == "used":
        profile = await repository.get_profile(session, token.user_id)
        already_verified = profile is None or profile.user_type == "admin" or bool(profile.email_verified_at)
        if already_verified:
            return await _verified_response(session, token.user_id)
        raise VerificationLinkInvalid()
    if state == "expired":
        raise VerificationLinkInvalid()
    await repository.update_profile(session, token.user_id, {"email_verified_at": now})
    await repository.mark_token_used(session, _TABLE, token_id=token.id, now=now)
    await repository.invalidate_unused_tokens(session, _TABLE, user_id=token.user_id, now=now)
    response = await _verified_response(session, token.user_id)
    if response.user is not None and response.user.email:
        notifications.send_welcome(mailer, email=response.user.email, user_type=response.user.user_type)
    return response
