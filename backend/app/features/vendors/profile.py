"""Vendor profile CRUD/upsert logic."""

from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client, is_missing_approval_status_column, local_vendors
from app.features.auth.accounts import upsert_user_profile
from app.features.vendors.business_name import (
    assert_business_name_available,
    is_business_name_unique_violation,
)
from app.core.errors import ConflictError
from app.features.vendors.payload_validation import (
    normalize_payload_fields,
    validate_payload_for_progress,
)

logger = get_logger(__name__)

_BIO_MAX_WORDS = 60


def _clamp_bio_words(text: str, max_words: int = _BIO_MAX_WORDS) -> str:
    words = text.strip().split()
    if len(words) <= max_words:
        return text.strip()
    return f"{' '.join(words[:max_words])}…"


def _validate_and_normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Normalize payload fields on save (e.g. cap public bio length)."""
    out = dict(payload)
    raw_bio = out.get("aiBioDraft")
    if isinstance(raw_bio, str) and raw_bio.strip():
        word_count = len(re.findall(r"\S+", raw_bio.strip()))
        if word_count > _BIO_MAX_WORDS:
            logger.info(
                "Clamping vendor bio from %s to %s words on save",
                word_count,
                _BIO_MAX_WORDS,
            )
        out["aiBioDraft"] = _clamp_bio_words(raw_bio)
    return out


def get_vendor_profile(user_id: str) -> dict[str, Any] | None:
    if get_settings().local_auth_mode:
        return local_vendors.get(user_id)
    try:
        res = (
            get_client()
            .table("vendors")
            .select("id,user_id,status,approval_status,current_step,payload,created_at,updated_at")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    except Exception as e:
        if not is_missing_approval_status_column(e):
            raise
        logger.warning("vendors.approval_status missing; run backend/sql/004_vendors_approval_status.sql")
        res = (
            get_client()
            .table("vendors")
            .select("id,user_id,status,current_step,payload,created_at,updated_at")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
    data = getattr(res, "data", None)
    if not data:
        return None
    out = data[0] if isinstance(data, list) else data
    if isinstance(out, dict):
        out.setdefault("approval_status", "pending")
    return out


def upsert_vendor_profile(
    user_id: str,
    *,
    current_step: int,
    payload: dict[str, Any],
    status: str | None = None,
    user_email: str | None = None,
) -> dict[str, Any]:
    existing = get_vendor_profile(user_id)
    previous_step = int(existing.get("current_step") or 1) if existing else 1
    merged_payload: dict[str, Any] = {}
    if existing and isinstance(existing.get("payload"), dict):
        merged_payload.update(existing["payload"])
    merged_payload.update(_validate_and_normalize_payload(payload))
    merged_payload = normalize_payload_fields(merged_payload, user_id)
    st = status or (existing.get("status") if existing else None) or "draft"

    validate_payload_for_progress(
        current_step=current_step,
        previous_step=previous_step,
        payload=merged_payload,
        status=st,
    )

    assert_business_name_available(merged_payload, user_id)

    if get_settings().local_auth_mode:
        prev = local_vendors.get(user_id)
        stable_id = prev.get("id") if prev else str(uuid4())
        approval = prev.get("approval_status") if prev and prev.get("approval_status") else "pending"
        row = {
            "id": stable_id,
            "user_id": user_id,
            "status": st,
            "approval_status": approval,
            "current_step": current_step,
            "payload": merged_payload,
        }
        if user_email is not None:
            row["email"] = user_email.strip().lower()
        elif prev and prev.get("email"):
            row["email"] = prev["email"]
        local_vendors[user_id] = row
        return row

    # FK vendors.user_id -> users.id: ensure public.users row exists before vendors insert/update.
    norm_email = (
        user_email.strip().lower()
        if isinstance(user_email, str) and user_email.strip()
        else None
    )
    upsert_user_profile(user_id, norm_email, "vendor")

    row_out: dict[str, Any] = {
        "user_id": user_id,
        "current_step": current_step,
        "payload": merged_payload,
        "status": st,
    }
    if existing:
        try:
            get_client().table("vendors").update(row_out).eq("user_id", user_id).execute()
        except Exception as e:
            if is_business_name_unique_violation(e):
                raise ConflictError("This business name is already registered.") from e
            raise
    else:
        try:
            get_client().table("vendors").insert(row_out).execute()
        except Exception as e:
            if is_business_name_unique_violation(e):
                raise ConflictError("This business name is already registered.") from e
            raise
    out = get_vendor_profile(user_id)
    if not out:
        raise RuntimeError("vendors upsert returned no row")
    return out
