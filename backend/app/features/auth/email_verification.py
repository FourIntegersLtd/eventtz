"""Email verification for client/vendor signup: hashed one-click tokens + Resend."""

from __future__ import annotations

import hashlib
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger
from app.features.auth import local_store as local_auth_store
from app.features.auth.accounts import fetch_user_profile_by_email
from app.features.auth.supabase import SupabaseAuthService
from app.features.email.branding import public_email_url
from app.features.email.dispatch import send_email_verification_email, send_welcome_email

logger = get_logger(__name__)

TOKEN_BYTES = 32
EXPIRY_MINUTES = 60
GENERIC_RESEND_MESSAGE = (
    "If an account exists for that email and still needs verification, "
    "we sent a new link. Check your inbox (and spam) for an email from Eventtz."
)
SIGNUP_VERIFY_MESSAGE = (
    "Account created. Check your email for a link to verify your address before you sign in."
)
UNVERIFIED_LOGIN_DETAIL = (
    "Verify your email before signing in. Check your inbox for the link we sent, "
    "or request a new one."
)

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
        raise ValueError("Too many verification emails. Try again later.")
    if _rate_limited(_issue_hits, ip_key, limit=20, window_s=3600):
        raise ValueError("Too many verification emails. Try again later.")


def _assert_verify_rate(client_ip: str | None) -> None:
    ip_key = f"ip:{(client_ip or 'unknown').strip() or 'unknown'}"
    if _rate_limited(_verify_hits, ip_key, limit=30, window_s=3600):
        raise ValueError("Too many attempts. Try again later.")


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
    if local_auth_store.enabled():
        local_auth_store.invalidate_email_verification_tokens(user_id)
        return
    try:
        get_client().table("email_verification_tokens").update(
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
    if local_auth_store.enabled():
        local_auth_store.insert_email_verification_token(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        return
    try:
        get_client().table("email_verification_tokens").insert(
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
    if local_auth_store.enabled():
        return local_auth_store.find_email_verification_token(token_hash)
    try:
        res = (
            get_client()
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
    if local_auth_store.enabled():
        local_auth_store.mark_email_verification_token_used(token_id)
        return
    get_client().table("email_verification_tokens").update(
        {"used_at": _now_iso()},
    ).eq("id", token_id).execute()


def mark_email_verified(user_id: str) -> None:
    if local_auth_store.enabled():
        local_auth_store.mark_email_verified(user_id)
        return
    try:
        get_client().table("users").update(
            {"email_verified_at": _now_iso()},
        ).eq("id", user_id).execute()
    except Exception:
        logger.exception("email_verification: mark verified failed user=%s", user_id)


def is_email_verified(user_id: str, *, user_type: str | None = None) -> bool:
    """Admins are not gated. Missing column / profile treated as verified for safety after backfill."""
    if user_type == "admin":
        return True
    if local_auth_store.enabled():
        return local_auth_store.is_email_verified(user_id)
    try:
        res = (
            get_client()
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
    if local_auth_store.enabled():
        return
    try:
        get_client().auth.admin.update_user_by_id(user_id, {"email_confirm": True})
    except Exception:
        logger.exception("email_verification: supabase email_confirm failed user=%s", user_id)


def issue_email_verification(
    *,
    user_id: str,
    email: str,
    user_type: str | None = None,
    client_ip: str | None = None,
) -> None:
    """Create a one-time verify token and email (or log URL in local mode)."""
    normalized = local_auth_store.normalize_email(email)
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
    if local_auth_store.enabled():
        dev_base = get_settings().frontend_url.strip().rstrip("/")
        logger.info(
            "email_verification local link user=%s url=%s (email would use %s)",
            user_id,
            f"{dev_base}/verify-email?token={raw}",
            verify_url,
        )
        return

    send_email_verification_email(
        email=normalized,
        verify_url=verify_url,
        expires_minutes=EXPIRY_MINUTES,
        user_type=user_type,
    )


def resend_email_verification(*, email: str, client_ip: str | None = None) -> str:
    """Enumeration-safe resend for unverified client/vendor accounts."""
    normalized = local_auth_store.normalize_email(email)
    _assert_issue_rate(normalized, client_ip)

    user_id: str | None = None
    to_email: str | None = None
    user_type: str | None = None

    if local_auth_store.enabled():
        user = local_auth_store.user_record_for_email(normalized)
        if user:
            user_id = str(user["id"])
            to_email = normalized
            user_type = str(user.get("user_type") or "")
            if local_auth_store.is_email_verified(user_id):
                return GENERIC_RESEND_MESSAGE
    else:
        profile = fetch_user_profile_by_email(normalized)
        if profile and profile.get("id"):
            user_id = str(profile["id"])
            to_email = str(profile.get("email") or normalized).strip().lower()
            user_type = str(profile.get("user_type") or "")
            if user_type == "admin" or profile.get("email_verified_at"):
                return GENERIC_RESEND_MESSAGE

    if not user_id or not to_email or user_type == "admin":
        return GENERIC_RESEND_MESSAGE

    # Bypass the rate assert inside issue (already counted above) by calling insert path carefully.
    # Re-use issue but it will double-count rate - so call internals without re-assert.
    raw = secrets.token_urlsafe(TOKEN_BYTES)
    token_hash = _hash_token(raw)
    expires_at = _now() + timedelta(minutes=EXPIRY_MINUTES)
    _invalidate_unused_tokens(user_id)
    try:
        _insert_token(user_id, token_hash, expires_at)
    except Exception:
        logger.exception("email_verification: resend insert failed user=%s", user_id)
        return GENERIC_RESEND_MESSAGE

    verify_url = _verify_url(raw)
    if local_auth_store.enabled():
        dev_base = get_settings().frontend_url.strip().rstrip("/")
        logger.info(
            "email_verification resend local link user=%s url=%s",
            user_id,
            f"{dev_base}/verify-email?token={raw}",
        )
    else:
        send_email_verification_email(
            email=to_email,
            verify_url=verify_url,
            expires_minutes=EXPIRY_MINUTES,
            user_type=user_type,
        )
    return GENERIC_RESEND_MESSAGE


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
        raise ValueError("This verification link is invalid or has expired. Request a new one.")

    row = _find_token_row(_hash_token(raw))
    if not row:
        raise ValueError("This verification link is invalid or has expired. Request a new one.")
    if row.get("used_at"):
        raise ValueError("This verification link has already been used. You can sign in.")
    expires = _parse_expires(row.get("expires_at"))
    if expires is None or expires < _now():
        raise ValueError("This verification link is invalid or has expired. Request a new one.")

    user_id = str(row.get("user_id") or "")
    token_id = str(row.get("id") or "")
    if not user_id or not token_id:
        raise ValueError("This verification link is invalid or has expired. Request a new one.")

    mark_email_verified(user_id)
    _mark_token_used(token_id)
    _invalidate_unused_tokens(user_id)

    if local_auth_store.enabled():
        email = local_auth_store.email_for_user_id(user_id)
        if not email:
            raise ValueError("This verification link is invalid or has expired. Request a new one.")
        user = local_auth_store.user_record_for_email(email)
        if not user:
            raise ValueError("Could not verify email. Try again.")
        session = local_auth_store.create_session(email)
        user_type = str(user.get("user_type") or "client")
        return {"user": user, "session": session, "user_type": user_type, "email": email}

    try:
        profile = (
            get_client()
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
        raise ValueError("Could not verify email. Try again.")

    confirm_supabase_email(user_id)
    send_welcome_email(email=email, user_type=user_type)

    # Session: password unknown after verify-from-email - return user without auto login
    # unless we can create a session. Prefer requiring sign-in after verify for security
    # (password not available). User asked "before they can login" - so verify then go to login.
    return {
        "user": {"id": user_id, "email": email, "user_type": user_type},
        "session": None,
        "user_type": user_type,
        "email": email,
    }
