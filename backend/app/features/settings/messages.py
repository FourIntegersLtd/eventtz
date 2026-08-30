"""User-facing copy for account settings."""

from __future__ import annotations

ACCOUNT_DELETE_ADMIN = (
    "Staff accounts cannot be deleted here. Ask a super admin to remove team access."
)
ACCOUNT_DELETE_MONEY = (
    "You have a booking with payment still in progress. "
    "Finish payout or wait for a refund, then try again."
)
ACCOUNT_DELETE_ACTIVE = (
    "You have an accepted booking that has not happened yet. "
    "Complete or cancel it first, then try again."
)
ACCOUNT_DELETE_DISPUTE = (
    "You have an open problem report. Wait until it is resolved, then try again."
)
ACCOUNT_DELETED = "Your Eventtz account has been deleted."
REDACTED_MESSAGE_BODY = "[Deleted]"

CODE_MONEY_IN_FLIGHT = "money_in_flight"
CODE_ACTIVE_BOOKING = "active_booking"
CODE_OPEN_DISPUTE = "open_dispute"
