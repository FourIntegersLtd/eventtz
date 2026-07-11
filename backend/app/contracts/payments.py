"""Stripe Connect (vendor payouts) + Checkout (client payments) API models."""

from __future__ import annotations

from pydantic import BaseModel


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


class ConfirmCompletionResponse(BaseModel):
    success: bool = True
    id: str
    status: str
    payment_status: str
    awaiting_other_party: bool = False
