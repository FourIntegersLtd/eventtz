"""Let clients set the event venue on accepted bookings that are not yet paid."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.db import one_row
from app.core.db import get_db as get_client
from app.features.bookings.notifications import _notify_booking_changed
from app.features.bookings.queries import get_booking_request_for_client


def update_booking_venue_for_client(
    client_user_id: str,
    booking_id: str,
    *,
    event_postcode: str | None = None,
    event_address: str,
) -> dict[str, Any] | None:
    """Set venue address on an accepted, unpaid booking before payment."""
    if get_settings().local_auth_mode:
        return None
    client = get_client()
    res = (
        client.table("booking_requests")
        .select("id,status,payment_status,vendor_user_id")
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .limit(1)
        .execute()
    )
    row = one_row(res)
    if row is None:
        return None
    if str(row.get("status") or "") != "accepted":
        raise ValueError("Venue can only be updated on accepted bookings.")
    if str(row.get("payment_status") or "unpaid") not in ("unpaid", "pending"):
        raise ValueError("This booking has already been paid.")
    addr = event_address.strip()
    if len(addr) < 3:
        raise ValueError("Enter the venue address.")
    patch: dict[str, Any] = {"event_address": addr}
    if event_postcode:
        pc = " ".join(event_postcode.strip().split())
        if len(pc) >= 2:
            patch["event_postcode"] = pc
    client.table("booking_requests").update(patch).eq("id", booking_id).eq(
        "client_user_id", client_user_id
    ).execute()
    vendor_id = str(row.get("vendor_user_id") or "")
    _notify_booking_changed(client_user_id=client_user_id, vendor_user_id=vendor_id)
    return get_booking_request_for_client(client_user_id, booking_id)
