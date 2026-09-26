"""Sessions: sign in, refresh, sign out, and who am I."""

from __future__ import annotations

from app.core.auth import Principal
from app.core.logging import get_logger
from app.features.identity import repository, repository_auth
from app.features.identity.domain_accounts import needs_email_verification, normalise_email
from app.features.identity.domain_limits import SIGN_IN_PER_EMAIL, SIGN_IN_PER_IP
from app.features.identity.errors import (
    AuthServiceUnavailable,
    DeletedAtSignIn,
    EmailNotConfirmed,
    EmailNotVerified,
    RefreshExpired,
    SignInFailed,
    SignInUnavailable,
    SuspendedAtSignIn,
    TooManySignIns,
    WrongCredentials,
)
from app.features.identity.schemas import (
    AuthSession,
    MeResponse,
    RefreshSessionResponse,
    SignInRequest,
    SignInResponse,
)
from app.features.identity.service_accounts import account_view, is_rate_limited, principal_view

log = get_logger(__name__)


def sign_in(body: SignInRequest, *, client_ip: str | None) -> SignInResponse:
    """Check the password, then refuse suspended, closed or unverified accounts.

    A session Supabase issued for a refused account is revoked straight away.
    """
    email = normalise_email(body.email)
    if is_rate_limited(
        "sign-in",
        account_key=email,
        client_ip=client_ip,
        per_account=SIGN_IN_PER_EMAIL,
        per_ip=SIGN_IN_PER_IP,
    ):
        raise TooManySignIns()
    outcome = repository_auth.sign_in(email=email, password=body.password)
    if outcome == "wrong_credentials":
        raise WrongCredentials()
    if outcome == "email_not_confirmed":
        raise EmailNotConfirmed()
    if outcome == "unavailable":
        raise SignInUnavailable()
    if isinstance(outcome, str):
        raise SignInFailed()
    profile = repository.get_profile(outcome.identity.id)
    user = account_view(outcome.identity, profile)
    refusal: Exception | None = None
    if user.account_suspended:
        refusal = SuspendedAtSignIn()
    elif profile is not None and profile.deleted_at:
        refusal = DeletedAtSignIn()
    elif user.user_type in ("client", "vendor") and needs_email_verification(
        user_type=profile.user_type if profile else None,
        profile_exists=profile is not None,
        verified_at=profile.email_verified_at if profile else None,
    ):
        refusal = EmailNotVerified()
    if refusal is not None:
        repository_auth.revoke_sessions(outcome.tokens.access_token)
        log.info("sign-in refused user_id=%s reason=%s", user.id, type(refusal).__name__)
        raise refusal
    return SignInResponse(user=user, session=AuthSession(**outcome.tokens.model_dump()))


def refresh(refresh_token: str | None) -> RefreshSessionResponse:
    """Swap a refresh token for a new session. Raises `RefreshExpired` or `AuthServiceUnavailable`."""
    if not refresh_token:
        raise RefreshExpired()
    outcome = repository_auth.refresh(refresh_token)
    if outcome == "unavailable":
        raise AuthServiceUnavailable()
    if isinstance(outcome, str):
        raise RefreshExpired()
    user = account_view(outcome.identity, repository.get_profile(outcome.identity.id))
    return RefreshSessionResponse(user=user, session=AuthSession(**outcome.tokens.model_dump()))


def sign_out(access_token: str | None) -> None:
    """End the caller's session server-side, if they sent one. Never raises."""
    if access_token:
        repository_auth.revoke_sessions(access_token)


def me(principal: Principal) -> MeResponse:
    """The signed-in account, with client onboarding details for clients."""
    profile = repository.get_profile(principal.id) if principal.user_type == "client" else None
    return MeResponse(user=principal_view(principal, profile))
