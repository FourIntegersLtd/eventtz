"""User account helpers: optionally sync to public.users; build merged app user for API responses."""

from __future__ import annotations

from typing import Any

from app.contracts.auth import AuthUser
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db
from app.contracts.types import AdminRole, UserType
from app.features.auth import messages as auth_messages

logger = get_logger(__name__)

_VALID_USER_TYPES = frozenset({"client", "vendor", "admin"})


def normalize_email(email: str) -> str:
    return email.strip().lower()


def resolve_admin_role(profile: dict[str, Any] | None, email: str | None = None) -> AdminRole | str | None:
    """Which admin_role applies for this admin user."""
    if profile and profile.get("user_type") != "admin":
        return None
    if profile:
        role = profile.get("admin_role")
        if role in ("super_admin", "admin"):
            return str(role)
    em = (email or (profile or {}).get("email") or "").strip().lower()
    if em and em in get_settings().super_admin_emails_list:
        return "super_admin"
    if profile and profile.get("user_type") == "admin":
        return "admin"
    return None


def is_super_admin_user(user: AuthUser | dict[str, Any]) -> bool:
    if isinstance(user, AuthUser):
        user_type = user.user_type
        admin_role = user.admin_role
        email = user.email
    else:
        user_type = user.get("user_type")
        admin_role = user.get("admin_role")
        email = user.get("email")
    if user_type != "admin":
        return False
    if admin_role == "super_admin":
        return True
    em = str(email or "").strip().lower()
    return bool(em and em in get_settings().super_admin_emails_list)


def user_type_from_auth_metadatas(user: dict[str, Any]) -> str | None:
    """Role from the sign-in token's metadata.

    Prefer app_metadata over user_metadata so staff-set roles (app_metadata only)
    win over signup user_metadata, matching what Supabase stores server-side.
    """
    for key in ("app_metadata", "user_metadata"):
        meta = user.get(key)
        if isinstance(meta, dict):
            ut = meta.get("user_type")
            if ut in _VALID_USER_TYPES:
                return str(ut)
    return None


def upsert_user_profile(
    user_id: str,
    email: str | None,
    user_type: UserType | str,
    *,
    email_verified_at: str | None = None,
    clear_email_verified: bool = False,
) -> None:
    """Optional: copy role into public.users for database joins (explore/admin). Never raises."""
    if user_type not in ("client", "vendor", "admin"):
        logger.warning("upsert_user_profile skipped invalid user_type=%s", user_type)
        return
    row: dict[str, Any] = {"id": user_id, "user_type": user_type}
    if email is not None:
        row["email"] = email.strip().lower()
    if clear_email_verified:
        row["email_verified_at"] = None
    elif email_verified_at is not None:
        row["email_verified_at"] = email_verified_at
    try:
        get_db().table("users").upsert(row).execute()
        logger.info("upsert_user_profile user_id=%s user_type=%s", user_id, user_type)
    except Exception:
        logger.exception(
            "upsert_user_profile failed (optional mirror; run sql/009_disable_rls_public_users_vendors.sql if RLS) user_id=%s",
            user_id,
        )


def fetch_user_profile(user_id: str) -> dict[str, Any] | None:
    res = (
        get_db()
        .table("users")
        .select("id,email,user_type,admin_role,created_at,updated_at,account_suspended,email_verified_at")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None)
    if not data:
        return None
    return data[0] if isinstance(data, list) else data


def fetch_user_profile_by_email(email: str) -> dict[str, Any] | None:
    em = normalize_email(email)
    if not em:
        return None
    res = (
        get_db()
        .table("users")
        .select("id,email,user_type,admin_role,created_at,updated_at,account_suspended,email_verified_at")
        .eq("email", em)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None)
    if not data:
        return None
    return data[0] if isinstance(data, list) else data


def _metadata_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def build_app_user(auth_user: dict[str, Any]) -> AuthUser:
    """
    Build the canonical API user: auth identity (Supabase/local) plus app fields
    from public.users and client onboarding.

    - user_type: JWT metadata by default; public.users wins when set to admin.
    - account_suspended, admin_role, email_verified: from public.users.
    - preferred_name, client_onboarding_completed: clients only.
    """
    uid = auth_user.get("id")
    if not uid:
        return AuthUser(
            id="",
            email=auth_user.get("email"),
            user_metadata=_metadata_dict(auth_user.get("user_metadata")),
            app_metadata=_metadata_dict(auth_user.get("app_metadata")),
        )

    user_id = str(uid)
    email = auth_user.get("email")
    user_metadata = _metadata_dict(auth_user.get("user_metadata"))
    app_metadata = _metadata_dict(auth_user.get("app_metadata"))

    user_type = user_type_from_auth_metadatas(auth_user) or "client"
    db_profile = fetch_user_profile(user_id)
    account_suspended = False
    email_verified: bool | None = True
    admin_role: AdminRole | str | None = None
    preferred_name: str | None = None
    client_onboarding_completed: bool | None = None

    if db_profile and isinstance(db_profile, dict):
        db_type = db_profile.get("user_type")
        if db_type == "admin":
            user_type = "admin"
        account_suspended = bool(db_profile.get("account_suspended", False))
        if db_type == "admin":
            email_verified = True
        else:
            email_verified = bool(db_profile.get("email_verified_at"))
    else:
        email_verified = True

    if user_type == "client":
        from app.features.settings.client_onboarding import get_client_onboarding

        onboarding = get_client_onboarding(user_id)
        preferred_name = onboarding.get("preferred_name")
        client_onboarding_completed = bool(onboarding.get("completed", False))

    if user_type == "admin":
        admin_role = resolve_admin_role(
            db_profile if isinstance(db_profile, dict) else None,
            str(email or (db_profile or {}).get("email") or ""),
        )

    return AuthUser(
        id=user_id,
        email=email,
        user_type=user_type,
        admin_role=admin_role,
        account_suspended=account_suspended,
        email_verified=email_verified,
        preferred_name=preferred_name,
        client_onboarding_completed=client_onboarding_completed,
        user_metadata=user_metadata,
        app_metadata=app_metadata,
    )


def hydrate_user_from_db(auth_user: dict[str, Any]) -> AuthUser:
    """Deprecated alias for build_app_user."""
    return build_app_user(auth_user)


def assert_user_not_suspended(user_id: str) -> None:
    """Raise ValueError if the user exists in public.users and is suspended."""
    prof = fetch_user_profile(user_id)
    if prof and bool(prof.get("account_suspended")):
        raise ValueError(auth_messages.ACCOUNT_SUSPENDED)
