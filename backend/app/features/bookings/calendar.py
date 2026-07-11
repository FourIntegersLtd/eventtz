"""Vendor calendar availability and chat eligibility."""

from __future__ import annotations

from datetime import date

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.features.vendors.moderation import (
    get_approved_vendor_payload,
    list_approved_vendors_for_explore,
)
from app.features.vendors.search import assert_vendor_payload_allows_event_dates

logger = get_logger(__name__)


def _vendor_is_approved_for_explore(vendor_user_id: str) -> bool:
    rows = list_approved_vendors_for_explore()
    for r in rows:
        if str(r.get("user_id")) == vendor_user_id:
            return True
    return False


def _enforce_vendor_calendar(
    vendor_user_id: str,
    event_date: date,
    event_end_date: date | None,
) -> None:
    """Blocked dates + available weekdays from vendor onboarding (same rules as explore search)."""
    if get_settings().local_auth_mode:
        return
    payload = get_approved_vendor_payload(vendor_user_id)
    if not payload:
        raise ValueError(
            "This vendor is not available for booking right now. "
            "They may be unlisted or not yet approved.",
        )
    assert_vendor_payload_allows_event_dates(
        payload,
        event_date=event_date,
        event_end_date=event_end_date,
    )


def vendor_can_initiate_chat(*, vendor_user_id: str, client_user_id: str) -> bool:
    """True when vendor and client have any booking relationship."""
    if get_settings().local_auth_mode:
        return False
    vid = (vendor_user_id or "").strip()
    cid = (client_user_id or "").strip()
    if not vid or not cid:
        return False
    try:
        res = (
            get_client()
            .table("booking_requests")
            .select("id")
            .eq("vendor_user_id", vid)
            .eq("client_user_id", cid)
            .limit(1)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        return bool(rows)
    except Exception:
        logger.exception("vendor_can_initiate_chat failed vendor=%s client=%s", vid, cid)
        return False
