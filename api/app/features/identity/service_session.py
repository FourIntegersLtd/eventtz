"""Sessions: sign in, refresh, sign out, and who am I (flow copied from OSCE `service_sessions.py`).

A session is a short-lived access token (sent as `Authorization: Bearer`) plus
a 30-day refresh token. Only the refresh token's SHA-256 is stored, as one link
in its sign-in's chain; exchanging it spends it, and presenting a spent one
again revokes the whole chain.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal, issue_access_token
from app.core.errors import AppError
from app.core.logging import get_logger
from app.core.settings import get_settings
from app.features.identity import repository
from app.features.identity.domain_accounts import hash_token, needs_email_verification, normalise_email
from app.features.identity.domain_sessions import RefreshChainState, use_refresh_token
from app.features.identity.errors import (
    DeletedAtSignIn,
    EmailNotVerified,
    RefreshExpired,
    RefreshTokenReused,
    SuspendedAtSignIn,
    TooManySignIns,
    WrongCredentials,
)
from app.features.identity.rows import UserProfileRow
from app.features.identity.schemas import (
    AuthSession,
    MeResponse,
    RefreshSessionResponse,
    SignInRequest,
    SignInResponse,
)
from app.features.identity.service_accounts import (
    SIGN_IN_PER_EMAIL,
    SIGN_IN_PER_IP,
    account_view,
    is_rate_limited,
    principal_view,
)
from app.features.identity.tokens import (
    hash_password,
    needs_rehash,
    new_refresh_token,
    verify_absent_password,
    verify_password,
)

log = get_logger(__name__)


def _session_tokens(*, user_id: str, email: str | None, raw_refresh_token: str, now: datetime) -> AuthSession:
    """A fresh access token next to the given refresh token; `expires_at` is the access token's expiry."""
    settings = get_settings()
    return AuthSession(
        access_token=issue_access_token(user_id=user_id, email=email, settings=settings, now=now),
        refresh_token=raw_refresh_token,
        expires_at=int((now + timedelta(seconds=settings.jwt_access_ttl_seconds)).timestamp()),
    )


async def issue_session(
    session: AsyncSession, *, user_id: str, email: str | None, now: datetime
) -> AuthSession:
    """Start a new sign-in: an access token and the first refresh token of a fresh chain."""
    raw_refresh_token, refresh_token_hash = new_refresh_token()
    await repository.create_refresh_chain(
        session,
        user_id=user_id,
        token_hash=refresh_token_hash,
        expires_at=now + timedelta(seconds=get_settings().jwt_refresh_ttl_seconds),
    )
    return _session_tokens(user_id=user_id, email=email, raw_refresh_token=raw_refresh_token, now=now)


def _sign_in_refusal(profile: UserProfileRow) -> AppError | None:
    """Why this account may not start a session, checked in the baseline's order."""
    if profile.account_suspended:
        return SuspendedAtSignIn()
    if profile.deleted_at:
        return DeletedAtSignIn()
    if profile.user_type in ("client", "vendor") and needs_email_verification(
        user_type=profile.user_type, profile_exists=True, verified_at=profile.email_verified_at
    ):
        return EmailNotVerified()
    return None


async def sign_in(session: AsyncSession, body: SignInRequest, *, caller: str) -> SignInResponse:
    """Check the password, then refuse suspended, closed or unverified accounts.

    An unknown address and a wrong password get the same error and take the
    same time. The account state is checked only after the password, so the
    refusals never tell a stranger which state an account is in.
    """
    email = normalise_email(body.email)
    if await is_rate_limited(
        account_key=email, per_account=SIGN_IN_PER_EMAIL, caller=caller, per_ip=SIGN_IN_PER_IP
    ):
        raise TooManySignIns()
    credentials = await repository.find_credentials_by_email(session, email)
    if credentials is None:
        verify_absent_password(body.password)
        raise WrongCredentials()
    if not verify_password(credentials.password_hash, body.password):
        raise WrongCredentials()
    if credentials.password_hash and needs_rehash(credentials.password_hash):
        # An imported Supabase bcrypt hash becomes argon2 at its first sign-in (ADR 0003).
        await repository.set_password_hash(session, credentials.id, hash_password(body.password))
    profile = await repository.get_profile(session, credentials.id)
    if profile is None:
        raise WrongCredentials()
    refusal = _sign_in_refusal(profile)
    if refusal is not None:
        log.info("sign-in refused user_id=%s reason=%s", profile.id, type(refusal).__name__)
        raise refusal
    tokens = await issue_session(session, user_id=profile.id, email=profile.email, now=datetime.now(UTC))
    return SignInResponse(user=account_view(profile), session=tokens)


async def refresh(session: AsyncSession, refresh_token: str | None) -> RefreshSessionResponse:
    """Swap a refresh token for a new pair, rotating the chain.

    Raises `RefreshExpired` for a missing, unknown, revoked or expired token,
    and `RefreshTokenReused` (after revoking the chain) for one already spent.
    """
    if not refresh_token:
        raise RefreshExpired()
    now = datetime.now(UTC)
    token = await repository.refresh_token_by_hash(session, hash_token(refresh_token))
    chain = await repository.refresh_chain_by_id(session, token.chain_id) if token is not None else None
    if token is None or chain is None:
        raise RefreshExpired()
    decision = use_refresh_token(
        RefreshChainState(expires_at=chain.expires_at, revoked_at=chain.revoked_at),
        token_already_spent=token.used_at is not None,
        now=now,
    )
    if not decision.accepted:
        if decision.revoke_chain:
            await repository.revoke_refresh_chain(session, chain_id=chain.id, at=now, reason="reuse_detected")
            log.warning("refresh token reused; chain revoked user_id=%s", chain.user_id)
            raise RefreshTokenReused()
        raise RefreshExpired()
    profile = await repository.get_profile(session, chain.user_id)
    if profile is None or profile.deleted_at:
        raise RefreshExpired()
    raw_refresh_token, refresh_token_hash = new_refresh_token()
    rotated = await repository.spend_and_issue(
        session, token_id=token.id, chain_id=chain.id, token_hash=refresh_token_hash, at=now
    )
    if not rotated:
        # Another request spent this token between the read and the write: the same reuse.
        await repository.revoke_refresh_chain(session, chain_id=chain.id, at=now, reason="reuse_detected")
        raise RefreshTokenReused()
    tokens = _session_tokens(
        user_id=profile.id, email=profile.email, raw_refresh_token=raw_refresh_token, now=now
    )
    return RefreshSessionResponse(user=account_view(profile), session=tokens)


async def sign_out(session: AsyncSession, *, principal: Principal | None, refresh_token: str | None) -> None:
    """End the presented sign-in, or every sign-in of the caller when none is named. Never raises.

    Holding a refresh token is proof enough to end its own chain, so a caller
    whose access token has lapsed can still sign out. A signed-in caller
    presenting someone else's token ends only their own sessions.
    """
    now = datetime.now(UTC)
    if refresh_token:
        token = await repository.refresh_token_by_hash(session, hash_token(refresh_token))
        chain = await repository.refresh_chain_by_id(session, token.chain_id) if token is not None else None
        if chain is not None and (principal is None or chain.user_id == principal.id):
            await repository.revoke_refresh_chain(session, chain_id=chain.id, at=now, reason="sign_out")
            return
    if principal is not None:
        await repository.revoke_all_chains_for_user(session, user_id=principal.id, at=now, reason="sign_out")


async def me(session: AsyncSession, principal: Principal) -> MeResponse:
    """The signed-in account, with client onboarding details for clients."""
    profile = await repository.get_profile(session, principal.id)
    return MeResponse(user=principal_view(principal, profile))
