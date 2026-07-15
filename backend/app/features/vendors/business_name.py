"""Check vendor business names are unique (compared case-insensitively)."""

from __future__ import annotations

import re
from typing import Any

from postgrest.exceptions import APIError

from app.core.config import get_settings
from app.core.db import get_db as get_client, local_vendors, one_row, rows
from app.core.errors import ConflictError

_NORMALIZE_RE = re.compile(r"\s+")


def normalize_business_name(name: str) -> str:
    """Trim, lowercase, and collapse repeated spaces."""
    return _NORMALIZE_RE.sub(" ", name.strip().lower())


def business_name_from_payload(payload: dict[str, Any]) -> str | None:
    raw = payload.get("businessName")
    if not isinstance(raw, str):
        return None
    norm = normalize_business_name(raw)
    return norm or None


def find_business_name_owner_user_id(
    normalized: str,
    *,
    exclude_user_id: str | None = None,
) -> str | None:
    if not normalized:
        return None

    if get_settings().local_auth_mode:
        for uid, row in local_vendors.items():
            if exclude_user_id and uid == exclude_user_id:
                continue
            payload = row.get("payload")
            if not isinstance(payload, dict):
                continue
            other = business_name_from_payload(payload)
            if other == normalized:
                return uid
        return None

    try:
        q = (
            get_client()
            .table("vendors")
            .select("user_id")
            .eq("business_name_normalized", normalized)
            .limit(1)
        )
        if exclude_user_id:
            q = q.neq("user_id", exclude_user_id)
        row = one_row(q.execute())
        if row and row.get("user_id"):
            return str(row["user_id"])
    except APIError as err:
        if not _is_missing_business_name_normalized_column(err):
            raise
        return _find_owner_by_payload_scan(normalized, exclude_user_id=exclude_user_id)

    return None


def is_business_name_available(name: str, *, exclude_user_id: str | None = None) -> bool:
    norm = normalize_business_name(name)
    if not norm:
        return True
    return find_business_name_owner_user_id(norm, exclude_user_id=exclude_user_id) is None


def assert_business_name_available(payload: dict[str, Any], user_id: str) -> None:
    norm = business_name_from_payload(payload)
    if not norm:
        return
    owner = find_business_name_owner_user_id(norm, exclude_user_id=user_id)
    if owner:
        raise ConflictError("This business name is already registered.")


def is_business_name_unique_violation(err: Exception) -> bool:
    if not isinstance(err, APIError):
        return False
    code = getattr(err, "code", None)
    msg = str(err)
    return code == "23505" and "business_name_normalized" in msg


def _find_owner_by_payload_scan(
    normalized: str,
    *,
    exclude_user_id: str | None = None,
) -> str | None:
    res = get_client().table("vendors").select("user_id,payload").execute()
    for row in rows(res):
        uid = str(row.get("user_id") or "")
        if exclude_user_id and uid == exclude_user_id:
            continue
        payload = row.get("payload")
        if not isinstance(payload, dict):
            continue
        other = business_name_from_payload(payload)
        if other == normalized:
            return uid
    return None


def _is_missing_business_name_normalized_column(err: APIError) -> bool:
    code = getattr(err, "code", None)
    msg = str(err)
    return code == "42703" and "business_name_normalized" in msg
