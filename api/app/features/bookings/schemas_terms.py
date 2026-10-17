"""The booking terms fields every booking detail carries (client, vendor and admin views).

Kept in its own module so `schemas.py` and `schemas_admin.py` can both build on it without
importing each other. See ADR 0010.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class BookingTermsFields(BaseModel):
    """Fields both parties see for the Terms rules on a booking: deadlines, split payouts, deposits, dates.

    Each is empty unless the rule applies to this booking.
    """

    # The client must pay by this time or the booking is cancelled (accepted under the 2026-11 Terms).
    payment_due_at: str | None = None
    # Hours after the event the client has to report a problem, when longer than the default.
    report_window_hours: int | None = None
    # Photography split: the share paid after the event, and the delivery deadline for the rest.
    payout_upfront_percent: int | None = None
    delivery_deadline_days: int | None = None
    upfront_amount_gbp: float | None = None
    upfront_payout_at: str | None = None
    delivery_confirmed_at: str | None = None
    delivery_due_at: str | None = None
    payout_stage: Literal["full", "upfront", "waiting_delivery", "final"] | None = None
    # A pending request to move the event date.
    proposed_event_date: str | None = None
    proposed_event_end_date: str | None = None
    date_change_requested_by: Literal["client", "vendor"] | None = None
    date_change_requested_at: str | None = None
    date_change_note: str | None = None
    # Refundable damage deposit (rentals, decor).
    damage_deposit_gbp: float | None = None
    deposit_refund_due_at: str | None = None
    deposit_refunded_at: str | None = None
    deposit_claim_gbp: float | None = None
    deposit_claim_note: str | None = None
    deposit_claimed_at: str | None = None
    deposit_claim_awarded_gbp: float | None = None
    deposit_claim_resolved_at: str | None = None
