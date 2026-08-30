"""Booking status changes for clients and vendors (accept, decline, cancel).

Vendor and client transitions live in sibling modules; this file re-exports the public API.
"""

from __future__ import annotations

from app.features.bookings.status_client import (
    cancel_booking_request_for_client,
    update_booking_request_status_for_client,
)
from app.features.bookings.status_shared import (
    assert_booking_may_be_cancelled,
    cancel_audit_fields,
    expire_pending_checkout_session,
    refund_paid_booking_before_cancel,
    vendor_connect_can_receive_payouts,
)
from app.features.bookings.status_vendor import (
    update_booking_request_status_for_vendor,
)

# Compatibility aliases for tests and admin recovery until all call sites use the new names.
_cancel_audit_fields = cancel_audit_fields
_expire_pending_checkout = expire_pending_checkout_session
_guard_cancel_money_state = assert_booking_may_be_cancelled
_refund_paid_booking_for_cancel = refund_paid_booking_before_cancel
_vendor_payouts_ready = vendor_connect_can_receive_payouts

__all__ = [
    "assert_booking_may_be_cancelled",
    "cancel_audit_fields",
    "cancel_booking_request_for_client",
    "expire_pending_checkout_session",
    "refund_paid_booking_before_cancel",
    "update_booking_request_status_for_client",
    "update_booking_request_status_for_vendor",
    "vendor_connect_can_receive_payouts",
    "_cancel_audit_fields",
    "_expire_pending_checkout",
    "_guard_cancel_money_state",
    "_refund_paid_booking_for_cancel",
    "_vendor_payouts_ready",
]
