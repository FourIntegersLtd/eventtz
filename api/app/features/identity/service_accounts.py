"""Pieces every identity use case shares: the `AuthUser` view and the process-wide rate limiter."""

from __future__ import annotations

from app.core.auth import Principal, principal_from
from app.core.settings import get_settings
from app.features.identity.domain_limits import Allowance, SlidingWindowLimiter, ip_key
from app.features.identity.models import AuthIdentity, UserProfileRow
from app.features.identity.schemas import AuthUser

# One limiter per API process (see `domain_limits` for why that is enough).
_limiter = SlidingWindowLimiter()


def is_rate_limited(
    bucket: str,
    *,
    account_key: str | None,
    client_ip: str | None,
    per_account: Allowance | None,
    per_ip: Allowance,
) -> bool:
    """True when this account (checked first) or this IP has used up its allowance in `bucket`.

    An attempt is counted only against keys that were still under their limit, like the baseline.
    """
    account_limited = (
        account_key is not None
        and per_account is not None
        and _limiter.hit(f"{bucket}:account:{account_key}", per_account)
    )
    if account_limited:
        return True
    return _limiter.hit(f"{bucket}:ip:{ip_key(client_ip)}", per_ip)


def _onboarding_fields(user_type: str, profile: UserProfileRow | None) -> tuple[str | None, bool | None]:
    """`(preferred_name, client_onboarding_completed)` for clients; `(None, None)` for everyone else."""
    if user_type != "client":
        return None, None
    if profile is None:
        return None, False
    preferred_name = (profile.preferred_name or "").strip() or None
    return preferred_name, bool(profile.client_onboarding_completed_at)


def principal_view(principal: Principal, profile: UserProfileRow | None) -> AuthUser:
    """The web app's view of an already-resolved caller (`/auth/me`)."""
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
        user_metadata=principal.user_metadata,
        app_metadata=principal.app_metadata,
    )


def to_principal(identity: AuthIdentity, profile: UserProfileRow | None) -> Principal:
    """Merge a Supabase Auth identity with its `users` row, the same way every request is resolved."""
    auth_user = {
        "id": identity.id,
        "email": identity.email,
        "user_metadata": identity.user_metadata,
        "app_metadata": identity.app_metadata,
    }
    profile_row = profile.model_dump() if profile else None
    return principal_from(auth_user, profile_row, get_settings().super_admin_emails_list)


def account_view(identity: AuthIdentity, profile: UserProfileRow | None) -> AuthUser:
    """The web app's view of an account straight after sign-in, sign-up, refresh or a password reset."""
    return principal_view(to_principal(identity, profile), profile)


def profile_only_view(profile: UserProfileRow) -> AuthUser:
    """The view of an account known only by its `users` row (after a verify-email link).

    There is no Supabase session here, so the metadata is empty and the type comes from the row.
    """
    typed_identity = AuthIdentity(
        id=profile.id, email=profile.email, app_metadata={"user_type": profile.user_type or "client"}
    )
    view = account_view(typed_identity, profile)
    return view.model_copy(update={"app_metadata": {}})
