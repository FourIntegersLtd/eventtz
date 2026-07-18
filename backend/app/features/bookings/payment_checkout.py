"""Stripe Checkout session creation for accepted bookings."""

from __future__ import annotations

from app.core.config import get_settings
from app.features.bookings.payment_shared import _get_vendor_stripe_fields, get_client
from app.features.bookings.pricing_refresh import refresh_booking_pricing
from app.features.payments import stripe as stripe_service
from app.features.vendors.moderation import get_approved_vendor_payload


def create_checkout_session_for_booking(client_user_id: str, booking_id: str) -> str:
    """Validate + recompute pricing server-side, then return a Stripe Checkout URL."""
    if get_settings().local_auth_mode:
        raise ValueError("Payments are not available in local auth mode.")

    db = get_client()
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
        raise ValueError("Booking not found.")
    row = rows[0]

    if str(row.get("status") or "") != "accepted":
        raise ValueError("Only accepted bookings can be paid.")
    if str(row.get("payment_status") or "unpaid") not in ("unpaid", "pending"):
        raise ValueError("This booking has already been paid.")

    vendor_id = str(row.get("vendor_user_id") or "")
    vendor_stripe = _get_vendor_stripe_fields(vendor_id) or {}
    if not vendor_stripe.get("stripe_account_id") or not vendor_stripe.get("stripe_charges_enabled"):
        raise ValueError(
            "This vendor hasn't finished setting up payouts yet. Try again once they have.",
        )

    line_items = row.get("line_items")
    if not isinstance(line_items, list):
        line_items = []

    vendor_payload = get_approved_vendor_payload(vendor_id)
    if not vendor_payload:
        raise ValueError(
            "This vendor is not available for booking right now.",
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
        raise ValueError("Nothing to pay for this booking.")

    ea = row.get("event_address")
    if not (isinstance(ea, str) and ea.strip()):
        raise ValueError(
            "Add your event address on the booking before paying. Your vendor needs it to prepare.",
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
    from app.features.bookings.funnel import mark_payment_requested

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
