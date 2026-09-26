"""Typed rows the referrals repository returns. Only the repository builds them; schemas never import them.

Plain values (text ids, ISO timestamps): the shape the domain rules and goldens
were written against. The mapped tables are in `models.py`."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class PartnerRow(BaseModel):
    """A `referral_partners` row: a creator who shares a vendor sign-up link."""

    id: str
    slug: str
    display_name: str = ""
    instagram_handle: str | None = None
    notes: str | None = None
    is_active: bool = True
    created_at: str | None = None
    updated_at: str | None = None


class AttributionRow(BaseModel):
    """A `referral_attributions` row: which partner brought a vendor in, and whether they were thanked."""

    user_id: str
    referral_partner_id: str | None = None
    referral_slug: str | None = None
    attributed_at: str | None = None
    shoutout_completed: bool | None = False
    shoutout_completed_at: str | None = None


class SignupVendorRow(BaseModel):
    """The `vendors` columns the sign-up list shows: onboarding and approval state, and the profile."""

    user_id: str
    status: str | None = None
    approval_status: str | None = None
    payload: Any = None


class VendorCodeRow(BaseModel):
    """A vendor's client referral settings from their `vendors` row."""

    user_id: str
    approval_status: str | None = None
    client_referral_code: str | None = None
    # A NULL here reads as disabled, as in the baseline (`bool(None)`).
    client_referral_enabled: bool | None = True


class ReferralBookingRow(BaseModel):
    """The `booking_requests` columns needed to show a booking made with a referral code and price it."""

    id: str
    status: str | None = None
    payment_status: str | None = None
    event_name: str | None = None
    event_date: str | None = None
    created_at: Any = None
    client_user_id: str | None = None
    vendor_user_id: str | None = None
    line_items: Any = None
    vendor_adjustments: Any = None
    vendor_referral_code: str | None = None
    service_fee_percent: Any = None
    referral_fee_discount_gbp: Any = None
