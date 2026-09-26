"""Pieces every identity use case shares: rate limits, the `AuthUser` view and the account lookup."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import AccountRecord, Principal, principal_from
from app.core.rate_limit import Limit, is_over_limit
from app.core.settings import get_settings
from app.features.identity import repository
from app.features.identity.rows import UserProfileRow
from app.features.identity.schemas import AuthUser

# The baseline's allowances, per email (or user) and per caller address. Counted
# in Redis (`core.rate_limit`), so every API process shares them. The routes an
# attacker would use to guess a password or a link fail closed when Redis errors.
_FIFTEEN_MINUTES = 15 * 60
_ONE_HOUR = 60 * 60
SIGN_IN_PER_EMAIL = Limit("sign-in:email", allowance=10, window_seconds=_FIFTEEN_MINUTES, fail_closed=True)
SIGN_IN_PER_IP = Limit("sign-in:ip", allowance=40, window_seconds=_FIFTEEN_MINUTES, fail_closed=True)
CHANGE_PASSWORD_PER_USER = Limit(
    "change-password:user", allowance=10, window_seconds=_ONE_HOUR, fail_closed=True
)
CHANGE_PASSWORD_PER_IP = Limit("change-password:ip", allowance=30, window_seconds=_ONE_HOUR, fail_closed=True)
# Sign-up and resend share the verification-email allowance.
VERIFICATION_EMAILS_PER_ADDRESS = Limit("verification-email:address", allowance=5, window_seconds=_ONE_HOUR)
VERIFICATION_EMAILS_PER_IP = Limit("verification-email:ip", allowance=20, window_seconds=_ONE_HOUR)
RESET_EMAILS_PER_ADDRESS = Limit("forgot-password:address", allowance=5, window_seconds=_ONE_HOUR)
RESET_EMAILS_PER_IP = Limit("forgot-password:ip", allowance=20, window_seconds=_ONE_HOUR)
VERIFY_LINK_CLICKS_PER_IP = Limit("verify-link:ip", allowance=30, window_seconds=_ONE_HOUR)
RESET_LINK_CLICKS_PER_IP = Limit("reset-link:ip", allowance=30, window_seconds=_ONE_HOUR, fail_closed=True)


async def is_rate_limited(
    *, account_key: str | None, per_account: Limit | None, caller: str, per_ip: Limit
) -> bool:
    """True when this account (checked first) or this caller address has used up its allowance."""
    if account_key and per_account is not None and await is_over_limit(per_account, account_key):
        return True
    return await is_over_limit(per_ip, caller)


def account_record(profile: UserProfileRow) -> AccountRecord:
    """The columns of a profile row that decide what its owner may do."""
    return AccountRecord(
        id=profile.id,
        email=profile.email,
        user_type=profile.user_type,
        admin_role=profile.admin_role,
        account_suspended=bool(profile.account_suspended),
        email_verified=bool(profile.email_verified_at),
        deleted=bool(profile.deleted_at),
    )


async def lookup_account(session: AsyncSession, user_id: str) -> AccountRecord | None:
    """The caller's account for `core.auth`, bound in `app.main.create_app`. `None` when there is no row."""
    profile = await repository.get_profile(session, user_id)
    return account_record(profile) if profile is not None else None


def _onboarding_fields(user_type: str, profile: UserProfileRow | None) -> tuple[str | None, bool | None]:
    """`(preferred_name, client_onboarding_completed)` for clients; `(None, None)` for everyone else."""
    if user_type != "client":
        return None, None
    if profile is None:
        return None, False
    preferred_name = (profile.preferred_name or "").strip() or None
    return preferred_name, bool(profile.client_onboarding_completed_at)


def principal_view(principal: Principal, profile: UserProfileRow | None) -> AuthUser:
    """The web app's view of an already-resolved caller (`/auth/me`).

    `user_metadata`/`app_metadata` stay in the contract but are always empty:
    they were Supabase Auth's, and every field the web app read from them is a
    top-level field here.
    """
    preferred_name, onboarding_completed = _onboarding_fields(principal.user_type, profile)
    return AuthUser(
        id=principal.id,
        email=principal.email,
        user_type=principal.user_type,
        admin_role=principal.admin_role,
        account_suspended=principal.account_suspended,
        email_verified=principal.email_verified,
        preferred_name=preferred_name,
        client_onboarding_completed=onboarding_completed,
    )


def account_view(profile: UserProfileRow) -> AuthUser:
    """The web app's view of an account straight from its `users` row (sign-in, sign-up, links)."""
    principal = principal_from(account_record(profile), get_settings().super_admin_emails_list)
    return principal_view(principal, profile)
