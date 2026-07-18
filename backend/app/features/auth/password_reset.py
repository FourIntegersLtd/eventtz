"""Forgot / reset password: hashed one-click tokens + Resend email + Supabase admin update."""

from __future__ import annotations

import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.db import get_supabase_auth_client
from app.core.logging import get_logger
from app.features.auth import local_store as local_auth_store
from app.features.auth.accounts import fetch_user_profile_by_email
from app.features.auth.supabase import SupabaseAuthService
from app.features.email.dispatch import send_password_reset_email

logger = get_logger(__name__)

TOKEN_BYTES = 32
EXPIRY_MINUTES = 60
GENERIC_FORGOT_MESSAGE = (
    "If an account exists for that email, we sent a link to reset your password. "
    "Check your inbox (and spam) for an email from Eventtz."
)

# Simple in-process rate limits (per process). Enough to blunt abuse without a redis dep.
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
        raise ValueError("Too many reset requests. Try again later.")
    if _rate_limited(_forgot_hits, ip_key, limit=20, window_s=3600):
        raise ValueError("Too many reset requests. Try again later.")


def _assert_reset_rate(client_ip: str | None) -> None:
    ip_key = f"ip:{(client_ip or 'unknown').strip() or 'unknown'}"
    if _rate_limited(_reset_hits, ip_key, limit=30, window_s=3600):
        raise ValueError("Too many attempts. Try again later.")


def _reset_url(raw_token: str) -> str:
    base = get_settings().frontend_url.strip().rstrip("/")
    return f"{base}/reset-password?token={raw_token}"


def _invalidate_unused_tokens(user_id: str) -> None:
    if local_auth_store.enabled():
        local_auth_store.invalidate_password_reset_tokens(user_id)
        return
    try:
        get_client().table("password_reset_tokens").update(
            {"used_at": _now_iso()},
        ).eq("user_id", user_id).is_("used_at", "null").execute()
    except Exception as e:
        msg = str(e)
        if "password_reset_tokens" in msg or "PGRST205" in msg:
            logger.error(
                "password_reset: table missing — run backend/sql/049_password_reset_tokens.sql in Supabase",
            )
        else:
            logger.exception("password_reset: invalidate unused failed user=%s", user_id)


def _insert_token(user_id: str, token_hash: str, expires_at: datetime) -> None:
    if local_auth_store.enabled():
        local_auth_store.insert_password_reset_token(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        return
    try:
        get_client().table("password_reset_tokens").insert(
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
                "password_reset_tokens table missing — run backend/sql/049_password_reset_tokens.sql",
            ) from e
        raise


def _find_valid_token_row(token_hash: str) -> dict[str, Any] | None:
    if local_auth_store.enabled():
        return local_auth_store.find_password_reset_token(token_hash)
    try:
        res = (
            get_client()
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
    if local_auth_store.enabled():
        local_auth_store.mark_password_reset_token_used(token_id)
        return
    get_client().table("password_reset_tokens").update(
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
    get_supabase_auth_client().auth.admin.update_user_by_id(
        user_id,
        {"password": password},
    )


def request_password_reset(*, email: str, client_ip: str | None = None) -> str:
    """Always returns GENERIC_FORGOT_MESSAGE (enumeration-safe). May raise on rate limit."""
    normalized = local_auth_store.normalize_email(email)
    _assert_forgot_rate(normalized, client_ip)

    user_id: str | None = None
    to_email: str | None = None

    if local_auth_store.enabled():
        user = local_auth_store.user_record_for_email(normalized)
        if user:
            user_id = str(user["id"])
            to_email = normalized
    else:
        profile = fetch_user_profile_by_email(normalized)
        if profile and profile.get("id"):
            user_id = str(profile["id"])
            to_email = str(profile.get("email") or normalized).strip().lower()

    if not user_id or not to_email:
        return GENERIC_FORGOT_MESSAGE

    raw = secrets.token_urlsafe(TOKEN_BYTES)
    token_hash = _hash_token(raw)
    expires_at = _now() + timedelta(minutes=EXPIRY_MINUTES)
    _invalidate_unused_tokens(user_id)
    try:
        _insert_token(user_id, token_hash, expires_at)
    except RuntimeError as e:
        logger.error("%s", e)
        return GENERIC_FORGOT_MESSAGE
    except Exception:
        logger.exception("password_reset: insert token failed user=%s", user_id)
        return GENERIC_FORGOT_MESSAGE

    reset_url = _reset_url(raw)
    if local_auth_store.enabled():
        # Resend is no-op in local mode — log URL for developers only (not the hash).
        logger.info("password_reset local link user=%s url=%s", user_id, reset_url)
    else:
        send_password_reset_email(
            email=to_email,
            reset_url=reset_url,
            expires_minutes=EXPIRY_MINUTES,
        )
    return GENERIC_FORGOT_MESSAGE


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
        raise ValueError("This reset link is invalid or has expired. Request a new one.")
    if len(password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    row = _find_valid_token_row(_hash_token(raw))
    if not row:
        raise ValueError("This reset link is invalid or has expired. Request a new one.")
    if row.get("used_at"):
        raise ValueError("This reset link has already been used. Request a new one.")
    expires = _parse_expires(row.get("expires_at"))
    if expires is None or expires < _now():
        raise ValueError("This reset link is invalid or has expired. Request a new one.")

    user_id = str(row.get("user_id") or "")
    token_id = str(row.get("id") or "")
    if not user_id or not token_id:
        raise ValueError("This reset link is invalid or has expired. Request a new one.")

    if local_auth_store.enabled():
        email = local_auth_store.email_for_user_id(user_id)
        if not email:
            raise ValueError("This reset link is invalid or has expired. Request a new one.")
        local_auth_store.set_password(email, password)
        _mark_token_used(token_id)
        user = local_auth_store.user_record_for_email(email)
        if not user:
            raise ValueError("Could not update password. Try again.")
        session = local_auth_store.create_session(email)
        return {"user": user, "session": session}

    # Resolve email for sign-in after admin password update
    try:
        profile = (
            get_client()
            .table("users")
            .select("id,email")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        pdata = getattr(profile, "data", None) or []
        email = str((pdata[0] if pdata else {}).get("email") or "").strip().lower()
    except Exception:
        logger.exception("password_reset: load user email failed user=%s", user_id)
        email = ""
    if not email:
        raise ValueError("Could not update password. Try again.")

    try:
        _set_supabase_password(user_id, password)
    except Exception as e:
        logger.exception("password_reset: supabase update failed user=%s", user_id)
        raise ValueError("Could not update password. Try again.") from e

    _mark_token_used(token_id)
    # Invalidate any other outstanding tokens
    _invalidate_unused_tokens(user_id)

    service = SupabaseAuthService()
    result = service.sign_in_with_password(email=email, password=password)
    if not result.get("success") or not result.get("session"):
        raise ValueError(
            "Password updated, but we couldn't sign you in automatically. "
            "Please sign in with your new password.",
        )
    return {"user": result["user"], "session": result["session"]}


def change_password(
    *,
    user_id: str,
    email: str,
    current_password: str,
    new_password: str,
) -> None:
    """Verify current password then set a new one. Raises ValueError on failure."""
    if len(new_password) < 6:
        raise ValueError("Password must be at least 6 characters.")
    if current_password == new_password:
        raise ValueError("Choose a new password that is different from your current one.")

    normalized = local_auth_store.normalize_email(email)
    if local_auth_store.enabled():
        user = local_auth_store.authenticate(normalized, current_password)
        if not user or str(user.get("id")) != user_id:
            raise ValueError("Current password is incorrect.")
        local_auth_store.set_password(normalized, new_password)
        return

    service = SupabaseAuthService()
    check = service.sign_in_with_password(email=normalized, password=current_password)
    if not check.get("success"):
        raise ValueError("Current password is incorrect.")
    try:
        _set_supabase_password(user_id, new_password)
    except Exception as e:
        logger.exception("change_password: supabase update failed user=%s", user_id)
        raise ValueError("Could not update password. Try again.") from e
