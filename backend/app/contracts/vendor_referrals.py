"""Vendor client referral API contracts."""

from __future__ import annotations

from pydantic import BaseModel


class ReferralFeeTier(BaseModel):
    min_spend_gbp: float
    fee_discount_gbp: float


class VendorClientReferralResponse(BaseModel):
    success: bool = True
    referral_code: str = ""
    has_referral_code: bool = False
    share_link: str = ""
    service_fee_percent: float
    tiers: list[ReferralFeeTier]
    enabled: bool = True


class VendorReferralSetCodeRequest(BaseModel):
    """Omit code or pass null to generate a random 6-digit code."""

    code: str | None = None
    generate: bool = False


class VendorReferralSetCodeResponse(BaseModel):
    success: bool = True
    referral_code: str
    share_link: str


class VendorReferralPreviewResponse(BaseModel):
    success: bool = True
    valid: bool
    code_valid: bool = False
    tiers: list[ReferralFeeTier]
    service_fee_percent: float
    qualified_discount_gbp: float = 0.0
    tier_min_spend_gbp: float | None = None
    service_fee_before_discount_gbp: float = 0.0
    service_fee_gbp: float = 0.0


class VendorReferralBookingRow(BaseModel):
    booking_request_id: str
    event_name: str
    event_date: str
    booking_status: str
    payment_status: str
    vendor_portion_gbp: float
    referral_fee_discount_gbp: float
    client_display_name: str | None = None
    created_at: str | None = None


class VendorReferralBookingsResponse(BaseModel):
    success: bool = True
    total_referral_bookings: int
    total_fee_savings_gbp: float
    bookings: list[VendorReferralBookingRow]
