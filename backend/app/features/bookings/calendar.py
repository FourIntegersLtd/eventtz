"""Vendor calendar availability and chat eligibility."""

from __future__ import annotations

from datetime import date
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.db import get_db as get_client
from app.features.vendors.moderation import (
    get_approved_vendor_payload,
    vendor_is_bookable_for_explore,
)
from app.features.vendors.payload_validation import MAX_MAX_BOOKINGS_PER_DAY, MIN_MAX_BOOKINGS_PER_DAY
from app.features.vendors.list_pricing import parse_money_gbp
from app.features.vendors.search import assert_vendor_payload_allows_event_dates, iso_dates_in_event_range

logger = get_logger(__name__)

BOOKING_CAPACITY_DB_MARKER = "vendor_daily_capacity_exceeded"


def booking_capacity_error_from_db(exc: BaseException) -> ValueError | None:
    """Map Postgres trigger rejection to a client-safe booking error."""
    msg = str(exc)
    if BOOKING_CAPACITY_DB_MARKER not in msg:
        return None
    parts = msg.split(":")
    day_iso = parts[1] if len(parts) > 1 else None
    cap = parts[2] if len(parts) > 2 else None
    if day_iso and cap:
        return ValueError(
            f"This vendor already has the maximum number of bookings ({cap}) "
            f"on {day_iso}. Choose another date or contact the vendor.",
        )
    return ValueError(
        "This vendor already has the maximum number of bookings on that date. "
        "Choose another date or contact the vendor.",
    )


def rethrow_booking_capacity_db_error(exc: BaseException) -> None:
    mapped = booking_capacity_error_from_db(exc)
    if mapped is not None:
        raise mapped from exc
    raise exc


def _parse_max_bookings_from_payload(payload: dict[str, Any]) -> int:
    raw = payload.get("maxBookingsPerDay")
    s = str(raw).strip() if raw is not None else "1"
    n = parse_money_gbp(s)
    if n is None:
        return MIN_MAX_BOOKINGS_PER_DAY
    return max(MIN_MAX_BOOKINGS_PER_DAY, min(MAX_MAX_BOOKINGS_PER_DAY, int(n)))


def _vendor_is_approved_for_explore(vendor_user_id: str) -> bool:
    return vendor_is_bookable_for_explore(vendor_user_id)


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


def _booking_overlaps_day(
    row_event_date: str,
    row_event_end: str | None,
    day_iso: str,
) -> bool:
    start = row_event_date[:10]
    end = (row_event_end or row_event_date)[:10]
    return start <= day_iso <= end


def _enforce_max_bookings_per_day(
    vendor_user_id: str,
    payload: dict[str, Any],
    event_date: date,
    event_end_date: date | None,
    *,
    exclude_booking_id: str | None = None,
) -> None:
    """Reject when any day in the event range is at the vendor's daily cap."""
    if get_settings().local_auth_mode:
        return

    cap = _parse_max_bookings_from_payload(payload)
    days = iso_dates_in_event_range(event_date, event_end_date)

    try:
        res = (
            get_client()
            .table("booking_requests")
            .select("id,event_date,event_end_date,status")
            .eq("vendor_user_id", vendor_user_id)
            .in_("status", ["pending", "accepted"])
            .execute()
        )
    except Exception as e:
        logger.warning("_enforce_max_bookings_per_day query failed: %s", e, exc_info=True)
        raise ValueError(
            "Could not verify vendor availability for that date. Please try again.",
        ) from e

    rows = getattr(res, "data", None) or []
    for day_iso in days:
        count = 0
        for row in rows:
            if not isinstance(row, dict):
                continue
            bid = str(row.get("id") or "")
            if exclude_booking_id and bid == exclude_booking_id:
                continue
            ed = str(row.get("event_date") or "")
            ee = row.get("event_end_date")
            ee_str = str(ee) if ee else None
            if _booking_overlaps_day(ed, ee_str, day_iso):
                count += 1
        if count >= cap:
            raise ValueError(
                f"This vendor already has the maximum number of bookings ({cap}) "
                f"on {day_iso}. Choose another date or contact the vendor.",
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
