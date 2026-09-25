"""Who is calling: session cookie → Supabase Auth user → `Principal` (ADR 0003).

Routers declare exactly one of `CurrentUser`, `CurrentClient`, `CurrentVendor`,
`CurrentStaff`, `CurrentSuperAdmin` or `OptionalUser`. Tests replace
`resolve_principal` through `app.dependency_overrides`, never by patching.

Refusal messages are copied verbatim from the baseline API so the web app's
copy does not change.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Any, Literal

from fastapi import Depends, Request, Response
from supabase_auth.errors import AuthApiError

from app.core import db
from app.core.errors import Forbidden, Unauthenticated, Unavailable
from app.core.logging import get_logger
from app.core.settings import get_settings

log = get_logger(__name__)

# Session cookies, same names and lifetimes as the baseline so existing sessions keep working.
ACCESS_COOKIE = "eventtz_access_token"
REFRESH_COOKIE = "eventtz_refresh_token"
ACCESS_MAX_AGE = 60 * 60
REFRESH_MAX_AGE = 60 * 60 * 24 * 14

# The three account types. Staff are `admin`; `admin_role` says whether they are super admins.
UserType = Literal["client", "vendor", "admin"]
_USER_TYPES: frozenset[str] = frozenset({"client", "vendor", "admin"})

# User-facing refusal copy (verbatim from `backend/app/features/auth/messages.py`).
SIGN_IN_REQUIRED = "Please sign in to continue."
SESSION_EXPIRED = "Session expired. Please sign in again."
AUTH_SERVICE_UNAVAILABLE = "Authentication is temporarily unavailable. Please try again."
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
    """The cookie is malformed or the session was revoked; the web app sends the user to sign in."""

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


class AuthUnavailable(Unavailable):
    """Supabase Auth did not answer, so we cannot tell who is calling."""

    code = "auth_unavailable"
    default_message = AUTH_SERVICE_UNAVAILABLE


@dataclass(frozen=True)
class Principal:
    """The signed-in caller, as every service sees them.

    Built from the Supabase Auth user plus the `public.users` row by `principal_from`.
    """

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


def _metadata_user_type(auth_user: dict[str, Any]) -> str | None:
    """`app_metadata` (staff-set) wins over `user_metadata` (set at signup)."""
    for key in ("app_metadata", "user_metadata"):
        metadata = auth_user.get(key)
        if isinstance(metadata, dict) and metadata.get("user_type") in _USER_TYPES:
            return str(metadata["user_type"])
    return None


def principal_from(
    auth_user: dict[str, Any], profile: dict[str, Any] | None, super_admin_emails: list[str]
) -> Principal:
    """Merge the Supabase Auth user with its `public.users` row. Pure."""
    email = auth_user.get("email")
    user_type = _metadata_user_type(auth_user) or "client"
    admin_role: str | None = None
    suspended = False
    verified = True
    if profile:
        if profile.get("user_type") == "admin":
            user_type = "admin"
        suspended = bool(profile.get("account_suspended"))
        verified = user_type == "admin" or bool(profile.get("email_verified_at"))
    if user_type == "admin":
        role = (profile or {}).get("admin_role")
        known_email = str(email or (profile or {}).get("email") or "").strip().lower()
        if role in ("super_admin", "admin"):
            admin_role = str(role)
        elif known_email and known_email in super_admin_emails:
            admin_role = "super_admin"
        else:
            admin_role = "admin"
    return Principal(
        id=str(auth_user["id"]),
        email=email,
        user_type=user_type,  # type: ignore[arg-type]
        admin_role=admin_role,
        account_suspended=suspended,
        email_verified=verified,
        deleted=bool((profile or {}).get("deleted_at")),
    )


def cookie_options() -> dict[str, Any]:
    """Cross-site in production (web and API on different hosts) needs SameSite=None + Secure."""
    if get_settings().is_production:
        return {"httponly": True, "secure": True, "samesite": "none", "path": "/"}
    return {"httponly": True, "secure": False, "samesite": "lax", "path": "/"}


def set_session_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Store a new Supabase session on the response as the two httpOnly cookies."""
    response.set_cookie(ACCESS_COOKIE, access_token, max_age=ACCESS_MAX_AGE, **cookie_options())
    response.set_cookie(REFRESH_COOKIE, refresh_token, max_age=REFRESH_MAX_AGE, **cookie_options())


def clear_session_cookies(response: Response) -> None:
    """Delete both session cookies; attributes must match the ones they were set with."""
    options = cookie_options()
    for cookie_name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(cookie_name, path="/", secure=options["secure"], samesite=options["samesite"])


def _looks_like_jwt(token: str) -> bool:
    """Cheap shape check (three dot-separated parts) before spending a network call on the token."""
    return token.count(".") == 2 and " " not in token


def _auth_user(access_token: str) -> dict[str, Any] | None:
    """The Supabase Auth user for a token, `None` if refused. Raises `AuthUnavailable` on outage."""
    try:
        response = db.auth_client().auth.get_user(access_token)
        user = response.user if response else None
    except AuthApiError:
        return None
    except Exception as exc:
        if db.is_upstream_unavailable(exc):
            log.warning("auth: Supabase Auth did not answer")
            raise AuthUnavailable() from exc
        log.exception("auth: token lookup failed")
        return None
    if user is None:
        return None
    return {
        "id": str(user.id),
        "email": user.email,
        "user_metadata": user.user_metadata or {},
        "app_metadata": user.app_metadata or {},
    }


def _profile(user_id: str) -> dict[str, Any] | None:
    """The caller's `public.users` row (type, role, status flags), or `None` if missing or unreadable."""
    try:
        return db.first(
            db.service_client()
            .table("users")
            .select("id,email,user_type,admin_role,account_suspended,email_verified_at,deleted_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
    except Exception:
        log.warning("auth: profile lookup failed user_id=%s", user_id)
        return None


def _session_principal(request: Request, response: Response, *, strict: bool) -> Principal | None:
    """Resolve the access cookie to a `Principal`.

    `strict=True` raises the matching `AppError` for every failure (for routes that
    need a user); `strict=False` returns `None` instead (for routes that work
    anonymously). A bad or dead session also clears the cookies either way.
    """
    token = request.cookies.get(ACCESS_COOKIE)
    if not token:
        if strict:
            raise Unauthenticated(SIGN_IN_REQUIRED)
        return None
    if not _looks_like_jwt(token):
        clear_session_cookies(response)
        if strict:
            raise SessionExpired()
        return None
    try:
        auth_user = _auth_user(token)
    except AuthUnavailable:
        if strict:
            raise
        return None
    if auth_user is None:
        clear_session_cookies(response)
        if strict:
            raise Unauthenticated(SIGN_IN_REQUIRED)
        return None
    principal = principal_from(auth_user, _profile(auth_user["id"]), get_settings().super_admin_emails_list)
    if principal.deleted:
        clear_session_cookies(response)
        if strict:
            raise AccountDeleted()
        return None
    return principal


def resolve_principal(request: Request, response: Response) -> Principal:
    """The signed-in caller, or an `Unauthenticated`/`AuthUnavailable` error. Tests override this."""
    principal = _session_principal(request, response, strict=True)
    assert principal is not None  # strict mode raises instead of returning None
    return principal


def optional_principal(request: Request, response: Response) -> Principal | None:
    """Signed-in user if the session is valid, else anonymous. Never raises for a bad session."""
    return _session_principal(request, response, strict=False)


def require_user(principal: Annotated[Principal, Depends(resolve_principal)]) -> Principal:
    """Any signed-in account; suspended clients and vendors are refused."""
    if principal.account_suspended and principal.user_type in ("client", "vendor"):
        raise AccountSuspended()
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
CurrentUser = Annotated[Principal, Depends(require_user)]
CurrentClient = Annotated[Principal, Depends(require_client)]
CurrentVendor = Annotated[Principal, Depends(require_vendor)]
CurrentStaff = Annotated[Principal, Depends(require_staff)]
CurrentSuperAdmin = Annotated[Principal, Depends(require_super_admin)]
OptionalUser = Annotated[Principal | None, Depends(optional_principal)]

# Errors each dependency can raise, for `error_responses(...)` on a route.
AUTH_ERRORS = (Unauthenticated, AuthUnavailable)
ROLE_ERRORS = (*AUTH_ERRORS, Forbidden)
