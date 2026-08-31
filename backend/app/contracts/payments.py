"""Shared types for vendor payout setup and client card payments via Stripe."""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Any


class VendorPaymentsConnectResponse(BaseModel):
    success: bool = True
    onboarding_url: str


class VendorPaymentsStatusResponse(BaseModel):
    success: bool = True
    stripe_account_id: str | None = None
    charges_enabled: bool = False
    payouts_enabled: bool = False
    #: Same rule as vendor accept on client-initiated bookings (includes admin listing waiver).
    can_accept_bookings: bool = False
    payout_gate_waived: bool = False


class VendorPayoutRow(BaseModel):
    """One booking's vendor share - never the client total (which includes Eventtz fee)."""

    booking_id: str
    event_name: str
    event_date: str | None = None
    client_display_name: str | None = None
    amount_gbp: float
    amount_label: str
    status: str  # paid_out | awaiting_payout
    paid_out_at: str | None = None


class VendorPayoutHistoryResponse(BaseModel):
    success: bool = True
    payouts: list[VendorPayoutRow] = Field(default_factory=list)
    total_paid_out_gbp: float = 0.0
    total_paid_out_label: str = "GBP 0"
    total_awaiting_gbp: float = 0.0
    total_awaiting_label: str = "GBP 0"


class VendorAnalyticsResponse(BaseModel):
    success: bool = True
    period_days: int = 90
    overview: dict[str, Any] = Field(default_factory=dict)
    funnel: dict[str, Any] = Field(default_factory=dict)
    enquiries_by_month: list[dict[str, Any]] = Field(default_factory=list)
    revenue_by_month: list[dict[str, Any]] = Field(default_factory=list)
    response_time_by_month: list[dict[str, Any]] = Field(default_factory=list)
    rating_by_month: list[dict[str, Any]] = Field(default_factory=list)


class BookingCheckoutResponse(BaseModel):
    success: bool = True
    checkout_url: str


class BookingCheckoutSyncBody(BaseModel):
    session_id: str | None = Field(default=None, max_length=256)


class BookingCheckoutSyncResponse(BaseModel):
    success: bool = True
    payment_status: str


class ConfirmCompletionResponse(BaseModel):
    success: bool = True
    id: str
    status: str
    payment_status: str
    awaiting_other_party: bool = False
