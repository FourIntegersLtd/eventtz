"""Forgot / reset password: hashed one-click tokens + Resend email + Supabase admin update."""

from __future__ import annotations

import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from app.core.db import get_db
from app.core.logging import get_logger
from app.features.auth.accounts import fetch_user_profile_by_email, normalize_email, profile_is_deleted
from app.features.auth.password_policy import validate_password_for_user
from app.features.auth.session_invalidation import invalidate_all_sessions
from app.features.auth.supabase import SupabaseAuthService
from app.features.auth import messages as auth_messages
from app.features.email.branding import public_email_url
from app.features.email.dispatch import send_password_changed_email, send_password_reset_email

logger = get_logger(__name__)

PasswordResetPurpose = Literal["reset", "setup"]

TOKEN_BYTES = 32
EXPIRY_MINUTES = 60

_forgot_hits: dict[str, list[float]] = {}
_reset_hits: dict[str, list[float]] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _now_iso() -> str:
    return _now().isoformat()


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _prune(bucket: dict[str, list[float]], key: str, window_s: float) -> list[float]:
    cutoff = time.monotonic() - window_s
    hits = [t for t in bucket.get(key, []) if t >= cutoff]
    bucket[key] = hits
    return hits


def _rate_limited(bucket: dict[str, list[float]], key: str, *, limit: int, window_s: float) -> bool:
    hits = _prune(bucket, key, window_s)
    if len(hits) >= limit:
        return True
    hits.append(time.monotonic())
    bucket[key] = hits
    return False


def _assert_forgot_rate(email: str, client_ip: str | None) -> None:
    email_key = f"e:{email}"
    ip_key = f"ip:{(client_ip or 'unknown').strip() or 'unknown'}"
    if _rate_limited(_forgot_hits, email_key, limit=5, window_s=3600):
        raise ValueError(auth_messages.RESET_REQUEST_RATE_LIMIT)
    if _rate_limited(_forgot_hits, ip_key, limit=20, window_s=3600):
        raise ValueError(auth_messages.RESET_REQUEST_RATE_LIMIT)


def _assert_reset_rate(client_ip: str | None) -> None:
    ip_key = f"ip:{(client_ip or 'unknown').strip() or 'unknown'}"
    if _rate_limited(_reset_hits, ip_key, limit=30, window_s=3600):
        raise ValueError(auth_messages.VERIFY_RATE_LIMIT)


def _reset_url(raw_token: str, *, user_type: str | None = None) -> str:
    if user_type == "admin":
        return public_email_url(f"/reset-password?portal=admin&token={raw_token}")
    return public_email_url(f"/reset-password?token={raw_token}")


def _user_type_for_id(user_id: str) -> str | None:
    try:
        res = (
            get_db()
            .table("users")
            .select("user_type")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        if rows and isinstance(rows[0], dict):
            return str(rows[0].get("user_type") or "") or None
    except Exception:
        logger.exception("password_reset: load user_type failed user=%s", user_id)
    return None


def _log_password_audit(*, user_id: str, action: str, payload: dict[str, Any] | None = None) -> None:
    user_type = _user_type_for_id(user_id)
    if user_type != "admin":
        return
    try:
        from app.features.admin.audit import insert_admin_audit_log

        insert_admin_audit_log(
            admin_user_id=user_id,
            action=action,
            entity_type="user",
            entity_id=user_id,
            audit_event_details=payload or {},
        )
    except Exception:
        logger.exception("password_reset: audit log failed user=%s action=%s", user_id, action)


def _invalidate_unused_tokens(user_id: str) -> None:
    try:
        get_db().table("password_reset_tokens").update(
            {"used_at": _now_iso()},
        ).eq("user_id", user_id).is_("used_at", "null").execute()
    except Exception as e:
        msg = str(e)
        if "password_reset_tokens" in msg or "PGRST205" in msg:
            logger.error(
                "password_reset: table missing - run backend/sql/049_password_reset_tokens.sql in Supabase",
            )
        else:
            logger.exception("password_reset: invalidate unused failed user=%s", user_id)


def _insert_token(user_id: str, token_hash: str, expires_at: datetime) -> None:
    try:
        get_db().table("password_reset_tokens").insert(
            {
                "user_id": user_id,
                "token_hash": token_hash,
                "expires_at": expires_at.isoformat(),
            },
        ).execute()
    except Exception as e:
        msg = str(e)
        if "password_reset_tokens" in msg or "PGRST205" in msg:
            raise RuntimeError(
                "password_reset_tokens table missing - run backend/sql/049_password_reset_tokens.sql",
            ) from e
        raise


def _find_valid_token_row(token_hash: str) -> dict[str, Any] | None:
    try:
        res = (
            get_db()
            .table("password_reset_tokens")
            .select("id,user_id,expires_at,used_at")
            .eq("token_hash", token_hash)
            .limit(1)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        row = rows[0] if rows and isinstance(rows[0], dict) else None
        return row
    except Exception:
        logger.exception("password_reset: lookup token failed")
        return None


def _mark_token_used(token_id: str) -> None:
    get_db().table("password_reset_tokens").update(
        {"used_at": _now_iso()},
    ).eq("id", token_id).execute()


def _parse_expires(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _set_supabase_password(user_id: str, password: str) -> None:
    get_db().auth.admin.update_user_by_id(
        user_id,
        {"password": password},
    )


def request_password_reset(
    *,
    email: str,
    client_ip: str | None = None,
    purpose: PasswordResetPurpose = "reset",
) -> str:
    """Always returns GENERIC_FORGOT_MESSAGE (enumeration-safe). May raise on rate limit."""
    normalized = normalize_email(email)
    _assert_forgot_rate(normalized, client_ip)

    user_id: str | None = None
    to_email: str | None = None
    user_type: str | None = None

    profile = fetch_user_profile_by_email(normalized)
    if profile and profile.get("id"):
        if profile_is_deleted(profile):
            return auth_messages.GENERIC_FORGOT_MESSAGE
        user_id = str(profile["id"])
        to_email = str(profile.get("email") or normalized).strip().lower()
        user_type = str(profile.get("user_type") or "")

    if not user_id or not to_email:
        return auth_messages.GENERIC_FORGOT_MESSAGE

    raw = secrets.token_urlsafe(TOKEN_BYTES)
    token_hash = _hash_token(raw)
    expires_at = _now() + timedelta(minutes=EXPIRY_MINUTES)
    _invalidate_unused_tokens(user_id)
    try:
        _insert_token(user_id, token_hash, expires_at)
    except RuntimeError as e:
        logger.error("%s", e)
        return auth_messages.GENERIC_FORGOT_MESSAGE
    except Exception:
        logger.exception("password_reset: insert token failed user=%s", user_id)
        return auth_messages.GENERIC_FORGOT_MESSAGE

    reset_url = _reset_url(raw, user_type=user_type)
    send_password_reset_email(
        email=to_email,
        reset_url=reset_url,
        expires_minutes=EXPIRY_MINUTES,
        user_type=user_type,
        purpose=purpose,
    )
    audit_action = "password.setup_requested" if purpose == "setup" else "password.reset_requested"
    _log_password_audit(user_id=user_id, action=audit_action)
    return auth_messages.GENERIC_FORGOT_MESSAGE


def reset_password_with_token(
    *,
    token: str,
    password: str,
    client_ip: str | None = None,
) -> dict[str, Any]:
    """
    Consume token, set password, return {user, session} for cookie setup.
    Raises ValueError with a user-safe message on failure.
    """
    _assert_reset_rate(client_ip)
    raw = (token or "").strip()
    if not raw or len(raw) < 20:
        raise ValueError(auth_messages.RESET_LINK_INVALID)

    row = _find_valid_token_row(_hash_token(raw))
    if not row:
        raise ValueError(auth_messages.RESET_LINK_INVALID)
    if row.get("used_at"):
        raise ValueError(auth_messages.RESET_LINK_USED)
    expires = _parse_expires(row.get("expires_at"))
    if expires is None or expires < _now():
        raise ValueError(auth_messages.RESET_LINK_INVALID)

    user_id = str(row.get("user_id") or "")
    token_id = str(row.get("id") or "")
    if not user_id or not token_id:
        raise ValueError(auth_messages.RESET_LINK_INVALID)

    user_type = _user_type_for_id(user_id)
    validate_password_for_user(password, user_type)

    try:
        profile = (
            get_db()
            .table("users")
            .select("id,email,user_type")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        pdata = getattr(profile, "data", None) or []
        row_user = pdata[0] if pdata else {}
        email = str(row_user.get("email") or "").strip().lower()
        user_type = str(row_user.get("user_type") or user_type or "")
    except Exception:
        logger.exception("password_reset: load user email failed user=%s", user_id)
        email = ""
    if not email:
        raise ValueError(auth_messages.UPDATE_PASSWORD_FAILED)

    try:
        _set_supabase_password(user_id, password)
    except Exception as e:
        logger.exception("password_reset: supabase update failed user=%s", user_id)
        raise ValueError(auth_messages.UPDATE_PASSWORD_FAILED) from e

    _mark_token_used(token_id)
    _invalidate_unused_tokens(user_id)
    invalidate_all_sessions(user_id)
    _log_password_audit(user_id=user_id, action="password.reset")
    send_password_changed_email(email=email, user_type=user_type)

    service = SupabaseAuthService()
    result = service.sign_in_with_password(email=email, password=password)
    if not result.get("success") or not result.get("session"):
        raise ValueError(auth_messages.PASSWORD_UPDATED_SIGN_IN_MANUAL)
    return {"user": result["user"], "session": result["session"]}


def change_password(
    *,
    user_id: str,
    email: str,
    current_password: str,
    new_password: str,
    client_ip: str | None = None,
) -> None:
    """Verify current password then set a new one. Raises ValueError on failure."""
    from app.features.auth.rate_limit import assert_change_password_rate

    assert_change_password_rate(user_id, client_ip)

    user_type = _user_type_for_id(user_id)
    validate_password_for_user(new_password, user_type)
    if current_password == new_password:
        raise ValueError(auth_messages.PASSWORD_MUST_DIFFER)

    normalized = normalize_email(email)
    service = SupabaseAuthService()
    check = service.sign_in_with_password(email=normalized, password=current_password)
    if not check.get("success"):
        raise ValueError(auth_messages.CURRENT_PASSWORD_INCORRECT)
    try:
        _set_supabase_password(user_id, new_password)
    except Exception as e:
        logger.exception("change_password: supabase update failed user=%s", user_id)
        raise ValueError(auth_messages.UPDATE_PASSWORD_FAILED) from e
    invalidate_all_sessions(user_id)
    _log_password_audit(user_id=user_id, action="password.changed")
    send_password_changed_email(email=normalized, user_type=user_type)
