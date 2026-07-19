"""Record marketplace analytics events (profile views, funnel stages)."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.core.logging import get_logger

logger = get_logger(__name__)

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
        "celebration_plan_generated",
        "celebration_plan_recommendation_replaced",
    },
)


def record_marketplace_event(
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
    """Best-effort insert; never raises to callers."""
    if event_name not in ALLOWED_EVENTS:
        return
    if get_settings().local_auth_mode:
        return
    try:
        row: dict[str, Any] = {
            "event_name": event_name,
            "payload": payload if isinstance(payload, dict) else {},
        }
        if actor_user_id:
            row["actor_user_id"] = actor_user_id
        if vendor_user_id:
            row["vendor_user_id"] = vendor_user_id
        if booking_request_id:
            row["booking_request_id"] = booking_request_id
        if category:
            row["category"] = category[:120]
        if location:
            row["location"] = location[:120]
        if booking_value_gbp is not None:
            try:
                row["booking_value_gbp"] = round(float(booking_value_gbp), 2)
            except (TypeError, ValueError):
                pass
        get_client().table("marketplace_events").insert(row).execute()
    except Exception:
        logger.exception("marketplace_events: insert failed event=%s", event_name)
