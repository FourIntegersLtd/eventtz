"""Shared display-name and email lookups for users and vendors."""

from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger
from app.features.auth import db_users as user_repository
from app.features.auth import db_vendors as vendor_repository

logger = get_logger(__name__)


def vendor_display_names_by_id(vendor_ids: list[str]) -> dict[str, str]:
    if not vendor_ids or get_settings().local_auth_mode:
        return {}
    try:
        vendor_rows = vendor_repository.list_by_user_ids(vendor_ids)
    except Exception:
        logger.exception("user_lookup: batch load vendor display names failed")
        return {}
    out: dict[str, str] = {}
    for row in vendor_rows:
        uid = str(row.get("user_id") or "")
        if not uid:
            continue
        payload = row.get("payload")
        name = "Vendor"
        if isinstance(payload, dict):
            bn = payload.get("businessName")
            if isinstance(bn, str) and bn.strip():
                name = bn.strip()
        out[uid] = name
    return out


def user_emails_by_id(user_ids: list[str], *, fallback: str = "Client") -> dict[str, str]:
    if not user_ids or get_settings().local_auth_mode:
        return {}
    try:
        user_rows = user_repository.list_by_ids(user_ids, columns="id,email")
    except Exception:
        logger.exception("user_lookup: batch load user emails failed")
        return {}
    out: dict[str, str] = {}
    for row in user_rows:
        uid = str(row.get("id") or "")
        if not uid:
            continue
        em = row.get("email")
        out[uid] = str(em).strip() if em else fallback
    return out


def client_emails_by_id(user_ids: list[str]) -> dict[str, str | None]:
    """Booking list enrichment — returns None when email missing."""
    if not user_ids or get_settings().local_auth_mode:
        return {}
    try:
        user_rows = user_repository.list_by_ids(user_ids, columns="id,email")
    except Exception:
        logger.exception("user_lookup: batch load client emails failed")
        return {}
    return {str(row["id"]): row.get("email") for row in user_rows if row.get("id")}
