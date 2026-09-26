"""Marketplace funnel events (profile views, enquiries, payments…), for staff analytics.

Other slices record events through `record_marketplace_event`. Recording is best
effort: a failed insert is logged and never fails the caller's request.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.features.marketplace import repository

log = get_logger(__name__)

# The event names the database accepts (its CHECK constraint). The baseline also sent two
# `celebration_plan_*` names the constraint rejects, so those were never stored; they are left out.
ALLOWED_EVENTS = frozenset(
    {
        "vendor_profile_viewed",
        "enquiry_created",
        "vendor_notified",
        "vendor_message_sent",
        "vendor_accepted_booking",
        "vendor_declined_booking",
        "customer_started_payment",
        "customer_payment_completed",
        "booking_completed",
        "booking_cancelled",
        "review_submitted",
        "enquiry_unfulfilled",
        "enquiry_vendor_reminded",
        "enquiry_client_no_response_nudge",
        "enquiry_multi_created",
    }
)
# Longest category or location stored with an event.
_LABEL_MAX = 120


async def record_marketplace_event(
    session: AsyncSession,
    event_name: str,
    *,
    actor_user_id: str | None = None,
    vendor_user_id: str | None = None,
    booking_request_id: str | None = None,
    category: str | None = None,
    location: str | None = None,
    booking_value_gbp: float | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    """Store one funnel event. Unknown names are ignored; failures are logged, never raised."""
    if event_name not in ALLOWED_EVENTS:
        return
    values: dict[str, Any] = {
        "event_name": event_name,
        "payload": payload if isinstance(payload, dict) else {},
    }
    if actor_user_id:
        values["actor_user_id"] = actor_user_id
    if vendor_user_id:
        values["vendor_user_id"] = vendor_user_id
    if booking_request_id:
        values["booking_request_id"] = booking_request_id
    if category:
        values["category"] = category[:_LABEL_MAX]
    if location:
        values["location"] = location[:_LABEL_MAX]
    if booking_value_gbp is not None:
        values["booking_value_gbp"] = round(float(booking_value_gbp), 2)
    try:
        if not await repository.insert_event(session, values):
            log.warning("marketplace_events: insert rejected event=%s", event_name)
    except Exception:
        log.exception("marketplace_events: insert failed event=%s", event_name)
