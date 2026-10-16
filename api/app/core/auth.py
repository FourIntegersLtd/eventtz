"""Who is calling: `Authorization: Bearer <access token>` → `users` row → `Principal` (ADR 0003).

Copied in shape from OSCE `platform-api`: the API signs its own short-lived
HS256 access tokens, and accepts them only as a Bearer header — it sets no
cookies. Issuing tokens (sign-in, refresh) lives in the `identity` slice; this
module only mints and verifies them.

The token says only *who* the caller is. What they may do (account type, staff
role, suspended, closed) is read from their `users` row on every request, so a
suspension or a closed account bites on the very next request, like the
baseline. `core` cannot import `identity`, which owns that row, so the two meet
at a seam: `identity` binds the lookup (`bind_account_lookup`) in
`app.main.create_app`, and the dependencies here call it.

Routers declare exactly one of `AnyAccount`, `CurrentUser`, `CurrentClient`,
`CurrentVendor`, `CurrentStaff`, `CurrentSuperAdmin` or `OptionalUser`. Tests
replace `resolve_principal` through `app.dependency_overrides`, never by patching.

Refusal messages are copied verbatim from the baseline API so the web app's
copy does not change.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any, Literal

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import SessionDep
from app.core.errors import Forbidden, Unauthenticated
from app.core.logging import get_logger
from app.core.observability import bind_sentry_user
from app.core.settings import Settings, get_settings

log = get_logger(__name__)

ACCESS_TOKEN_TYPE = "access"  # noqa: S105 — the token's type claim, not a secret

# The three account types. Staff are `admin`; `admin_role` says whether they are super admins.
UserType = Literal["client", "vendor", "admin"]
_USER_TYPES: frozenset[str] = frozenset({"client", "vendor", "admin"})

# User-facing refusal copy (verbatim from `backend/app/features/auth/messages.py`).
SIGN_IN_REQUIRED = "Please sign in to continue."
SESSION_EXPIRED = "Session expired. Please sign in again."
ACCOUNT_DELETED = "This account has been deleted."
ACCOUNT_SUSPENDED_CONTACT = "Your account has been suspended. Contact support if you think this is a mistake."
ADMIN_ACCOUNT_SUSPENDED = "Your admin account is suspended. Contact a super admin."
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
SUPER_ADMIN_ONLY = "Only super admins can perform this action."
VENDOR_PORTAL_FORBIDDEN = (
    "This page is for vendor accounts. "
    "If you offer services on Eventtz, create a vendor account or sign out and sign in again "
    "so we can refresh your account type. "
    "If you're planning an event, use client sign-in instead."
)
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. "
    "Sign in with a client account, or create one from the homepage."
)


class SessionExpired(Unauthenticated):
    """The token is not even shaped like one; the web app sends the user to sign in."""

    code = "session_expired"
    default_message = SESSION_EXPIRED


class AccountDeleted(Unauthenticated):
    """The account was closed (`users.deleted_at` set); closed accounts are tombstones."""

    code = "account_deleted"
    default_message = ACCOUNT_DELETED


class AccountSuspended(Forbidden):
    """Staff suspended this account; it can sign in but cannot use the product."""

    code = "account_suspended"
    default_message = ACCOUNT_SUSPENDED_CONTACT


class WrongPortal(Forbidden):
    """Signed in, but as the wrong account type for this route (e.g. a vendor on a client route)."""

    code = "wrong_portal"


class SuperAdminOnly(Forbidden):
    """A staff action that only super admins may take."""

    code = "super_admin_only"
    default_message = SUPER_ADMIN_ONLY


@dataclass(frozen=True)
class Principal:
    """The signed-in caller, as every service sees them. Built by `principal_from`."""

    id: str
    email: str | None
    user_type: UserType
    admin_role: str | None = None
    account_suspended: bool = False
    email_verified: bool = True
    deleted: bool = False

    @property
    def is_super_admin(self) -> bool:
        """True for staff whose role is `super_admin`."""
        return self.user_type == "admin" and self.admin_role == "super_admin"


@dataclass(frozen=True)
class AccountRecord:
    """The columns of a `users` row that decide what its owner may do."""

    id: str
    email: str | None
    user_type: str | None
    admin_role: str | None
    account_suspended: bool
    email_verified: bool
    deleted: bool


def principal_from(account: AccountRecord, super_admin_emails: list[str]) -> Principal:
    """Turn a `users` row into the `Principal` services see. Pure.

    An unknown or missing `user_type` counts as a client, like the baseline.
    Staff are always treated as verified. Staff without a stored role are super
    admins when their email is in `SUPER_ADMIN_EMAILS`, plain admins otherwise.
    """
    user_type: UserType = account.user_type if account.user_type in _USER_TYPES else "client"  # type: ignore[assignment]
    admin_role: str | None = None
    if user_type == "admin":
        known_email = (account.email or "").strip().lower()
        if account.admin_role in ("super_admin", "admin"):
            admin_role = account.admin_role
        elif known_email and known_email in super_admin_emails:
            admin_role = "super_admin"
        else:
            admin_role = "admin"
    return Principal(
        id=account.id,
        email=account.email,
        user_type=user_type,
        admin_role=admin_role,
        account_suspended=account.account_suspended,
        email_verified=user_type == "admin" or account.email_verified,
        deleted=account.deleted,
    )


# --- tokens ---------------------------------------------------------------------------------------


@dataclass(frozen=True)
class AccessClaims:
    """What a verified access token says: who, and until when."""

    user_id: str
    email: str | None
    expires_at: int


def issue_access_token(
    *, user_id: str, email: str | None, settings: Settings, now: datetime | None = None
) -> str:
    """Sign a short-lived JWT naming this user."""
    issued_at = now or datetime.now(UTC)
    claims: dict[str, Any] = {
        "iss": settings.jwt_issuer,
        "sub": user_id,
        "typ": ACCESS_TOKEN_TYPE,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(seconds=settings.jwt_access_ttl_seconds)).timestamp()),
        "email": email,
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def looks_like_jwt(token: str) -> bool:
    """Cheap shape check (three dot-separated parts, no spaces) before verifying the signature."""
    return token.count(".") == 2 and " " not in token


def decode_access_token(token: str, *, settings: Settings) -> AccessClaims | None:
    """Verify the signature, issuer, expiry and type; `None` when any check fails."""
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError:
        return None
    if claims.get("typ") != ACCESS_TOKEN_TYPE or not isinstance(claims.get("sub"), str):
        return None
    email = claims.get("email")
    return AccessClaims(
        user_id=claims["sub"], email=email if isinstance(email, str) else None, expires_at=int(claims["exp"])
    )


# --- stream tickets (ADR 0005) ---------------------------------------------------------------------

STREAM_TICKET_TYPE = "stream"  # noqa: S105 — the token's type claim, not a secret


@dataclass(frozen=True)
class StreamClaims:
    """What a verified stream ticket says: whose topics the SSE route may subscribe to."""

    user_id: str
    expires_at: int


def issue_stream_ticket(*, user_id: str, settings: Settings, now: datetime | None = None) -> str:
    """Sign a short-lived ticket naming `user_id`, good for `settings.stream_ticket_ttl_seconds`.

    `EventSource` cannot send an `Authorization` header, so the stream reads
    this from a query parameter instead of a Bearer token. Its own `typ` and
    short lifetime keep it from working as a substitute access token if it
    leaks into browser history or a proxy access log.
    """
    issued_at = now or datetime.now(UTC)
    claims: dict[str, Any] = {
        "iss": settings.jwt_issuer,
        "sub": user_id,
        "typ": STREAM_TICKET_TYPE,
        "iat": int(issued_at.timestamp()),
        "exp": int((issued_at + timedelta(seconds=settings.stream_ticket_ttl_seconds)).timestamp()),
    }
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256")


def decode_stream_ticket(token: str, *, settings: Settings) -> StreamClaims | None:
    """Verify the signature, issuer, expiry and `typ`; `None` when any check fails."""
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "iat", "sub"]},
        )
    except jwt.PyJWTError:
        return None
    if claims.get("typ") != STREAM_TICKET_TYPE or not isinstance(claims.get("sub"), str):
        return None
    return StreamClaims(user_id=claims["sub"], expires_at=int(claims["exp"]))


# --- the account-lookup seam ----------------------------------------------------------------------

AccountLookup = Callable[[AsyncSession, str], Awaitable[AccountRecord | None]]

_account_lookup: list[AccountLookup] = []


def bind_account_lookup(lookup: AccountLookup) -> None:
    """Bound by `app.main.create_app` to `identity`'s `users` row lookup."""
    _account_lookup.clear()
    _account_lookup.append(lookup)


async def _lookup_account(session: AsyncSession, user_id: str) -> AccountRecord | None:
    """The caller's `users` row, through the bound seam. Refuses to run unbound."""
    if not _account_lookup:
        raise RuntimeError("No account lookup bound. app.main.create_app must call bind_account_lookup.")
    return await _account_lookup[0](session, user_id)


# --- the dependencies routers declare -------------------------------------------------------------

_bearer = HTTPBearer(auto_error=False)
BearerCredentials = Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]


async def _bearer_principal(
    credentials: HTTPAuthorizationCredentials | None, session: AsyncSession, *, strict: bool
) -> Principal | None:
    """Resolve the Bearer token to a `Principal`.

    `strict=True` raises the matching `AppError` for every failure (for routes that
    need a user); `strict=False` returns `None` instead (for routes that work
    anonymously).
    """
    token = credentials.credentials if credentials else ""
    if not token:
        if strict:
            raise Unauthenticated(SIGN_IN_REQUIRED)
        return None
    if not looks_like_jwt(token):
        if strict:
            raise SessionExpired()
        return None
    claims = decode_access_token(token, settings=get_settings())
    account = await _lookup_account(session, claims.user_id) if claims else None
    if account is None:
        if strict:
            raise Unauthenticated(SIGN_IN_REQUIRED)
        return None
    principal = principal_from(account, get_settings().super_admin_emails_list)
    if principal.deleted:
        if strict:
            raise AccountDeleted()
        return None
    return principal


async def resolve_principal(credentials: BearerCredentials, session: SessionDep) -> Principal:
    """The signed-in caller, or an `Unauthenticated` error. Tests override this."""
    principal = await _bearer_principal(credentials, session, strict=True)
    assert principal is not None  # strict mode raises instead of returning None
    return principal


async def optional_principal(credentials: BearerCredentials, session: SessionDep) -> Principal | None:
    """Signed-in user if the token is valid, else anonymous. Never raises for a bad token."""
    return await _bearer_principal(credentials, session, strict=False)


def require_user(principal: Annotated[Principal, Depends(resolve_principal)]) -> Principal:
    """Any signed-in account; suspended clients and vendors are refused."""
    if principal.account_suspended and principal.user_type in ("client", "vendor"):
        raise AccountSuspended()
    bind_sentry_user(user_id=principal.id, user_type=principal.user_type)
    return principal


def _require_type(principal: Principal, user_type: UserType, message: str) -> Principal:
    """Refuse with `WrongPortal(message)` unless the caller is of `user_type`."""
    if principal.user_type != user_type:
        log.warning(
            "auth: denied user_id=%s expected=%s actual=%s", principal.id, user_type, principal.user_type
        )
        raise WrongPortal(message)
    return principal


def require_client(principal: Annotated[Principal, Depends(require_user)]) -> Principal:
    """A signed-in client account."""
    return _require_type(principal, "client", CLIENT_PORTAL_FORBIDDEN)


def require_vendor(principal: Annotated[Principal, Depends(require_user)]) -> Principal:
    """A signed-in vendor account."""
    return _require_type(principal, "vendor", VENDOR_PORTAL_FORBIDDEN)


def require_staff(principal: Annotated[Principal, Depends(require_user)]) -> Principal:
    """A signed-in, unsuspended staff (admin) account."""
    _require_type(principal, "admin", ADMIN_PORTAL_FORBIDDEN)
    if principal.account_suspended:
        raise AccountSuspended(ADMIN_ACCOUNT_SUSPENDED)
    return principal


def require_super_admin(principal: Annotated[Principal, Depends(require_staff)]) -> Principal:
    """A staff account with the `super_admin` role."""
    if not principal.is_super_admin:
        raise SuperAdminOnly()
    return principal


# What routers declare as a parameter type, e.g. `def list_mine(vendor: CurrentVendor)`.
# `AnyAccount` is any live session, suspended or not: only for sign-out and password changes.
AnyAccount = Annotated[Principal, Depends(resolve_principal)]
CurrentUser = Annotated[Principal, Depends(require_user)]
CurrentClient = Annotated[Principal, Depends(require_client)]
CurrentVendor = Annotated[Principal, Depends(require_vendor)]
CurrentStaff = Annotated[Principal, Depends(require_staff)]
CurrentSuperAdmin = Annotated[Principal, Depends(require_super_admin)]
OptionalUser = Annotated[Principal | None, Depends(optional_principal)]

# Errors each dependency can raise, for `error_responses(...)` on a route.
AUTH_ERRORS = (Unauthenticated,)
ROLE_ERRORS = (*AUTH_ERRORS, Forbidden)
