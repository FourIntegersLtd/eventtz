"""Admin team listing, invites, and Supabase role sync."""

from __future__ import annotations

from typing import Any, Literal

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.features.auth.accounts import fetch_user_profile, fetch_user_profile_by_email, is_super_admin_user, resolve_admin_role
from app.features.email.dispatch import send_team_invite_email

logger = get_logger(__name__)

AdminRole = Literal["super_admin", "admin"]


def assert_active_admin_assignee(user_id: str | None) -> None:
    if not user_id:
        return
    prof = fetch_user_profile(user_id)
    if not prof or prof.get("user_type") != "admin":
        raise ValueError("Assignee must be an admin account.")
    if bool(prof.get("account_suspended")):
        raise ValueError("Assignee admin account is suspended.")


def _sync_supabase_admin_metadata(user_id: str, *, admin_role: AdminRole) -> None:
    if get_settings().local_auth_mode:
        return
    try:
        get_client().auth.admin.update_user_by_id(
            user_id,
            {
                "app_metadata": {"user_type": "admin", "admin_role": admin_role},
                "user_metadata": {"user_type": "admin"},
            },
        )
    except Exception as e:
        logger.warning("_sync_supabase_admin_metadata failed user_id=%s: %s", user_id, e)


def _set_supabase_password(user_id: str, password: str) -> None:
    if get_settings().local_auth_mode:
        return
    try:
        get_client().auth.admin.update_user_by_id(user_id, {"password": password})
    except Exception as e:
        logger.warning("_set_supabase_password failed user_id=%s: %s", user_id, e)
        raise ValueError("Could not set password for this account.") from e


def list_admin_team() -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        return []
    try:
        res = (
            get_client()
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


def invite_admin_colleague(email: str, *, password: str) -> dict[str, Any]:
    if get_settings().local_auth_mode:
        raise ValueError("Admin invites are disabled in local auth mode.")
    em = email.strip().lower()
    pwd = password.strip()
    if not em or "@" not in em:
        raise ValueError("Enter a valid email address.")
    if len(pwd) < 6:
        raise ValueError("Password must be at least 6 characters.")

    existing = fetch_user_profile_by_email(em)
    client = get_client()

    if existing and existing.get("user_type") == "admin":
        uid = str(existing["id"])
        _set_supabase_password(uid, pwd)
        role = resolve_admin_role(existing, em) or "admin"
        return {
            "user_id": uid,
            "email": em,
            "admin_role": role,
            "created": False,
            "message": "This person is already an admin. Password updated.",
        }

    if existing:
        uid = str(existing["id"])
        client.table("users").update(
            {"user_type": "admin", "admin_role": "admin", "account_suspended": False},
        ).eq("id", uid).execute()
        _sync_supabase_admin_metadata(uid, admin_role="admin")
        _set_supabase_password(uid, pwd)
        try:
            send_team_invite_email(email=em)
        except Exception:
            logger.warning("admin team invite email failed email=%s", em, exc_info=True)
        return {
            "user_id": uid,
            "email": em,
            "admin_role": "admin",
            "created": False,
            "message": "Existing account promoted to admin.",
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
        raise ValueError("Could not create admin account.")

    uid = str(user.id)
    client.table("users").upsert(
        {"id": uid, "email": em, "user_type": "admin", "admin_role": "admin"},
        on_conflict="id",
    ).execute()
    try:
        send_team_invite_email(email=em)
    except Exception:
        logger.warning("admin team invite email failed email=%s", em, exc_info=True)
    return {
        "user_id": uid,
        "email": em,
        "admin_role": "admin",
        "created": True,
        "message": "Admin account created.",
    }


def patch_admin_team_member(
    user_id: str,
    *,
    admin_role: AdminRole | None,
    account_suspended: bool | None,
    actor_user_id: str,
) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return None
    prof = fetch_user_profile(user_id)
    if not prof or prof.get("user_type") != "admin":
        raise ValueError("Admin user not found.")

    actor = fetch_user_profile(actor_user_id)
    actor_ctx = {"user_type": "admin", **(actor or {})}
    if actor and actor.get("email"):
        actor_ctx["admin_role"] = resolve_admin_role(actor, str(actor.get("email") or ""))
    if not is_super_admin_user(actor_ctx):
        raise ValueError("Only super admins can change team members.")

    if user_id == actor_user_id:
        if admin_role is not None and admin_role != "super_admin":
            raise ValueError("You cannot demote yourself.")
        if account_suspended is True:
            raise ValueError("You cannot suspend yourself.")

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
                get_client()
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
                raise ValueError("Cannot demote the last super admin.")
        except ValueError:
            raise
        except Exception as e:
            logger.warning("super_admin count check failed: %s", e)

    try:
        res = get_client().table("users").update(patch).eq("id", user_id).execute()
        data = getattr(res, "data", None) or []
        if not data:
            return None
        updated = data[0] if isinstance(data, list) else data
    except Exception as e:
        logger.warning("patch_admin_team_member failed: %s", e, exc_info=True)
        return None

    if admin_role is not None:
        _sync_supabase_admin_metadata(user_id, admin_role=admin_role)

    email = str((updated if isinstance(updated, dict) else prof).get("email") or prof.get("email") or "")
    row = updated if isinstance(updated, dict) else prof
    return {
        "user_id": user_id,
        "email": email or None,
        "admin_role": resolve_admin_role(row, email) or "admin",
        "created_at": row.get("created_at"),
        "account_suspended": bool(row.get("account_suspended")),
    }
