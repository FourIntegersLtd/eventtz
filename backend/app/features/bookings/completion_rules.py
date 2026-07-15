"""When the vendor gets paid after the event.

The vendor is paid when both parties confirm completion (see payments.py), or
automatically BOOKING_PAYOUT_AUTO_RELEASE_HOURS_AFTER_EVENT hours after the
event ends, if the client has paid and no problem report is open.

No database or Stripe imports here — payments.py and queries.py both use these
functions without pulling each other in at import time.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from app.core.config import get_settings


def _event_day_end_utc(row: dict[str, Any]) -> datetime | None:
    """Start of the day after the event (uses event_end_date for multi-day events)."""
    date_str = str(row.get("event_end_date") or row.get("event_date") or "")[:10]
    try:
        event_day = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    return event_day + timedelta(days=1)


def compute_payout_auto_release_at(row: dict[str, Any]) -> datetime | None:
    """When the held payment auto-releases to the vendor, or None if not applicable."""
    if str(row.get("status") or "") != "accepted":
        return None
    if str(row.get("payment_status") or "") != "paid":
        return None
    day_end = _event_day_end_utc(row)
    if day_end is None:
        return None
    hours = get_settings().booking_payout_auto_release_hours_after_event
    return day_end + timedelta(hours=hours)


def event_day_over(row: dict[str, Any], now: datetime | None = None) -> bool:
    day_end = _event_day_end_utc(row)
    if day_end is None:
        return False
    return (now or datetime.now(timezone.utc)) >= day_end


def completion_waiting_on(row: dict[str, Any]) -> str | None:
    """Who still needs to confirm completion: 'client' | 'vendor' | 'both' | None."""
    if str(row.get("status") or "") != "accepted":
        return None
    if str(row.get("payment_status") or "") != "paid":
        return None
    client_done = bool(row.get("client_completion_confirmed_at"))
    vendor_done = bool(row.get("vendor_completion_confirmed_at"))
    if client_done and vendor_done:
        return None
    if not client_done and not vendor_done:
        return "both"
    return "client" if not client_done else "vendor"
