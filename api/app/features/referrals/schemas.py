"""Request and response bodies for the referral routes.

Names and fields match the baseline contracts, so the generated web types do not change.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

# --- creator partners --------------------------------------------------------------------------
from app.core.pagination import DEFAULT_LIST_LIMIT

# Re-exported for the admin router's `shoutout` query parameter.
from app.features.referrals.domain import ShoutoutFilter as ShoutoutFilter


class ReferralPartnerRow(BaseModel):
    """A creator partner as staff see it, with the sign-up link they share."""

    id: str
    slug: str
    display_name: str
    instagram_handle: str | None = None
    notes: str | None = None
    is_active: bool = True
    referral_link: str
    created_at: str | None = None
    updated_at: str | None = None


class ReferralPartnerListResponse(BaseModel):
    """Every partner, newest first."""

    success: bool = True
    partners: list[ReferralPartnerRow]
    total: int = 0
    offset: int = 0
    limit: int = DEFAULT_LIST_LIMIT


class CreateReferralPartnerRequest(BaseModel):
    """A new partner. Leave `slug` blank to make one from the display name."""

    display_name: str = Field(min_length=1, max_length=120)
    instagram_handle: str | None = Field(default=None, max_length=80)
    slug: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)


class UpdateReferralPartnerRequest(BaseModel):
    """A partner edit: only the fields sent (and not null) change. The slug never changes."""

    display_name: str | None = Field(default=None, min_length=1, max_length=120)
    instagram_handle: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None


class ReferralPartnerResponse(BaseModel):
    """One partner after a create or edit."""

    success: bool = True
    partner: ReferralPartnerRow


class ReferralPartnerPublicResponse(BaseModel):
    """What the vendor sign-up page shows for a partner's link ("Referred by ...")."""

    success: bool = True
    slug: str
    display_name: str


class ReferralVendorSignupRow(BaseModel):
    """A vendor who signed up through a partner's link, and whether the partner has been thanked."""

    user_id: str
    email: str | None = None
    business_name: str | None = None
    approval_status: str | None = None
    onboarding_status: str | None = None
    attributed_at: str | None = None
    shoutout_completed: bool = False
    shoutout_completed_at: str | None = None
    explore_path: str | None = None


class ReferralSignupListResponse(BaseModel):
    """One page of a partner's sign-ups."""

    success: bool = True
    partner: ReferralPartnerRow
    signups: list[ReferralVendorSignupRow]
    total: int
    offset: int
    limit: int


class UpdateReferralShoutoutRequest(BaseModel):
    """Mark a sign-up's shout-out as done (stamps the time) or not done (clears it)."""

    shoutout_completed: bool


# --- vendor client codes -----------------------------------------------------------------------


class ReferralFeeTier(BaseModel):
    """Spend at least `min_spend_gbp` and get `fee_discount_gbp` off the service fee."""

    min_spend_gbp: float
    fee_discount_gbp: float


class VendorClientReferralResponse(BaseModel):
    """A vendor's referral screen: their code and link (empty until set), the fee and the tiers."""

    success: bool = True
    referral_code: str = ""
    has_referral_code: bool = False
    share_link: str = ""
    service_fee_percent: float
    tiers: list[ReferralFeeTier]
    enabled: bool = True


class VendorReferralSetCodeRequest(BaseModel):
    """Omit code or pass null to generate a random 6-digit code. `generate` is accepted but ignored."""

    code: str | None = None
    generate: bool = False


class VendorReferralSetCodeResponse(BaseModel):
    """The vendor's code once set, and the link to share."""

    success: bool = True
    referral_code: str
    share_link: str


class VendorReferralPreviewResponse(BaseModel):
    """What a client's code would take off the fee for a given spend with this vendor."""

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
    """A booking a client made with a referral code, and what the code saved them."""

    booking_request_id: str
    event_name: str
    event_date: str
    booking_status: str
    payment_status: str
    vendor_portion_gbp: float
    referral_fee_discount_gbp: float
    referral_code: str = ""
    client_display_name: str | None = None
    created_at: str | None = None


class VendorReferralBookingsResponse(BaseModel):
    """Every referral booking for the vendor and the clients' total savings."""

    success: bool = True
    total_referral_bookings: int
    total_fee_savings_gbp: float
    bookings: list[VendorReferralBookingRow]
    total: int = 0
    offset: int = 0
    limit: int = DEFAULT_LIST_LIMIT
