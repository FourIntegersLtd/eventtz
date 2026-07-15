"""Saved vendors for clients (favourites)."""

from __future__ import annotations

from app.core.config import get_settings
from app.core.db import apply_recent_first_order, get_db as get_client
from app.core.logging import get_logger

logger = get_logger(__name__)


def list_saved_vendor_ids(client_user_id: str) -> list[str]:
    if get_settings().local_auth_mode:
        return []
    try:
        res = (
            apply_recent_first_order(
                get_client()
                .table("client_saved_vendors")
                .select("vendor_user_id")
                .eq("client_user_id", client_user_id),
                column="created_at",
            )
            .execute()
        )
    except Exception as e:
        if "42p01" in str(e).lower() or "client_saved_vendors" in str(e).lower():
            logger.warning("list_saved_vendor_ids: run migration 041 — %s", e)
            return []
        logger.warning("list_saved_vendor_ids failed: %s", e, exc_info=True)
        return []
    out: list[str] = []
    for row in getattr(res, "data", None) or []:
        if isinstance(row, dict) and row.get("vendor_user_id"):
            out.append(str(row["vendor_user_id"]))
    return out


def add_saved_vendor(*, client_user_id: str, vendor_user_id: str) -> bool:
    if get_settings().local_auth_mode:
        return False
    if not client_user_id or not vendor_user_id:
        return False
    try:
        get_client().table("client_saved_vendors").upsert(
            {"client_user_id": client_user_id, "vendor_user_id": vendor_user_id},
            on_conflict="client_user_id,vendor_user_id",
        ).execute()
        return True
    except Exception as e:
        if "42p01" in str(e).lower():
            logger.warning("add_saved_vendor: run migration 041")
            return False
        logger.warning("add_saved_vendor failed: %s", e, exc_info=True)
        return False


def remove_saved_vendor(*, client_user_id: str, vendor_user_id: str) -> bool:
    if get_settings().local_auth_mode:
        return False
    try:
        get_client().table("client_saved_vendors").delete().eq(
            "client_user_id", client_user_id
        ).eq("vendor_user_id", vendor_user_id).execute()
        return True
    except Exception as e:
        if "42p01" in str(e).lower():
            return False
        logger.warning("remove_saved_vendor failed: %s", e, exc_info=True)
        return False


def merge_saved_vendors(*, client_user_id: str, vendor_user_ids: list[str]) -> int:
    """Merge local IDs into server favourites. Returns how many were added."""
    if get_settings().local_auth_mode or not vendor_user_ids:
        return 0
    merged = 0
    for vid in vendor_user_ids:
        v = (vid or "").strip()
        if not v:
            continue
        if add_saved_vendor(client_user_id=client_user_id, vendor_user_id=v):
            merged += 1
    return merged
