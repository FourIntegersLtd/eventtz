"""Booking payments: start checkout, record payment, pay the vendor, and refunds.

The booking status (pending, accepted, and so on) is separate from the payment
status (unpaid, paid, refunded, payout released). Money-related fields are updated here.

Implementation is split across sibling modules; this file re-exports the public API.
"""

from __future__ import annotations

from app.core.config import get_settings
from app.core.db import get_db as get_client
from app.features.bookings.payment_checkout import create_checkout_session_for_booking
from app.features.bookings.payment_completion import (
    _confirm_completion,
    _finalize_completion,
    _serialize_completion_state,
    admin_release_payout_for_booking,
    confirm_completion_for_client,
    confirm_completion_for_vendor,
)
from app.features.bookings.payment_finalize import (
    _clear_stale_checkout_session,
    _finalize_booking_payment_from_checkout_session,
    _mark_webhook_event_processed,
    _payment_fields_from_checkout_session,
    handle_account_updated,
    handle_checkout_session_completed,
    sync_checkout_payment_for_client,
)
from app.features.bookings.payment_maintenance import (
    LIST_COMPLETION_TOUCH_CAP,
    _auto_release_payout_row,
    _due_completion_candidates,
    _format_release_date,
    maybe_auto_release_payout_for_booking,
    maybe_send_completion_reminder_for_row,
    process_due_payout_auto_releases,
    send_completion_reminders,
    touch_booking_completion_side_effects,
    touch_completion_side_effects_for_booking_rows,
)
from app.features.bookings.payment_refunds import (
    _refund_paid_booking_row,
    admin_refund_booking,
    refund_booking_on_cancel,
)
from app.features.bookings.payment_shared import (
    _get_vendor_stripe_fields,
    _load_full_booking_row,
    _notify_pair,
    _now_iso,
    logger,
)
from app.features.bookings.queries import get_booking_request_for_client
from app.features.email.dispatch import dispatch_booking_notification
from app.features.payments import stripe as stripe_service

__all__ = [
    "LIST_COMPLETION_TOUCH_CAP",
    "_auto_release_payout_row",
    "_clear_stale_checkout_session",
    "_confirm_completion",
    "_due_completion_candidates",
    "_finalize_booking_payment_from_checkout_session",
    "_finalize_completion",
    "_format_release_date",
    "_get_vendor_stripe_fields",
    "_load_full_booking_row",
    "_mark_webhook_event_processed",
    "_notify_pair",
    "_now_iso",
    "_payment_fields_from_checkout_session",
    "_refund_paid_booking_row",
    "_serialize_completion_state",
    "admin_refund_booking",
    "admin_release_payout_for_booking",
    "confirm_completion_for_client",
    "confirm_completion_for_vendor",
    "create_checkout_session_for_booking",
    "dispatch_booking_notification",
    "get_booking_request_for_client",
    "get_client",
    "get_settings",
    "handle_account_updated",
    "handle_checkout_session_completed",
    "logger",
    "maybe_auto_release_payout_for_booking",
    "maybe_send_completion_reminder_for_row",
    "process_due_payout_auto_releases",
    "refund_booking_on_cancel",
    "send_completion_reminders",
    "stripe_service",
    "sync_checkout_payment_for_client",
    "touch_booking_completion_side_effects",
    "touch_completion_side_effects_for_booking_rows",
]
