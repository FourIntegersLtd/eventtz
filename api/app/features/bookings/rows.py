"""Typed rows the bookings repository returns. Built from query results, never from requests.

Dates and timestamps arrive as ISO text (see `core.db.plain_value`), the way the
baseline read them from PostgREST, so the pure rules in `domain.py` work on text.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class BookingRow(BaseModel):
    """Every column the booking screens and state changes read."""

    id: str
    client_user_id: str
    vendor_user_id: str
    status: str
    payment_status: str = "unpaid"
    initiator: str = "client"
    event_name: str = ""
    event_date: str = ""
    event_end_date: str | None = None
    event_postcode: str | None = None
    event_address: str | None = None
    notes: str | None = None
    total_label: str = ""
    initial_client_total_label: str | None = None
    selected_option_ids: list[str] = Field(default_factory=list)
    line_items: list[Any] = Field(default_factory=list)
    vendor_adjustments: list[Any] = Field(default_factory=list)
    service_fee_percent: float | None = None
    vendor_referral_code: str | None = None
    conversation_id: str | None = None
    event_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    paid_at: str | None = None
    client_completion_confirmed_at: str | None = None
    vendor_completion_confirmed_at: str | None = None
    # Money columns. Only the payment services write them (conditionally on payment_status).
    stripe_checkout_session_id: str | None = None
    stripe_payment_intent_id: str | None = None
    stripe_charge_id: str | None = None
    stripe_transfer_id: str | None = None
    stripe_receipt_url: str | None = None
    payment_amount_gbp: float | None = None
    vendor_amount_gbp: float | None = None
    platform_fee_gbp: float | None = None
    referral_fee_discount_gbp: float | None = None
    payout_released_at: str | None = None
    payout_auto_released_at: str | None = None
    completion_reminder_sent_at: str | None = None
    completed_at: str | None = None
    refunded_at: str | None = None
    cancelled_by: str | None = None
    # The client-cancel split (`domain_cancellation`); NULL policy means a full refund.
    cancellation_policy: str | None = None
    cancellation_refund_percent: int | None = None
    cancellation_refund_gbp: float | None = None
    cancellation_vendor_share_gbp: float | None = None
    cancellation_payout_at: str | None = None
    support_hold: bool = False
    accepted_at: str | None = None
    # Why staff cancelled: 'exceptional' (events outside the vendor's control) keeps it off their record.
    cancellation_reason: str | None = None
    # Hours the client has after the event to report a problem; NULL means the default setting.
    report_window_hours: int | None = None
    # Delivery split (photography): part paid after the event, the rest on delivery or deadline.
    payout_upfront_percent: int | None = None
    delivery_deadline_days: int | None = None
    upfront_amount_gbp: float | None = None
    upfront_transfer_id: str | None = None
    upfront_payout_at: str | None = None
    delivery_confirmed_at: str | None = None
    # A pending request to move the event date, made by either side.
    proposed_event_date: str | None = None
    proposed_event_end_date: str | None = None
    date_change_requested_by: str | None = None
    date_change_requested_at: str | None = None
    date_change_note: str | None = None
    # Refundable damage deposit (rentals, decor), held by Eventtz until the claim window ends.
    damage_deposit_gbp: float | None = None
    deposit_refunded_at: str | None = None
    deposit_claim_gbp: float | None = None
    deposit_claim_note: str | None = None
    deposit_claimed_at: str | None = None
    deposit_claim_awarded_gbp: float | None = None
    deposit_claim_resolved_at: str | None = None
    deposit_transfer_id: str | None = None

    @field_validator("line_items", "vendor_adjustments", "selected_option_ids", mode="before")
    @classmethod
    def _list_or_empty(cls, raw_value: Any) -> list[Any]:
        """A JSON column that is not a list (older rows) reads as an empty list."""
        return list(raw_value) if isinstance(raw_value, list) else []


class ReceiptBookingRow(BookingRow):
    """A booking with its frozen receipt/payment-record/payout-statement snapshots.

    The three extra columns are write-once JSON: whichever of them a payment step
    has already frozen wins over building the document afresh (`domain_receipts`).
    """

    payment_receipt_snapshot: dict[str, Any] | None = None
    vendor_payment_record_snapshot: dict[str, Any] | None = None
    vendor_payout_statement_snapshot: dict[str, Any] | None = None


class EnquiryReminderRow(BaseModel):
    """A client enquiry the vendor has not answered yet, with which reminders it has had."""

    id: str
    vendor_user_id: str
    event_name: str = ""
    created_at: str | None = None
    enquiry_reminder_1h_at: str | None = None
    enquiry_reminder_6h_at: str | None = None
    enquiry_reminder_24h_at: str | None = None


class SilentEnquiryRow(BaseModel):
    """A client enquiry the vendor has not answered, with what the client searched for when sending it."""

    id: str
    client_user_id: str
    vendor_user_id: str
    event_name: str = ""
    client_search_context: dict[str, Any] | None = None

    @field_validator("client_search_context", mode="before")
    @classmethod
    def _context_is_an_object(cls, raw_context: Any) -> dict[str, Any] | None:
        """A search context that is not a JSON object reads as none."""
        return raw_context if isinstance(raw_context, dict) else None


class CapacityRow(BaseModel):
    """An open booking's dates, for counting the vendor's bookings on each day."""

    event_date: str
    event_end_date: str | None = None


class VendorReviewRow(BaseModel):
    """A visible client review of one of the vendor's bookings."""

    id: str
    booking_request_id: str
    client_user_id: str | None = None
    rating: int | None = None
    body: str | None = None
    created_at: str | None = None
    image_urls: Any = None


class ClientReviewRow(BaseModel):
    """The review the client left on a booking."""

    id: str
    rating: int | None = None
    body: str | None = None
    created_at: str | None = None
    image_urls: Any = None
