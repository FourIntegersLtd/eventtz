"""Errors the disputes slice raises. Messages are the baseline's user-facing copy, verbatim.

Two distinct "dispute not found" messages exist because the baseline has two code
paths that can both answer "the dispute id is wrong": the participant-facing
lookups (and the admin patch's own pre-Stripe safety check before it moves money)
answer with a message ending in a period ("Dispute not found."), while the admin
patch's general not-found - the update matched no row at all - has no period
("Dispute not found"). Both are kept, spelled out, rather than merged, so the
baseline's exact wording (and status code, in the resolution-action case) survives.
"""

from __future__ import annotations

from app.core.errors import Conflict, Forbidden, InvalidInput, NotFound
from app.features.bookings.errors import (
    NoPaymentOnRecord,
    OnlyPaidCanRefund,
    OnlyPaidPayoutRelease,
    PayoutAmountMissing,
    PayoutReleaseFailed,
    RefundFailed,
)


class InvalidDisputeId(InvalidInput):
    """A dispute id in the URL isn't a UUID, rejected before any lookup."""

    code = "invalid_dispute_id"
    default_message = "Invalid dispute id."


class BookingNotFound(NotFound):
    """Opening a dispute on a booking id that names no row at all."""

    code = "dispute_booking_not_found"
    default_message = "Booking not found."


class CannotOpenDispute(Forbidden):
    """BASELINE QUIRK: a booking that exists but belongs to someone else leaks its existence

    via 403, unlike listing or fetching a dispute detail (which hide it behind an empty
    list or a plain 404 - see `DisputeNotFoundForParticipant`).
    """

    code = "cannot_open_dispute"
    default_message = "You cannot open a dispute for this booking."


class DisputeInvalidStatus(InvalidInput):
    """The booking's own status (e.g. cancelled) doesn't allow a new dispute."""

    code = "dispute_invalid_status"
    default_message = "Disputes cannot be opened for this booking in its current status."


class DisputeAlreadyOpen(Conflict):
    """The booking already has an open or under_review dispute; only one may be active."""

    code = "dispute_already_open"
    default_message = "A dispute is already open or under review for this booking."


class DisputeNotFoundForParticipant(NotFound):
    """A dispute id that names no row the caller may see.

    Hides existence (unlike opening a dispute, which leaks it via 403): a non-party
    fetching a real dispute's detail gets this same message.
    """

    code = "dispute_not_found"
    default_message = "Dispute not found."


class DisputeStatusFilterInvalid(InvalidInput):
    """The admin list's `status` query names none of the recognised filter buckets."""

    code = "dispute_status_filter_invalid"
    default_message = "status must be all, open, under_review, resolved, or closed"


class DisputeFinancialResolutionSuperAdminOnly(Forbidden):
    """Only a super admin may resolve a dispute with a money-moving `resolution_action`."""

    code = "dispute_financial_resolution_super_admin_only"
    default_message = "Only super admins can resolve disputes with a financial outcome."


class DisputeRefundAmountSuperAdminOnly(Forbidden):
    """Only a super admin may set `refund_amount_gbp`, even without a `resolution_action`."""

    code = "dispute_refund_amount_super_admin_only"
    default_message = "Only super admins can set refund amounts on disputes."


class DisputeNotFoundForResolution(InvalidInput):
    """BASELINE QUIRK: when the patch also resolves the dispute with a `resolution_action`,

    a missing dispute id is a 400 (not the plain patch's 404): the money branch looks the
    dispute up itself, before the general patch, and that lookup answers differently.
    """

    code = "dispute_not_found_for_resolution"
    default_message = "Dispute not found."


class DisputeNotFoundPlain(NotFound):
    """The admin patch's general not-found: the update matched no row."""

    code = "dispute_not_found_plain"
    default_message = "Dispute not found"


class RefundAmountRequiredForPartialRefund(InvalidInput):
    """A partial refund was requested with no `refund_amount_gbp`."""

    code = "refund_amount_required_partial"
    default_message = "refund_amount_gbp is required for a partial refund."


class OnlyPaidBookingsCanBePartiallyRefunded(InvalidInput):
    """A partial refund was requested on a booking that was never paid."""

    code = "only_paid_partial_refund"
    default_message = "Only paid bookings can be partially refunded."


class NoRecordedPaymentAmount(InvalidInput):
    """The booking is marked paid but has no `payment_amount_gbp` to refund against."""

    code = "no_recorded_payment_amount"
    default_message = "No recorded payment amount for this booking."


class PartialRefundOutOfRange(InvalidInput):
    """`refund_amount_gbp` is outside 0..paid_amount. The message names the paid ceiling,

    so its `message` is always set explicitly (see `domain.partial_refund_range_message`);
    `default_message` only covers the case nothing more specific was supplied.
    """

    code = "partial_refund_out_of_range"
    default_message = "Partial refund is out of range."


class AssigneeMustBeAdmin(InvalidInput):
    """`assigned_admin_id` names an account that isn't a staff account."""

    code = "dispute_assignee_must_be_admin"
    default_message = "Assignee must be an admin account."


class AssigneeAdminSuspended(InvalidInput):
    """`assigned_admin_id` names a staff account that is suspended."""

    code = "dispute_assignee_admin_suspended"
    default_message = "Assignee admin account is suspended."


# What resolving with a `resolution_action` can answer: the bookings slice moves the money.
MONEY_ACTION_ERRORS = (
    OnlyPaidCanRefund,
    NoPaymentOnRecord,
    RefundFailed,
    OnlyPaidPayoutRelease,
    PayoutAmountMissing,
    PayoutReleaseFailed,
)
