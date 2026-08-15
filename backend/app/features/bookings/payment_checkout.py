"""Stripe Checkout session creation for accepted bookings."""

from __future__ import annotations

from app.core.config import get_settings
from app.core.db import get_db
from app.features.bookings import messages as booking_messages
from app.features.bookings.booking_payment_helpers import _get_vendor_stripe_fields
from app.features.bookings.pricing_refresh import refresh_booking_pricing
from app.features.payments import stripe as stripe_service
from app.features.vendors.moderation import get_bookable_vendor_profile_form_data
from app.features.vendors.visibility import payout_gate_waived


def create_checkout_session_for_booking(client_user_id: str, booking_id: str) -> str:
    """Validate + recompute pricing server-side, then return a Stripe Checkout URL."""
    db = get_db()
    res = (
        db.table("booking_requests")
        .select("*")
        .eq("id", booking_id)
        .eq("client_user_id", client_user_id)
        .limit(1)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        raise ValueError(booking_messages.BOOKING_NOT_FOUND)
    row = rows[0]

    if str(row.get("status") or "") != "accepted":
        raise ValueError(booking_messages.ONLY_ACCEPTED_CAN_BE_PAID)
    if str(row.get("payment_status") or "unpaid") not in ("unpaid", "pending"):
        raise ValueError(booking_messages.BOOKING_ALREADY_PAID)

    vendor_id = str(row.get("vendor_user_id") or "")
    vendor_stripe = _get_vendor_stripe_fields(vendor_id) or {}
    charges_ready = bool(vendor_stripe.get("stripe_account_id")) and bool(
        vendor_stripe.get("stripe_charges_enabled"),
    )
    # An admin waiver is safe here: Checkout collects into Eventtz's own balance and
    # never touches the vendor's Connect account. Only the completion Transfer does,
    # and that already holds the money until their account is ready.
    if not charges_ready and not payout_gate_waived(vendor_stripe):
        raise ValueError(
            booking_messages.VENDOR_PAYOUTS_NOT_READY,
        )

    line_items = row.get("line_items")
    if not isinstance(line_items, list):
        line_items = []

    vendor_payload = get_bookable_vendor_profile_form_data(vendor_id)
    if not vendor_payload:
        raise ValueError(
            booking_messages.VENDOR_NOT_AVAILABLE_SHORT,
        )

    refreshed = refresh_booking_pricing(row, vendor_payload)
    line_items = refreshed["line_items"]
    pb = refreshed["pricing_breakdown"]

    db.table("booking_requests").update(
        {
            "line_items": line_items,
            "total_label": refreshed["total_label"],
        },
    ).eq("id", booking_id).eq("client_user_id", client_user_id).execute()

    client_total = float(pb["client_total_gbp"])
    vendor_amount = float(pb["vendor_portion_gbp"])
    service_fee = float(pb["service_fee_gbp"])
    if client_total <= 0:
        raise ValueError(booking_messages.NOTHING_TO_PAY)

    ea = row.get("event_address")
    if not (isinstance(ea, str) and ea.strip()):
        raise ValueError(
            booking_messages.ADD_EVENT_ADDRESS_BEFORE_PAY,
        )

    session = stripe_service.create_checkout_session(
        booking_id=booking_id,
        client_total_gbp=client_total,
        vendor_amount_gbp=vendor_amount,
        service_fee_gbp=service_fee,
        vendor_user_id=vendor_id,
        client_user_id=client_user_id,
        description=str(row.get("event_name") or "Eventtz booking"),
    )
    db.table("booking_requests").update(
        {
            "stripe_checkout_session_id": session["id"],
            "payment_status": "pending",
        },
    ).eq("id", booking_id).eq("client_user_id", client_user_id).execute()
    from app.features.bookings.booking_funnel_timestamps import mark_payment_requested

    mark_payment_requested(booking_id)
    try:
        from app.features.analytics.events import record_marketplace_event

        record_marketplace_event(
            "customer_started_payment",
            actor_user_id=client_user_id,
            vendor_user_id=vendor_id,
            booking_request_id=booking_id,
            booking_value_gbp=client_total,
        )
    except Exception:
        pass
    return session["url"]
