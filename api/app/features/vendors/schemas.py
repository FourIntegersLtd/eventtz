"""Request and response bodies for the vendor profile and staff moderation routes.

Names and fields match the baseline contracts (`backend/app/contracts/vendor.py`),
so the generated web types do not change.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

VendorProfileStatus = Literal["draft", "submitted", "complete"]
VendorApprovalStatus = Literal["pending", "approved", "banned"]
VendorListingOverride = Literal["auto", "visible", "hidden"]

# --- the vendor's own profile -------------------------------------------------------------------


class VendorProfilePutBody(BaseModel):
    """One save of the onboarding form: the step reached, the fields changed and, optionally, a status."""

    model_config = ConfigDict(populate_by_name=True)

    current_step: int = Field(ge=1, le=20)
    profile_form_data: dict[str, Any] = Field(default_factory=dict)
    onboarding_status: VendorProfileStatus | None = Field(
        default=None,
        validation_alias="status",
        description="draft = still editing; submitted = sent for review. Omit to keep the stored status.",
    )


class VendorInsuranceState(BaseModel):
    """The vendor's public liability cover (optional for now): what they uploaded and what staff checked."""

    status: Literal["missing", "awaiting_check", "verified", "expiring", "expired"] = Field(
        default="missing",
        description=(
            "missing = nothing checked or uploaded; awaiting_check = an upload staff have not checked yet; "
            "verified = checked and in date; expiring = ends within 30 days; expired = checked cover ended."
        ),
    )
    certificate_url: str | None = Field(default=None, description="The certificate on the profile form now.")
    verified_certificate_url: str | None = Field(default=None, description="The certificate staff checked.")
    expires_on: date | None = None
    cover_gbp: int | None = None
    verified_at: str | None = None


class VendorProfileState(BaseModel):
    """The vendor's onboarding form and where it stands, with why they are (or are not) listed."""

    success: bool = True
    current_step: int
    onboarding_status: str
    approval_status: str = "pending"
    profile_form_data: dict[str, Any] = Field(default_factory=dict)
    updated_at: str | None = None
    payouts_verified: bool = Field(
        default=False, description="Stripe Connect can both take charges and pay out."
    )
    listing_visible: bool = Field(
        default=False,
        description="Clients can find this vendor: approved, and payouts verified unless overridden.",
    )
    listing_override: str = "auto"
    insurance: VendorInsuranceState = Field(default_factory=VendorInsuranceState)


class VendorBusinessNameAvailabilityResponse(BaseModel):
    """Whether a business name is free (the caller's own name counts as free)."""

    success: bool = True
    available: bool


# --- staff moderation --------------------------------------------------------------------------


class AdminVendorRow(BaseModel):
    """One vendor on the staff vendor list."""

    id: str | None = None
    user_id: str
    email: str | None = None
    onboarding_status: str = "draft"
    approval_status: str = "pending"
    current_step: int = 1
    profile_form_data: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None
    stripe_account_id: str | None = None
    stripe_charges_enabled: bool = False
    stripe_payouts_enabled: bool = False
    payouts_verified: bool = False
    listing_visible: bool = False
    listing_override: str = "auto"
    listing_override_reason: str | None = None
    listing_paused_until: str | None = None
    listing_pause_reason: str | None = None
    vendor_cancellation_count: int = Field(
        default=0, description="Cancellations counted against the vendor in the last 180 days (staff only)."
    )
    cancellation_review_flag: bool = Field(
        default=False, description="True when the count has reached the staff-review threshold."
    )
    insurance: VendorInsuranceState = Field(default_factory=VendorInsuranceState)


class AdminVendorsListResponse(BaseModel):
    """One page of the staff vendor list and how many vendors match in total."""

    success: bool = True
    vendors: list[AdminVendorRow] = Field(default_factory=list)
    total: int = 0
    offset: int = 0
    limit: int = 50


class AdminVendorApprovalBody(BaseModel):
    """The approval state staff are moving a vendor to."""

    approval_status: VendorApprovalStatus = Field(
        description=(
            "pending = awaiting review; approved = visible on client explore; "
            "banned = hidden from client explore."
        ),
    )
    reason: str | None = Field(
        default=None,
        max_length=2000,
        description="Staff's reason, quoted in the email to the vendor when banning.",
    )


class AdminVendorApprovalResponse(BaseModel):
    """The vendor's approval state after the change."""

    success: bool = True
    user_id: str
    approval_status: str


class AdminVendorUnsubmitBody(BaseModel):
    """Returning a profile for edits, with an optional note for the vendor."""

    message: str | None = Field(
        default=None, max_length=5000, description="Shown to the vendor in the email, if one is sent."
    )
    send_email: bool = Field(default=True, description="Email the vendor that their profile needs edits.")


class AdminVendorUnsubmitResponse(BaseModel):
    """The vendor's onboarding status after being returned for edits."""

    success: bool = True
    user_id: str
    status: str
    email_sent: bool = Field(
        default=False, description="The vendor was emailed (false if skipped or failed)."
    )


class AdminVendorListingOverrideBody(BaseModel):
    """Force a listing on or off, or hand it back to the automatic rule."""

    listing_override: VendorListingOverride = Field(
        description="auto = follow approval and payouts; visible/hidden = super admin only, with a reason."
    )
    reason: str | None = Field(default=None, max_length=500)


class AdminVendorListingOverrideResponse(BaseModel):
    """The override now stored and whether clients can find the vendor."""

    success: bool = True
    user_id: str
    listing_override: str
    listing_visible: bool = False


class AdminVendorListingMediaBody(BaseModel):
    """Staff's order for the vendor's listing photos and which ones to hide."""

    display_order: list[str] = Field(
        default_factory=list,
        description=(
            "Full admin drag order of profile/portfolio URLs (hidden items stay in order). "
            "First visible item becomes the browse card cover."
        ),
    )
    hidden_image_urls: list[str] = Field(
        default_factory=list, description="Full list of profile/portfolio URLs hidden from public listing."
    )


class AdminVendorListingMediaResponse(BaseModel):
    """The listing photos as clients now see them."""

    success: bool = True
    user_id: str
    listing_cover_image_url: str | None = None
    display_order: list[str] = Field(default_factory=list)
    hidden_image_urls: list[str] = Field(default_factory=list)


class AdminVendorProfileNudgeBody(BaseModel):
    """Draft vendors to email a "finish your profile" nudge (duplicates and blanks are ignored)."""

    user_ids: list[str] = Field(min_length=1, max_length=100)


class AdminVendorPayoutNudgeBody(BaseModel):
    """Approved vendors to email a "set up payouts" nudge (duplicates and blanks are ignored)."""

    user_ids: list[str] = Field(min_length=1, max_length=100)


class AdminVendorProfileNudgeFailure(BaseModel):
    """A vendor who could not be nudged, and why."""

    user_id: str
    error: str


class AdminVendorProfileNudgeResponse(BaseModel):
    """How many vendors were emailed, how many were not eligible, and who could not be reached."""

    success: bool = True
    sent: int = 0
    skipped: int = 0
    failures: list[AdminVendorProfileNudgeFailure] = Field(default_factory=list)


# --- the marketplace's view (read by other slices through `service_listing`) ---------------------


class ListedVendor(BaseModel):
    """A vendor as the marketplace shows them: the profile form, approval and the account email."""

    user_id: str
    email: str | None = None
    status: str | None = None
    approval_status: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    updated_at: str | None = None


class AdminVendorWarnBody(BaseModel):
    """A formal warning staff send to a vendor by email."""

    message: str = Field(min_length=3, max_length=2000, description="What the vendor is warned about.")


class AdminVendorWarnResponse(BaseModel):
    """Whether the warning email reached the provider."""

    success: bool = True
    user_id: str
    email_sent: bool


class AdminVendorPauseBody(BaseModel):
    """Pause a vendor's public listing for a number of days."""

    days: int = Field(ge=1, le=90, description="How many days the listing stays hidden.")
    reason: str = Field(min_length=3, max_length=2000, description="Sent to the vendor with the end date.")


class AdminVendorPauseResponse(BaseModel):
    """The pause now stored (both null once cleared) and whether clients can find the vendor."""

    success: bool = True
    user_id: str
    listing_paused_until: str | None = None
    listing_pause_reason: str | None = None
    listing_visible: bool = False


class AdminVendorInsuranceBody(BaseModel):
    """What staff read off the vendor's uploaded public liability certificate."""

    expires_on: date = Field(description="The day the cover ends.")
    cover_gbp: int = Field(ge=1, le=100_000_000, description="The cover for any one claim, in whole pounds.")


class AdminVendorInsuranceResponse(BaseModel):
    """The vendor's insurance after the change, and whether clients can find them."""

    success: bool = True
    user_id: str
    insurance: VendorInsuranceState
    listing_visible: bool = False
