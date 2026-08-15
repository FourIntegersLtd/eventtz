"""Referral partner CRUD and lookup."""

from __future__ import annotations

from typing import Any

from app.core.db import get_db
from app.core.logging import get_logger
from app.features.referrals.links import referral_register_url
from app.features.referrals import messages as referral_messages
from app.features.referrals.slug import is_valid_slug, normalize_slug, slugify_display_name

logger = get_logger(__name__)


def _row_to_partner(row: dict[str, Any]) -> dict[str, Any]:
    slug = str(row.get("slug") or "")
    return {
        "id": str(row.get("id") or ""),
        "slug": slug,
        "display_name": str(row.get("display_name") or ""),
        "instagram_handle": row.get("instagram_handle"),
        "notes": row.get("notes"),
        "is_active": bool(row.get("is_active", True)),
        "referral_link": referral_register_url(slug),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def resolve_unique_slug(*, display_name: str, preferred: str | None = None) -> str:
    base = normalize_slug(preferred.strip()) if preferred and preferred.strip() else slugify_display_name(display_name)
    if not is_valid_slug(base):
        raise ValueError(referral_messages.INVALID_SLUG)
    client = get_db()
    candidate = base
    suffix = 2
    while True:
        res = client.table("referral_partners").select("id").eq("slug", candidate).limit(1).execute()
        rows = getattr(res, "data", None) or []
        if not rows:
            return candidate
        candidate = f"{base}-{suffix}"
        suffix += 1


def get_active_partner_by_slug(slug: str) -> dict[str, Any] | None:
    normalized = normalize_slug(slug)
    if not is_valid_slug(normalized):
        return None
    try:
        res = (
            get_db()
            .table("referral_partners")
            .select("id, slug, display_name, is_active")
            .eq("slug", normalized)
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
    except Exception as e:
        logger.warning("get_active_partner_by_slug failed slug=%s: %s", normalized, e)
        return None
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return rows[0]


def list_partners() -> list[dict[str, Any]]:
    res = (
        get_db()
        .table("referral_partners")
        .select("id, slug, display_name, instagram_handle, notes, is_active, created_at, updated_at")
        .order("created_at", desc=True)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    return [_row_to_partner(r) for r in rows if isinstance(r, dict)]


def get_partner_by_id(partner_id: str) -> dict[str, Any] | None:
    res = (
        get_db()
        .table("referral_partners")
        .select("id, slug, display_name, instagram_handle, notes, is_active, created_at, updated_at")
        .eq("id", partner_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return _row_to_partner(rows[0])


def create_partner(
    *,
    display_name: str,
    instagram_handle: str | None = None,
    slug: str | None = None,
    notes: str | None = None,
    created_by_admin_id: str | None = None,
) -> dict[str, Any]:
    name = display_name.strip()
    if not name:
        raise ValueError(referral_messages.DISPLAY_NAME_REQUIRED)
    unique_slug = resolve_unique_slug(display_name=name, preferred=slug)
    row: dict[str, Any] = {
        "slug": unique_slug,
        "display_name": name,
        "instagram_handle": (instagram_handle or "").strip() or None,
        "notes": (notes or "").strip() or None,
        "is_active": True,
    }
    if created_by_admin_id:
        row["created_by_admin_id"] = created_by_admin_id
    res = get_db().table("referral_partners").insert(row).execute()
    data = getattr(res, "data", None) or []
    if data and isinstance(data[0], dict):
        return _row_to_partner(data[0])
    fetched = get_partner_by_slug(unique_slug)
    if not fetched:
        raise ValueError(referral_messages.CREATE_PARTNER_FAILED)
    return fetched


def get_partner_by_slug(slug: str) -> dict[str, Any] | None:
    res = (
        get_db()
        .table("referral_partners")
        .select("id, slug, display_name, instagram_handle, notes, is_active, created_at, updated_at")
        .eq("slug", slug)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return _row_to_partner(rows[0])


def update_partner(
    partner_id: str,
    *,
    display_name: str | None = None,
    instagram_handle: str | None = None,
    notes: str | None = None,
    is_active: bool | None = None,
) -> dict[str, Any] | None:
    patch: dict[str, Any] = {}
    if display_name is not None:
        name = display_name.strip()
        if not name:
            raise ValueError(referral_messages.DISPLAY_NAME_EMPTY)
        patch["display_name"] = name
    if instagram_handle is not None:
        patch["instagram_handle"] = instagram_handle.strip() or None
    if notes is not None:
        patch["notes"] = notes.strip() or None
    if is_active is not None:
        patch["is_active"] = is_active
    if not patch:
        raise ValueError(referral_messages.NO_FIELDS_TO_UPDATE)
    res = get_db().table("referral_partners").update(patch).eq("id", partner_id).execute()
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        return None
    return _row_to_partner(data[0])
