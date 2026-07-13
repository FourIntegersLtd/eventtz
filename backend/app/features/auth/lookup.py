"""Shared display-name and email lookups for users and vendors."""

from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger
from app.features.auth import db_users as user_repository
from app.features.auth import db_vendors as vendor_repository

logger = get_logger(__name__)

# Cached after first PostgREST 42703 — avoids log spam when migration 035 is not applied yet.
_preferred_name_column_ok: bool | None = None


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


def _friendly_name_from_email(email: str | None) -> str | None:
    if not email or "@" not in email:
        return None
    local = email.split("@", 1)[0].strip()
    if not local:
        return None
    # "jane.doe_92" -> "Jane Doe"
    words = [w for w in local.replace(".", " ").replace("_", " ").replace("-", " ").split() if w]
    cleaned = " ".join(w.capitalize() for w in words if not w.isdigit())
    return cleaned or None


def client_display_names_by_id(user_ids: list[str]) -> dict[str, str]:
    """Friendly, non-PII client names for vendor-facing surfaces.

    Prefers users.preferred_name, falls back to a capitalised email
    local-part, then "Client". Never returns the raw email address.
    """
    global _preferred_name_column_ok
    if not user_ids or get_settings().local_auth_mode:
        return {}
    columns = "id,email,preferred_name" if _preferred_name_column_ok is not False else "id,email"
    try:
        user_rows = user_repository.list_by_ids(user_ids, columns=columns)
        if _preferred_name_column_ok is None:
            _preferred_name_column_ok = True
    except Exception as e:
        if _preferred_name_column_ok is not False and "preferred_name" in str(e).lower():
            _preferred_name_column_ok = False
            logger.warning(
                "client_display_names_by_id: run backend/sql/035_client_preferred_name.sql — %s", e
            )
            return client_display_names_by_id(user_ids)
        logger.exception("user_lookup: batch load client display names failed")
        return {}
    out: dict[str, str] = {}
    for row in user_rows:
        uid = str(row.get("id") or "")
        if not uid:
            continue
        pn = row.get("preferred_name")
        if isinstance(pn, str) and pn.strip():
            out[uid] = pn.strip()
            continue
        out[uid] = _friendly_name_from_email(row.get("email")) or "Client"
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
