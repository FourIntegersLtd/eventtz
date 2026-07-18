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
