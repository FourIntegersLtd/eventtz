"""App user helpers: optional public.users sync + JWT-based role for /me (no required DB round-trip)."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.contracts.types import UserType

logger = get_logger(__name__)

_VALID_USER_TYPES = frozenset({"client", "vendor", "admin"})


def resolve_admin_role(profile: dict[str, Any] | None, email: str | None = None) -> str | None:
    """Effective admin_role for an admin user."""
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


def is_super_admin_user(user: dict[str, Any]) -> bool:
    if user.get("user_type") != "admin":
        return False
    if user.get("admin_role") == "super_admin":
        return True
    email = str(user.get("email") or "").strip().lower()
    return bool(email and email in get_settings().super_admin_emails_list)


def user_type_from_auth_metadatas(user: dict[str, Any]) -> str | None:
    """Role from Supabase Auth JWT metadata.

    Prefer app_metadata over user_metadata so staff-set roles (app_metadata only)
    win over signup user_metadata, and match Supabase's server-controlled claims.
    """
    for key in ("app_metadata", "user_metadata"):
        meta = user.get(key)
        if isinstance(meta, dict):
            ut = meta.get("user_type")
            if ut in _VALID_USER_TYPES:
                return str(ut)
    return None


def upsert_user_profile(user_id: str, email: str | None, user_type: UserType | str) -> None:
    """Optional: mirror role into public.users for SQL joins (explore/admin). Never raises."""
    if get_settings().local_auth_mode:
        return
    if user_type not in ("client", "vendor", "admin"):
        logger.warning("upsert_user_profile skipped invalid user_type=%s", user_type)
        return
    row: dict[str, Any] = {"id": user_id, "user_type": user_type}
    if email is not None:
        row["email"] = email.strip().lower()
    try:
        get_client().table("users").upsert(row).execute()
        logger.info("upsert_user_profile user_id=%s user_type=%s", user_id, user_type)
    except Exception:
        logger.exception(
            "upsert_user_profile failed (optional mirror; run sql/009_disable_rls_public_users_vendors.sql if RLS) user_id=%s",
            user_id,
        )


def fetch_user_profile(user_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    res = (
        get_client()
        .table("users")
        .select("id,email,user_type,admin_role,created_at,updated_at,account_suspended")
        .eq("id", user_id)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None)
    if not data:
        return None
    return data[0] if isinstance(data, list) else data


def fetch_user_profile_by_email(email: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    em = email.strip().lower()
    if not em:
        return None
    res = (
        get_client()
        .table("users")
        .select("id,email,user_type,admin_role,created_at,updated_at,account_suspended")
        .eq("email", em)
        .limit(1)
        .execute()
    )
    data = getattr(res, "data", None)
    if not data:
        return None
    return data[0] if isinstance(data, list) else data


def hydrate_user_from_db(auth_user: dict[str, Any]) -> dict[str, Any]:
    """
    Build the API-facing user dict: start from Supabase Auth (JWT/session), then overlay
    fields from public.users when available.

    - user_type: JWT metadata by default; public.users wins when set to admin (staff promotion
      may update the DB before Supabase app_metadata is synced).
    - account_suspended, admin_role: from public.users for admin accounts.
    """
    uid = auth_user.get("id")
    if not uid:
        return auth_user

    merged_user = {**auth_user}
    if get_settings().local_auth_mode:
        merged_user.setdefault("user_type", "client")
        merged_user.setdefault("account_suspended", False)
        return merged_user

    merged_user["user_type"] = user_type_from_auth_metadatas(merged_user) or "client"
    db_profile = fetch_user_profile(str(uid))
    if db_profile and isinstance(db_profile, dict):
        db_type = db_profile.get("user_type")
        if db_type == "admin":
            merged_user["user_type"] = "admin"
        merged_user["account_suspended"] = bool(db_profile.get("account_suspended", False))
    else:
        merged_user.setdefault("account_suspended", False)

    if merged_user.get("user_type") == "admin":
        merged_user["admin_role"] = resolve_admin_role(
            db_profile if isinstance(db_profile, dict) else None,
            str(merged_user.get("email") or (db_profile or {}).get("email") or ""),
        )

    return merged_user


def assert_user_not_suspended(user_id: str) -> None:
    """Raise ValueError if the user exists in public.users and is suspended."""
    if get_settings().local_auth_mode:
        return
    prof = fetch_user_profile(user_id)
    if prof and bool(prof.get("account_suspended")):
        raise ValueError("This account is suspended.")


merge_profile_into_user = hydrate_user_from_db
