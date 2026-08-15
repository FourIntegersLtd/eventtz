"""Admin team listing, invites, and keeping Supabase roles in sync."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Literal

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db
from app.features.admin.messages import (
    ADMIN_ACCOUNT_DELETED,
    ADMIN_ALREADY_PASSWORD_UPDATED,
    ADMIN_CREATED,
    ADMIN_CREATED_PASSWORD_LINK,
    ADMIN_REMOVED_REMAINS_CLIENT,
    ADMIN_REMOVED_REMAINS_VENDOR,
    ADMIN_USER_NO_EMAIL,
    ADMIN_USER_NOT_FOUND,
    ASSIGNEE_ADMIN_SUSPENDED,
    ASSIGNEE_MUST_BE_ADMIN,
    CANNOT_DELETE_LAST_SUPER_ADMIN,
    CANNOT_DELETE_SELF,
    CANNOT_DEMOTE_LAST_SUPER_ADMIN,
    CANNOT_DEMOTE_SELF,
    CANNOT_SUSPEND_SELF,
    COULD_NOT_CREATE_ADMIN,
    COULD_NOT_DELETE_ADMIN,
    COULD_NOT_SET_PASSWORD,
    INVALID_EMAIL_ADDRESS,
    ONLY_SUPER_ADMIN_CHANGE_TEAM,
    ONLY_SUPER_ADMIN_DELETE_TEAM,
    ONLY_SUPER_ADMIN_RESET_LINK,
    PASSWORD_RESET_LINK_SENT,
    PASSWORD_SETUP_LINK_SENT,
    PROMOTED_ADMIN_PASSWORD_LINK,
    PROMOTED_TO_ADMIN,
)
from app.features.auth.accounts import (
    fetch_user_profile,
    fetch_user_profile_by_email,
    is_super_admin_user,
    resolve_admin_role,
)
from app.features.auth.password_policy import validate_admin_password
from app.features.auth.password_reset import request_password_reset
from app.features.auth.session_invalidation import invalidate_all_sessions
from app.features.email.dispatch import send_admin_welcome_email, send_team_invite_email

logger = get_logger(__name__)

AdminRole = Literal["super_admin", "admin"]


def assert_active_admin_assignee(user_id: str | None) -> None:
    if not user_id:
        return
    prof = fetch_user_profile(user_id)
    if not prof or prof.get("user_type") != "admin":
        raise ValueError(ASSIGNEE_MUST_BE_ADMIN)
    if bool(prof.get("account_suspended")):
        raise ValueError(ASSIGNEE_ADMIN_SUSPENDED)


def _sync_supabase_admin_metadata(user_id: str, *, admin_role: AdminRole | None = None, user_type: str = "admin") -> None:
    try:
        payload: dict[str, Any] = {
            "app_metadata": {"user_type": user_type},
            "user_metadata": {"user_type": user_type},
        }
        if user_type == "admin" and admin_role:
            payload["app_metadata"]["admin_role"] = admin_role
        elif user_type != "admin":
            payload["app_metadata"]["admin_role"] = None
        get_db().auth.admin.update_user_by_id(user_id, payload)
    except Exception as e:
        logger.warning("_sync_supabase_admin_metadata failed user_id=%s: %s", user_id, e)


def _set_supabase_password(user_id: str, password: str) -> None:
    try:
        get_db().auth.admin.update_user_by_id(user_id, {"password": password})
    except Exception as e:
        logger.warning("_set_supabase_password failed user_id=%s: %s", user_id, e)
        raise ValueError(COULD_NOT_SET_PASSWORD) from e


def _random_admin_password() -> str:
    """Temporary password for invite-link onboarding (user sets their own via reset link)."""
    return f"Tmp{secrets.token_urlsafe(16)}1A"


def list_admin_team() -> list[dict[str, Any]]:
    try:
        res = (
            get_db()
            .table("users")
            .select("id,email,user_type,admin_role,created_at,account_suspended")
            .eq("user_type", "admin")
            .order("created_at", desc=False)
            .execute()
        )
    except Exception as e:
        logger.warning("list_admin_team failed: %s", e, exc_info=True)
        return []
    out: list[dict[str, Any]] = []
    for row in getattr(res, "data", None) or []:
        if not isinstance(row, dict):
            continue
        email = str(row.get("email") or "")
        role = resolve_admin_role(row, email) or "admin"
        out.append(
            {
                "user_id": str(row.get("id") or ""),
                "email": email or None,
                "admin_role": role,
                "created_at": row.get("created_at"),
                "account_suspended": bool(row.get("account_suspended")),
            }
        )
    return out


def invite_admin_colleague(email: str, *, password: str | None = None) -> dict[str, Any]:
    em = email.strip().lower()
    if not em or "@" not in em:
        raise ValueError(INVALID_EMAIL_ADDRESS)

    pwd_raw = (password or "").strip()
    use_invite_link = not pwd_raw
    pwd = _random_admin_password() if use_invite_link else pwd_raw
    if not use_invite_link:
        validate_admin_password(pwd)

    existing = fetch_user_profile_by_email(em)
    client = get_db()

    if existing and existing.get("user_type") == "admin":
        uid = str(existing["id"])
        if use_invite_link:
            request_password_reset(email=em, client_ip=None, purpose="setup")
            role = resolve_admin_role(existing, em) or "admin"
            return {
                "user_id": uid,
                "email": em,
                "admin_role": role,
                "created": False,
                "invite_link_sent": True,
                "message": PASSWORD_SETUP_LINK_SENT,
            }
        _set_supabase_password(uid, pwd)
        role = resolve_admin_role(existing, em) or "admin"
        return {
            "user_id": uid,
            "email": em,
            "admin_role": role,
            "created": False,
            "invite_link_sent": False,
            "message": ADMIN_ALREADY_PASSWORD_UPDATED,
        }

    if existing:
        uid = str(existing["id"])
        client.table("users").update(
            {"user_type": "admin", "admin_role": "admin", "account_suspended": False},
        ).eq("id", uid).execute()
        _sync_supabase_admin_metadata(uid, admin_role="admin")
        _set_supabase_password(uid, pwd)
        if use_invite_link:
            request_password_reset(email=em, client_ip=None, purpose="setup")
            return {
                "user_id": uid,
                "email": em,
                "admin_role": "admin",
                "created": False,
                "invite_link_sent": True,
                "message": PROMOTED_ADMIN_PASSWORD_LINK,
            }
        try:
            send_team_invite_email(email=em)
        except Exception:
            logger.warning("admin team invite email failed email=%s", em, exc_info=True)
        return {
            "user_id": uid,
            "email": em,
            "admin_role": "admin",
            "created": False,
            "invite_link_sent": False,
            "message": PROMOTED_TO_ADMIN,
        }

    created = client.auth.admin.create_user(
        {
            "email": em,
            "password": pwd,
            "email_confirm": True,
            "app_metadata": {"user_type": "admin", "admin_role": "admin"},
            "user_metadata": {"user_type": "admin"},
        }
    )
    user = getattr(created, "user", None)
    if user is None or not getattr(user, "id", None):
        raise ValueError(COULD_NOT_CREATE_ADMIN)

    uid = str(user.id)
    client.table("users").upsert(
        {
            "id": uid,
            "email": em,
            "user_type": "admin",
            "admin_role": "admin",
            "email_verified_at": datetime.now(timezone.utc).isoformat(),
        },
        on_conflict="id",
    ).execute()

    if use_invite_link:
        request_password_reset(email=em, client_ip=None, purpose="setup")
        return {
            "user_id": uid,
            "email": em,
            "admin_role": "admin",
            "created": True,
            "invite_link_sent": True,
            "message": ADMIN_CREATED_PASSWORD_LINK,
        }

    try:
        send_team_invite_email(email=em)
        send_admin_welcome_email(email=em)
    except Exception:
        logger.warning("admin team invite email failed email=%s", em, exc_info=True)
    return {
        "user_id": uid,
        "email": em,
        "admin_role": "admin",
        "created": True,
        "invite_link_sent": False,
        "message": ADMIN_CREATED,
    }


def send_admin_password_reset_link(user_id: str, *, actor_user_id: str) -> dict[str, Any]:
    actor = fetch_user_profile(actor_user_id)
    actor_ctx = {"user_type": "admin", **(actor or {})}
    if actor and actor.get("email"):
        actor_ctx["admin_role"] = resolve_admin_role(actor, str(actor.get("email") or ""))
    if not is_super_admin_user(actor_ctx):
        raise ValueError(ONLY_SUPER_ADMIN_RESET_LINK)

    prof = fetch_user_profile(user_id)
    if not prof or prof.get("user_type") != "admin":
        raise ValueError(ADMIN_USER_NOT_FOUND)
    email = str(prof.get("email") or "").strip().lower()
    if not email:
        raise ValueError(ADMIN_USER_NO_EMAIL)

    request_password_reset(email=email, client_ip=None)
    return {"user_id": user_id, "email": email, "message": PASSWORD_RESET_LINK_SENT}


def _has_vendor_profile(user_id: str) -> bool:
    try:
        res = get_db().table("vendors").select("user_id").eq("user_id", user_id).limit(1).execute()
        return bool(getattr(res, "data", None))
    except Exception as e:
        logger.warning("_has_vendor_profile failed user_id=%s: %s", user_id, e)
        return False


def _has_client_activity(user_id: str) -> bool:
    client = get_db()
    checks = (
        ("booking_requests", "client_user_id"),
        ("celebration_plans", "client_user_id"),
        ("client_saved_vendors", "client_user_id"),
    )
    for table, column in checks:
        try:
            res = client.table(table).select(column).eq(column, user_id).limit(1).execute()
            if getattr(res, "data", None):
                return True
        except Exception as e:
            logger.warning("_has_client_activity %s failed user_id=%s: %s", table, user_id, e)
    return False


def _demote_admin_to(user_id: str, *, user_type: Literal["client", "vendor"]) -> None:
    get_db().table("users").update(
        {"user_type": user_type, "admin_role": None, "account_suspended": False},
    ).eq("id", user_id).execute()
    _sync_supabase_admin_metadata(user_id, user_type=user_type)
    invalidate_all_sessions(user_id)


def _purge_user_delete_blockers(user_id: str) -> None:
    """Remove public rows that block deleting auth.users / public.users."""
    client = get_db()
    for table, column in (
        ("admin_audit_log", "admin_user_id"),
        ("contact_submissions", "user_id"),
    ):
        try:
            client.table(table).delete().eq(column, user_id).execute()
        except Exception as e:
            logger.warning("_purge_user_delete_blockers %s failed user_id=%s: %s", table, user_id, e)


def _hard_delete_admin_user(user_id: str) -> None:
    client = get_db()
    _purge_user_delete_blockers(user_id)
    invalidate_all_sessions(user_id)
    try:
        client.auth.admin.delete_user(user_id)
    except Exception as e:
        logger.warning("_hard_delete_admin_user auth delete failed user_id=%s: %s", user_id, e)
        raise ValueError(COULD_NOT_DELETE_ADMIN) from e
    try:
        res = client.table("users").delete().eq("id", user_id).execute()
        data = getattr(res, "data", None) or []
        if data is False:
            pass
    except Exception as e:
        msg = str(e).lower()
        if "does not exist" not in msg and "0 rows" not in msg:
            logger.warning("_hard_delete_admin_user db delete failed user_id=%s: %s", user_id, e)


def delete_admin_team_member(user_id: str, *, actor_user_id: str) -> dict[str, Any]:
    actor = fetch_user_profile(actor_user_id)
    actor_ctx = {"user_type": "admin", **(actor or {})}
    if actor and actor.get("email"):
        actor_ctx["admin_role"] = resolve_admin_role(actor, str(actor.get("email") or ""))
    if not is_super_admin_user(actor_ctx):
        raise ValueError(ONLY_SUPER_ADMIN_DELETE_TEAM)
    if user_id == actor_user_id:
        raise ValueError(CANNOT_DELETE_SELF)

    prof = fetch_user_profile(user_id)
    if not prof or prof.get("user_type") != "admin":
        raise ValueError(ADMIN_USER_NOT_FOUND)

    current_role = resolve_admin_role(prof, str(prof.get("email") or ""))
    if current_role == "super_admin":
        try:
            res = (
                get_db()
                .table("users")
                .select("id", count="exact")
                .eq("user_type", "admin")
                .eq("admin_role", "super_admin")
                .neq("id", user_id)
                .execute()
            )
            remaining = int(getattr(res, "count", None) or 0)
            if remaining == 0:
                raise ValueError(CANNOT_DELETE_LAST_SUPER_ADMIN)
        except ValueError:
            raise
        except Exception as e:
            logger.warning("super_admin count check failed: %s", e)

    email = str(prof.get("email") or "").strip().lower()

    if _has_vendor_profile(user_id):
        _demote_admin_to(user_id, user_type="vendor")
        return {
            "user_id": user_id,
            "email": email or None,
            "deleted": False,
            "demoted_to": "vendor",
            "message": ADMIN_REMOVED_REMAINS_VENDOR,
        }

    if _has_client_activity(user_id):
        _demote_admin_to(user_id, user_type="client")
        return {
            "user_id": user_id,
            "email": email or None,
            "deleted": False,
            "demoted_to": "client",
            "message": ADMIN_REMOVED_REMAINS_CLIENT,
        }

    _hard_delete_admin_user(user_id)
    return {
        "user_id": user_id,
        "email": email or None,
        "deleted": True,
        "demoted_to": None,
        "message": ADMIN_ACCOUNT_DELETED,
    }


def patch_admin_team_member(
    user_id: str,
    *,
    admin_role: AdminRole | None,
    account_suspended: bool | None,
    actor_user_id: str,
) -> dict[str, Any] | None:
    prof = fetch_user_profile(user_id)
    if not prof or prof.get("user_type") != "admin":
        raise ValueError(ADMIN_USER_NOT_FOUND)

    actor = fetch_user_profile(actor_user_id)
    actor_ctx = {"user_type": "admin", **(actor or {})}
    if actor and actor.get("email"):
        actor_ctx["admin_role"] = resolve_admin_role(actor, str(actor.get("email") or ""))
    if not is_super_admin_user(actor_ctx):
        raise ValueError(ONLY_SUPER_ADMIN_CHANGE_TEAM)

    if user_id == actor_user_id:
        if admin_role is not None and admin_role != "super_admin":
            raise ValueError(CANNOT_DEMOTE_SELF)
        if account_suspended is True:
            raise ValueError(CANNOT_SUSPEND_SELF)

    patch: dict[str, Any] = {}
    if admin_role is not None:
        patch["admin_role"] = admin_role
    if account_suspended is not None:
        patch["account_suspended"] = account_suspended
    if not patch:
        return prof

    if admin_role == "admin":
        try:
            res = (
                get_db()
                .table("users")
                .select("id", count="exact")
                .eq("user_type", "admin")
                .eq("admin_role", "super_admin")
                .neq("id", user_id)
                .execute()
            )
            remaining = int(getattr(res, "count", None) or 0)
            current_role = resolve_admin_role(prof, str(prof.get("email") or ""))
            if current_role == "super_admin" and remaining == 0:
                raise ValueError(CANNOT_DEMOTE_LAST_SUPER_ADMIN)
        except ValueError:
            raise
        except Exception as e:
            logger.warning("super_admin count check failed: %s", e)

    try:
        res = get_db().table("users").update(patch).eq("id", user_id).execute()
        data = getattr(res, "data", None) or []
        if not data:
            return None
        updated = data[0] if isinstance(data, list) else data
    except Exception as e:
        logger.warning("patch_admin_team_member failed: %s", e, exc_info=True)
        return None

    if admin_role is not None:
        _sync_supabase_admin_metadata(user_id, admin_role=admin_role)

    if account_suspended is True:
        invalidate_all_sessions(user_id)

    email = str((updated if isinstance(updated, dict) else prof).get("email") or prof.get("email") or "")
    row = updated if isinstance(updated, dict) else prof
    return {
        "user_id": user_id,
        "email": email or None,
        "admin_role": resolve_admin_role(row, email) or "admin",
        "created_at": row.get("created_at"),
        "account_suspended": bool(row.get("account_suspended")),
    }
