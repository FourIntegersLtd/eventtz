"""Pure rules for closing one's own account (UK GDPR Art. 17): which gate refuses, and what to remove.

Baseline: `backend/app/features/settings/account_deletion_gates.py` and
`account_deletion_storage.py`. Gates run in the baseline's order: money still moving,
then an accepted booking still to happen, then an open problem report.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Literal, Protocol
from urllib.parse import unquote, urlparse

DeletionGate = Literal["money_in_flight", "active_booking", "open_dispute"]

# Payment states where money is held or on its way (`account_deletion_gates.py:17`).
MONEY_IN_FLIGHT_PAYMENT_STATUSES = frozenset({"pending", "paid"})
# Dispute states that still need staff (`account_deletion_gates.py:18`).
OPEN_DISPUTE_STATUSES = frozenset({"open", "under_review"})

ACCOUNT_DELETED_MESSAGE = "Your Eventtz account has been deleted."
# What a closed account's sent messages read afterwards (baseline `settings/messages.py:20`).
REDACTED_MESSAGE_BODY = "[Deleted]"
# Replaces the recipient address in the email delivery log (`account_deletion_erase.py:17`).
REDACTED_EMAIL = "redacted@invalid"
# Shown to staff on a closed vendor's hidden listing (`account_deletion_erase.py:176`).
CLOSED_VENDOR_LISTING_REASON = "Account deleted"


class BookingState(Protocol):
    """What the gates read from one of the account's bookings."""

    @property
    def status(self) -> str:
        """The request's lifecycle status."""
        ...

    @property
    def payment_status(self) -> str:
        """The money's status."""
        ...

    @property
    def event_day_over(self) -> bool:
        """Whether the event's last day has ended."""
        ...


def failing_gate(bookings: Sequence[BookingState], *, has_open_dispute: bool) -> DeletionGate | None:
    """The first gate that refuses closing the account, or None when it may close.

    Money in flight on any booking beats an active booking, which beats an open dispute.
    Pending, unpaid enquiries never block: closing cancels them.
    """
    if any(booking.payment_status in MONEY_IN_FLIGHT_PAYMENT_STATUSES for booking in bookings):
        return "money_in_flight"
    if any(booking.status == "accepted" and not booking.event_day_over for booking in bookings):
        return "active_booking"
    if has_open_dispute:
        return "open_dispute"
    return None


def is_open_dispute(status: str) -> bool:
    """Whether a dispute in this status still blocks closing the account."""
    return status in OPEN_DISPUTE_STATUSES


def user_storage_prefix(user_id: str) -> str | None:
    """The storage prefix holding the account's uploads, or None for an id that could escape it."""
    if not user_id or "/" in user_id or user_id in (".", ".."):
        return None
    return f"users/{user_id}/"


def own_object_key(url: str, storage_host: str) -> str | None:
    """The object key of `url` when it points into our storage (host compared case-insensitively)."""
    parsed = urlparse(url.strip())
    if not storage_host or (parsed.netloc or "").lower() != storage_host.lower():
        return None
    return unquote((parsed.path or "").lstrip("/")) or None
