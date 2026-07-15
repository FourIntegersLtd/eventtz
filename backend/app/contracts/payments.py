"""Shared types for vendor payout setup and client card payments via Stripe."""

from __future__ import annotations

from pydantic import BaseModel, Field


class VendorPaymentsConnectResponse(BaseModel):
    success: bool = True
    onboarding_url: str


class VendorPaymentsStatusResponse(BaseModel):
    success: bool = True
    stripe_account_id: str | None = None
    charges_enabled: bool = False
    payouts_enabled: bool = False


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
