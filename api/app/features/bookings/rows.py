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
    support_hold: bool = False

    @field_validator("line_items", "vendor_adjustments", "selected_option_ids", mode="before")
    @classmethod
    def _list_or_empty(cls, raw_value: Any) -> list[Any]:
        """A JSON column that is not a list (older rows) reads as an empty list."""
        return list(raw_value) if isinstance(raw_value, list) else []


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
