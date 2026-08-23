"""Email verification for client/vendor signup: hashed one-click tokens + Resend."""

from __future__ import annotations

import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.db import get_db
from app.core.logging import get_logger
from app.features.auth.accounts import (
    fetch_user_profile_by_email,
    normalize_email,
    profile_is_deleted,
)
from app.features.auth import messages as auth_messages
from app.features.email.branding import public_email_url
from app.features.email.dispatch import send_email_verification_email, send_welcome_email

logger = get_logger(__name__)

TOKEN_BYTES = 32
EXPIRY_MINUTES = 60

_issue_hits: dict[str, list[float]] = {}
_verify_hits: dict[str, list[float]] = {}


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


def _assert_issue_rate(email: str, client_ip: str | None) -> None:
    email_key = f"e:{email}"
    ip_key = f"ip:{(client_ip or 'unknown').strip() or 'unknown'}"
    if _rate_limited(_issue_hits, email_key, limit=5, window_s=3600):
        raise ValueError(auth_messages.VERIFICATION_EMAIL_RATE_LIMIT)
    if _rate_limited(_issue_hits, ip_key, limit=20, window_s=3600):
        raise ValueError(auth_messages.VERIFICATION_EMAIL_RATE_LIMIT)


def _assert_verify_rate(client_ip: str | None) -> None:
    ip_key = f"ip:{(client_ip or 'unknown').strip() or 'unknown'}"
    if _rate_limited(_verify_hits, ip_key, limit=30, window_s=3600):
        raise ValueError(auth_messages.VERIFY_RATE_LIMIT)


def _verify_url(raw_token: str) -> str:
    return public_email_url(f"/verify-email?token={raw_token}")


def _parse_expires(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _invalidate_unused_tokens(user_id: str) -> None:
    try:
        get_db().table("email_verification_tokens").update(
            {"used_at": _now_iso()},
        ).eq("user_id", user_id).is_("used_at", "null").execute()
    except Exception as e:
        msg = str(e)
        if "email_verification_tokens" in msg or "PGRST205" in msg:
            logger.error(
                "email_verification: table missing - run backend/sql/060_email_verification.sql in Supabase",
            )
        else:
            logger.exception("email_verification: invalidate unused failed user=%s", user_id)


def _insert_token(user_id: str, token_hash: str, expires_at: datetime) -> None:
    try:
        get_db().table("email_verification_tokens").insert(
            {
                "user_id": user_id,
                "token_hash": token_hash,
                "expires_at": expires_at.isoformat(),
            },
        ).execute()
    except Exception as e:
        msg = str(e)
        if "email_verification_tokens" in msg or "PGRST205" in msg:
            raise RuntimeError(
                "email_verification_tokens table missing - run backend/sql/060_email_verification.sql",
            ) from e
        raise


def _find_token_row(token_hash: str) -> dict[str, Any] | None:
    try:
        res = (
            get_db()
            .table("email_verification_tokens")
            .select("id,user_id,expires_at,used_at")
            .eq("token_hash", token_hash)
            .limit(1)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        return rows[0] if rows and isinstance(rows[0], dict) else None
    except Exception:
        logger.exception("email_verification: lookup token failed")
        return None


def _mark_token_used(token_id: str) -> None:
    get_db().table("email_verification_tokens").update(
        {"used_at": _now_iso()},
    ).eq("id", token_id).execute()


def mark_email_verified(user_id: str) -> None:
    try:
        get_db().table("users").update(
            {"email_verified_at": _now_iso()},
        ).eq("id", user_id).execute()
    except Exception:
        logger.exception("email_verification: mark verified failed user=%s", user_id)


def is_email_verified(user_id: str, *, user_type: str | None = None) -> bool:
    """Admins are not gated. Missing column / profile treated as verified for safety after backfill."""
    if user_type == "admin":
        return True
    try:
        res = (
            get_db()
            .table("users")
            .select("email_verified_at,user_type")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        if not rows or not isinstance(rows[0], dict):
            return True
        row = rows[0]
        if str(row.get("user_type") or "") == "admin":
            return True
        return bool(row.get("email_verified_at"))
    except Exception as e:
        msg = str(e)
        if "email_verified_at" in msg or "PGRST204" in msg:
            logger.warning(
                "email_verification: column missing - run backend/sql/060_email_verification.sql",
            )
            return True
        logger.exception("email_verification: is_verified check failed user=%s", user_id)
        return True


def confirm_supabase_email(user_id: str) -> None:
    """Mark email confirmed in Supabase Auth so password sign-in works; Eventtz still gates login."""
    try:
        get_db().auth.admin.update_user_by_id(user_id, {"email_confirm": True})
    except Exception:
        logger.exception("email_verification: supabase email_confirm failed user=%s", user_id)


def issue_email_verification(
    *,
    user_id: str,
    email: str,
    user_type: str | None = None,
    client_ip: str | None = None,
) -> None:
    """Create a one-time verify token and send verification email."""
    normalized = normalize_email(email)
    if not user_id or not normalized:
        return
    _assert_issue_rate(normalized, client_ip)

    raw = secrets.token_urlsafe(TOKEN_BYTES)
    token_hash = _hash_token(raw)
    expires_at = _now() + timedelta(minutes=EXPIRY_MINUTES)
    _invalidate_unused_tokens(user_id)
    try:
        _insert_token(user_id, token_hash, expires_at)
    except RuntimeError as e:
        logger.error("%s", e)
        return
    except Exception:
        logger.exception("email_verification: insert token failed user=%s", user_id)
        return

    verify_url = _verify_url(raw)
    send_email_verification_email(
        email=normalized,
        verify_url=verify_url,
        expires_minutes=EXPIRY_MINUTES,
        user_type=user_type,
    )


def resend_email_verification(*, email: str, client_ip: str | None = None) -> str:
    """Enumeration-safe resend for unverified client/vendor accounts."""
    normalized = normalize_email(email)
    _assert_issue_rate(normalized, client_ip)

    user_id: str | None = None
    to_email: str | None = None
    user_type: str | None = None

    profile = fetch_user_profile_by_email(normalized)
    if profile and profile.get("id"):
        user_id = str(profile["id"])
        to_email = str(profile.get("email") or normalized).strip().lower()
        user_type = str(profile.get("user_type") or "")
        if user_type == "admin" or profile.get("email_verified_at") or profile_is_deleted(profile):
            return auth_messages.GENERIC_RESEND_MESSAGE

    if not user_id or not to_email or user_type == "admin":
        return auth_messages.GENERIC_RESEND_MESSAGE

    raw = secrets.token_urlsafe(TOKEN_BYTES)
    token_hash = _hash_token(raw)
    expires_at = _now() + timedelta(minutes=EXPIRY_MINUTES)
    _invalidate_unused_tokens(user_id)
    try:
        _insert_token(user_id, token_hash, expires_at)
    except Exception:
        logger.exception("email_verification: resend insert failed user=%s", user_id)
        return auth_messages.GENERIC_RESEND_MESSAGE

    verify_url = _verify_url(raw)
    send_email_verification_email(
        email=to_email,
        verify_url=verify_url,
        expires_minutes=EXPIRY_MINUTES,
        user_type=user_type,
    )
    return auth_messages.GENERIC_RESEND_MESSAGE


def _verify_success_payload(user_id: str) -> dict[str, Any]:
    """Return user/session payload after email is verified (first verify or idempotent retry)."""
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
        user_type = str(row_user.get("user_type") or "client")
    except Exception:
        logger.exception("email_verification: load user failed user=%s", user_id)
        email = ""
        user_type = "client"
    if not email:
        raise ValueError(auth_messages.VERIFY_EMAIL_FAILED)

    return {
        "user": {"id": user_id, "email": email, "user_type": user_type},
        "session": None,
        "user_type": user_type,
        "email": email,
    }


def verify_email_with_token(
    *,
    token: str,
    client_ip: str | None = None,
) -> dict[str, Any]:
    """
    Consume token, mark verified, return {user, session, user_type} for cookie setup.
    Raises ValueError with a user-safe message on failure.
    """
    _assert_verify_rate(client_ip)
    raw = (token or "").strip()
    if not raw or len(raw) < 20:
        raise ValueError(auth_messages.VERIFICATION_LINK_INVALID)

    row = _find_token_row(_hash_token(raw))
    if not row:
        raise ValueError(auth_messages.VERIFICATION_LINK_INVALID)

    user_id = str(row.get("user_id") or "")
    if row.get("used_at"):
        if user_id and is_email_verified(user_id):
            return _verify_success_payload(user_id)
        raise ValueError(auth_messages.VERIFICATION_LINK_INVALID)

    expires = _parse_expires(row.get("expires_at"))
    if expires is None or expires < _now():
        raise ValueError(auth_messages.VERIFICATION_LINK_INVALID)

    token_id = str(row.get("id") or "")
    if not user_id or not token_id:
        raise ValueError(auth_messages.VERIFICATION_LINK_INVALID)

    mark_email_verified(user_id)
    _mark_token_used(token_id)
    _invalidate_unused_tokens(user_id)

    payload = _verify_success_payload(user_id)
    confirm_supabase_email(user_id)
    send_welcome_email(email=str(payload["email"]), user_type=str(payload["user_type"]))
    return payload
