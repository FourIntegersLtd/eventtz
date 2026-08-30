"""Shared cancel/refund guards used by vendor and client booking status transitions."""

from __future__ import annotations

from datetime import datetime, timezone

from app.features.bookings import messages as booking_messages
from app.features.bookings.booking_payment_helpers import _get_vendor_stripe_fields
from app.features.vendors.visibility import payout_gate_waived

def expire_pending_checkout_session(payment_status: str, checkout_session_id: str | None) -> None:
    """Close an in-flight Checkout Session so a cancelled booking cannot still be paid."""
    if payment_status != "pending":
        return
    from app.features.payments.stripe import expire_checkout_session

    expire_checkout_session(checkout_session_id)


def assert_booking_may_be_cancelled(booking_id: str, *, status: str, payment_status: str) -> None:
    """Shared checks before cancel: not after payout, not while a problem report is open."""
    if status == "completed":
        raise ValueError(
            booking_messages.CANCEL_COMPLETE_INSTEAD,
        )
    if payment_status == "payout_released":
        raise ValueError(
            booking_messages.CANCEL_AFTER_PAYOUT,
        )
    if payment_status == "partially_refunded":
        raise ValueError(
            booking_messages.CANCEL_PARTIAL_REFUND,
        )
    if payment_status == "refunded" and status != "accepted":
        raise ValueError(booking_messages.BOOKING_ALREADY_REFUNDED)
    # Import here to avoid a circular import at module load.
    from app.features.bookings.disputes import has_active_dispute_for_booking

    if has_active_dispute_for_booking(booking_id):
        raise ValueError(
            booking_messages.CANCEL_OPEN_DISPUTE,
        )


def refund_paid_booking_before_cancel(booking_id: str, payment_status: str, *, cancelled_by: str) -> bool:
    """Full refund before cancelling a paid booking. Returns True if a refund was issued."""
    if payment_status != "paid":
        return False
    # Import here to avoid a circular import at module load.
    from app.features.bookings.payments import refund_booking_on_cancel

    refund_booking_on_cancel(booking_id, cancelled_by=cancelled_by)
    return True


def cancel_audit_fields(cancelled_by: str) -> dict[str, str]:
    return {
        "cancelled_by": cancelled_by,
        "cancelled_at": datetime.now(timezone.utc).isoformat(),
    }


def vendor_connect_can_receive_payouts(vendor_user_id: str) -> bool:
    """True when Stripe Connect can charge and pay out (required before accept).

    Why gate here: Accept is when Eventtz commits to Collect + Transfer, so customers
    never wait on Connect mid-pay. An admin listing waiver lifts the gate for a vendor
    vetted another way - the client's money is still held by Eventtz until completion.
    """
    row = _get_vendor_stripe_fields(vendor_user_id)
    if row is None:
        return False
    if payout_gate_waived(row):
        return True
    return bool(
        row.get("stripe_account_id")
        and row.get("stripe_charges_enabled")
        and row.get("stripe_payouts_enabled")
    )


