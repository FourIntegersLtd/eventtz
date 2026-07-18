"""Booking payment refunds (cancel and admin)."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.features.bookings.payment_shared import (
    _notify_pair,
    get_client,
    logger,
)
from app.features.email.dispatch import (
    dispatch_booking_notification,
    send_admin_refund_failed_email,
)
from app.features.payments import stripe as stripe_service


def _refund_paid_booking_row(
    row: dict[str, Any],
    *,
    amount_gbp: float | None,
    idempotency_suffix: str,
    refund_body: str,
) -> dict[str, Any]:
    """Refund a paid booking via Stripe and update payment_status.

    Used for admin refunds and cancellation refunds. Raises ValueError with a
    user-friendly message when the refund fails — callers must not change booking
    state if that happens.
    """
    booking_id = str(row.get("id") or "")
    if str(row.get("payment_status") or "") != "paid":
        raise ValueError("Only paid bookings can be refunded.")
    pi_id = row.get("stripe_payment_intent_id")
    if not pi_id:
        raise ValueError("No payment on record for this booking.")

    try:
        stripe_service.create_refund(
            payment_intent_id=str(pi_id),
            booking_id=booking_id,
            amount_gbp=amount_gbp,
            idempotency_suffix=idempotency_suffix,
        )
    except Exception as e:
        logger.exception("Stripe refund failed booking=%s", booking_id)
        send_admin_refund_failed_email(booking_id=booking_id, error_hint=str(e)[:500])
        raise ValueError("We couldn't process the refund right now. Please try again shortly.") from e

    new_status = "partially_refunded" if amount_gbp is not None else "refunded"
    upd = (
        get_client()
        .table("booking_requests")
        .update({"payment_status": new_status})
        .eq("id", booking_id)
        .eq("payment_status", "paid")
        .execute()
    )
    updated = getattr(upd, "data", None) or []
    final_row = updated[0] if updated and isinstance(updated[0], dict) else {**row, "payment_status": new_status}
    from app.features.bookings.funnel import mark_refunded

    mark_refunded(booking_id)

    client_id = str(final_row.get("client_user_id") or "")
    vendor_id = str(final_row.get("vendor_user_id") or "")
    if client_id:
        dispatch_booking_notification(
            user_id=client_id,
            booking_id=booking_id,
            kind="payment_refunded",
            body=refund_body,
        )
    _notify_pair(client_id, vendor_id)
    return final_row


def refund_booking_on_cancel(booking_id: str, *, cancelled_by: str) -> dict[str, Any] | None:
    """Full refund when a paid booking is cancelled before the vendor is paid.

    Raises ValueError when the refund fails — the caller must not cancel the
    booking in that case. Refund the money first, then change status.
    """
    if get_settings().local_auth_mode:
        return None
    res = get_client().table("booking_requests").select("*").eq("id", booking_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return _refund_paid_booking_row(
        rows[0],
        amount_gbp=None,
        idempotency_suffix=f"cancel-{cancelled_by}",
        refund_body=(
            "This booking was cancelled. Your payment has been refunded in full.\n\n"
            "It should reach your card within 5–10 working days, depending on your bank."
        ),
    )


def admin_refund_booking(booking_id: str, *, amount_gbp: float | None) -> dict[str, Any] | None:
    """Admin problem-report resolution: full refund (amount_gbp=None) or partial (amount_gbp set)."""
    if get_settings().local_auth_mode:
        return None
    res = get_client().table("booking_requests").select("*").eq("id", booking_id).limit(1).execute()
    rows = getattr(res, "data", None) or []
    if not rows or not isinstance(rows[0], dict):
        return None
    return _refund_paid_booking_row(
        rows[0],
        amount_gbp=amount_gbp,
        idempotency_suffix="partial" if amount_gbp is not None else "full",
        refund_body="Your payment for this booking was refunded.\n\nIt should reach your card within 5–10 working days, depending on your bank.",
    )
