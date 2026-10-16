"""Pure dispute rules: who may open one, which note a viewer sees, how a partial refund is checked.

No database or network here. Services pass in stored rows and already-fetched
lookup maps; these functions decide. The rules and messages are the baseline's
(`backend/app/features/bookings/disputes.py`, `admin/dispute_admin_commands.py`),
ported unchanged.
"""

from __future__ import annotations

from typing import Literal

from app.features.disputes.errors import (
    DisputeInvalidStatus,
    DisputeStatusFilterInvalid,
    NoRecordedPaymentAmount,
    OnlyPaidBookingsCanBePartiallyRefunded,
    PartialRefundOutOfRange,
    RefundAmountRequiredForPartialRefund,
)
from app.features.disputes.rows import DisputeBookingRow, DisputeRow

ViewerRole = Literal["client", "vendor"]

# The realtime event name. The frontend's SSE listener (`web-new/lib/useRealtimeSse.ts`) refreshes
# dispute screens and badges when it arrives; it carries no data, only "re-read".
DISPUTE_CHANGED = "dispute_changed"

# A booking may only ever have one dispute open or under review at a time.
ACTIVE_STATUSES: frozenset[str] = frozenset({"open", "under_review"})

# The booking's own lifecycle status must be one of these for a new dispute to be opened.
ALLOWED_BOOKING_STATUSES_FOR_NEW_DISPUTE: frozenset[str] = frozenset({"pending", "accepted", "completed"})

# Every status a dispute itself may be in.
DISPUTE_STATUSES: frozenset[str] = frozenset({"open", "under_review", "resolved", "closed"})

# The admin list's `status` query maps to the dispute statuses it actually filters by;
# "open" is a bucket that also surfaces "under_review" disputes.
_STATUS_FILTER_BUCKETS: dict[str, tuple[str, ...] | None] = {
    "all": None,
    "open": ("open", "under_review"),
    "under_review": ("under_review",),
    "resolved": ("resolved",),
    "closed": ("closed",),
}


def user_is_booking_party(user_id: str, booking: DisputeBookingRow) -> bool:
    """Whether `user_id` is the client or the vendor on this booking."""
    return user_id == booking.client_user_id or user_id == booking.vendor_user_id


def check_booking_allows_new_dispute(booking: DisputeBookingRow) -> None:
    """Raise if the booking's own status blocks opening a dispute on it."""
    if booking.status not in ALLOWED_BOOKING_STATUSES_FOR_NEW_DISPUTE:
        raise DisputeInvalidStatus()


def status_filter_buckets(status: str) -> tuple[str, ...] | None:
    """The dispute statuses `status` should list, or `None` for every status.

    Raises `DisputeStatusFilterInvalid` for anything not in `_STATUS_FILTER_BUCKETS`.
    """
    if status not in _STATUS_FILTER_BUCKETS:
        raise DisputeStatusFilterInvalid()
    return _STATUS_FILTER_BUCKETS[status]


def resolve_conversation_id(booking: DisputeBookingRow, *, pair_conversation_id: str | None) -> str | None:
    """The chat thread to attach to a new dispute: the booking's own thread if it has one,

    else the client-vendor DM the caller already looked up (or `None` if there isn't one).
    """
    return booking.conversation_id or pair_conversation_id


def viewer_facing_resolution_note(
    *,
    legacy_note: str | None,
    client_note: str | None,
    vendor_note: str | None,
    viewer_role: ViewerRole | None,
) -> str | None:
    """Which resolution note a viewer sees: their own party note, falling back to the legacy shared one.

    An unknown viewer (e.g. staff) sees the party notes only when they agree; otherwise
    the legacy note, exactly as the baseline's `_serialize_public` decided.
    """
    if viewer_role == "client":
        return client_note if client_note else legacy_note
    if viewer_role == "vendor":
        return vendor_note if vendor_note else legacy_note
    client_text = (client_note or "").strip()
    vendor_text = (vendor_note or "").strip()
    if client_text and client_text == vendor_text:
        return client_text
    if client_text and not vendor_text:
        return client_text
    if vendor_text and not client_text:
        return vendor_text
    return legacy_note


def partial_refund_range_message(paid_amount_gbp: float) -> str:
    """The exact out-of-range message, naming the amount actually paid (baseline's

    `partial_refund_range_detail`).
    """
    return f"Partial refund must be between 0 and GBP {paid_amount_gbp:.2f}."


def check_partial_refund_amount(*, refund_amount_gbp: float | None, booking: DisputeBookingRow) -> None:
    """Every pre-Stripe validation the baseline runs for a `partial_refund` resolution,

    in the baseline's own order: amount present, booking paid, a payment amount was
    recorded, and the requested amount fits within it.
    """
    if not refund_amount_gbp:
        raise RefundAmountRequiredForPartialRefund()
    if booking.payment_status != "paid":
        raise OnlyPaidBookingsCanBePartiallyRefunded()
    paid_amount = booking.payment_amount_gbp or 0
    if paid_amount <= 0:
        raise NoRecordedPaymentAmount()
    if refund_amount_gbp < 0 or refund_amount_gbp > paid_amount:
        raise PartialRefundOutOfRange(partial_refund_range_message(paid_amount))


def recent_first(disputes: list[DisputeRow]) -> list[DisputeRow]:
    """Disputes ordered newest-created first (the ordering every listing route uses)."""
    return sorted(disputes, key=lambda dispute: dispute.created_at or "", reverse=True)


def change_recipients(patch_fields: dict[str, object], booking: DisputeBookingRow) -> list[str]:
    """Who hears `dispute_changed` after a staff patch, exactly as the baseline picks them.

    A patch that only sets resolution notes (no status, no resolution action) wakes just the
    party whose note was set, so one party's private note never nudges the other. Every other
    patch (status, assignee, money, internal notes...) wakes both parties.
    """
    sets_client_note = "client_resolution_note" in patch_fields
    sets_vendor_note = "vendor_resolution_note" in patch_fields
    is_note_only = (
        (sets_client_note or sets_vendor_note)
        and not patch_fields.get("status")
        and patch_fields.get("resolution_action") is None
    )
    if not is_note_only:
        return [booking.client_user_id, booking.vendor_user_id]
    recipients = []
    if sets_client_note:
        recipients.append(booking.client_user_id)
    if sets_vendor_note:
        recipients.append(booking.vendor_user_id)
    return recipients
