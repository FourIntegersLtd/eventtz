"""Generate and assign per-vendor client referral codes (numeric, max 6 digits)."""

from __future__ import annotations

import re
import secrets
from typing import Any

from app.core.constants import CLIENT_REFERRAL_CODE_MAX_LEN
from app.core.db import get_db
from app.core.logging import get_logger

logger = get_logger(__name__)

_CLIENT_REFERRAL_CODE_RE = re.compile(r"^[0-9]{1,6}$")


def is_valid_client_referral_code(code: str | None) -> bool:
    if not code:
        return False
    return bool(_CLIENT_REFERRAL_CODE_RE.fullmatch(str(code).strip()))


def normalize_client_referral_code(raw: str | None) -> str | None:
    """Strip non-digits; return 1–6 digit code or None."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw).strip())
    if not digits or len(digits) > CLIENT_REFERRAL_CODE_MAX_LEN:
        return None
    return digits


def _code_taken(code: str, *, exclude_user_id: str | None = None) -> bool:
    q = get_db().table("vendors").select("user_id").eq("client_referral_code", code).limit(1)
    if exclude_user_id:
        q = q.neq("user_id", exclude_user_id)
    res = q.execute()
    rows = getattr(res, "data", None) or []
    return bool(rows)


def generate_unique_referral_code(*, exclude_user_id: str | None = None) -> str:
    """Random 6-digit code, unique across vendors."""
    for _ in range(50):
        candidate = f"{secrets.randbelow(1_000_000):06d}"
        if not _code_taken(candidate, exclude_user_id=exclude_user_id):
            return candidate
    raise RuntimeError("Could not allocate a unique referral code")


def get_vendor_referral_code(user_id: str) -> str | None:
    uid = str(user_id or "").strip()
    if not uid:
        return None
    res = (
        get_db()
        .table("vendors")
        .select("client_referral_code")
        .eq("user_id", uid)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    code = normalize_client_referral_code(rows[0].get("client_referral_code"))
    return code


def set_vendor_referral_code(user_id: str, raw_code: str | None, *, generate: bool = False) -> str:
    """
    Set or generate a referral code for an approved vendor.

    Raises ValueError with a user-facing message when invalid or taken.
    """
    from app.features.vendor_referrals import messages as referral_messages

    uid = str(user_id or "").strip()
    if not uid:
        raise ValueError(referral_messages.REFERRAL_NOT_FOUND)

    res = (
        get_db()
        .table("vendors")
        .select("user_id,approval_status,client_referral_code")
        .eq("user_id", uid)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        raise ValueError(referral_messages.REFERRAL_NOT_FOUND)
    row = rows[0]
    if str(row.get("approval_status") or "") != "approved":
        raise ValueError(referral_messages.REFERRAL_NOT_FOUND)

    if generate or not (raw_code and str(raw_code).strip()):
        code = generate_unique_referral_code(exclude_user_id=uid)
    else:
        code = normalize_client_referral_code(raw_code)
        if not code:
            raise ValueError(referral_messages.REFERRAL_CODE_FORMAT_INVALID)
        if _code_taken(code, exclude_user_id=uid):
            raise ValueError(referral_messages.REFERRAL_CODE_TAKEN)

    try:
        get_db().table("vendors").update({"client_referral_code": code}).eq("user_id", uid).execute()
    except Exception:
        logger.exception("set_vendor_referral_code failed user=%s", uid)
        raise ValueError(referral_messages.REFERRAL_NOT_FOUND) from None
    return code


def get_vendor_referral_row_by_code(code: str) -> dict[str, Any] | None:
    normalized = normalize_client_referral_code(code)
    if not normalized:
        return None
    res = (
        get_db()
        .table("vendors")
        .select("user_id,client_referral_code,client_referral_enabled,approval_status")
        .eq("client_referral_code", normalized)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return rows[0]
