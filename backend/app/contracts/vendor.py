"""Shared types for vendor profiles and marketplace listings."""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.contracts.types import (
    VendorApprovalStatus,
    VendorListingOverride,
    VendorProfileStatus,
)

_LISTING_OVERRIDE_DESCRIPTION = (
    "auto = approval and Stripe decide; visible = admin waives the Stripe payout "
    "requirement; hidden = admin has taken the listing down without banning."
)


class VendorProfilePutBody(BaseModel):
    current_step: int = Field(ge=1, le=20)
    profile_form_data: dict[str, Any] = Field(default_factory=dict)
    onboarding_status: VendorProfileStatus | None = Field(
        default=None,
        validation_alias="status",
        description="draft | submitted | complete",
    )

    model_config = {"populate_by_name": True}


class VendorProfileState(BaseModel):
    success: bool = True
    current_step: int
    onboarding_status: VendorProfileStatus | str = Field(validation_alias="status")
    approval_status: VendorApprovalStatus | str = "pending"
    profile_form_data: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias="payload",
    )
    updated_at: str | None = None
    payouts_verified: bool = Field(
        default=False,
        description="Stripe Connect can both charge and pay out for this vendor.",
    )
    listing_visible: bool = Field(
        default=False,
        description=(
            "Live on client explore. Normally approved AND payouts verified, but an "
            "admin override can force it either way."
        ),
    )
    listing_override: VendorListingOverride | str = Field(
        default="auto",
        description=_LISTING_OVERRIDE_DESCRIPTION,
    )

    model_config = {"populate_by_name": True}


class VendorBusinessNameAvailabilityResponse(BaseModel):
    success: bool = True
    available: bool


class VendorLocationPayload(BaseModel):
    """Location fields stored in the vendor profile data."""

    country_code: str = Field(default="GB", alias="countryCode", max_length=2)
    base_city: str = Field(default="", alias="baseCity", max_length=120)
    region: str | None = Field(default=None, max_length=120)
    postal_code: str | None = Field(default=None, alias="postalCode", max_length=32)

    model_config = {"populate_by_name": True}


class AdminVendorRow(BaseModel):
    id: str | None = None
    user_id: str
    email: str | None = None
    onboarding_status: VendorProfileStatus | str = Field(default="draft", validation_alias="status")
    approval_status: VendorApprovalStatus | str = "pending"
    current_step: int = 1
    profile_form_data: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias="payload",
    )
    created_at: str | None = None
    updated_at: str | None = None
    stripe_account_id: str | None = None
    stripe_charges_enabled: bool = False
    stripe_payouts_enabled: bool = False
    payouts_verified: bool = Field(
        default=False,
        description="Stripe Connect can both charge and pay out for this vendor.",
    )
    listing_visible: bool = Field(
        default=False,
        description="The vendor is live on client explore right now.",
    )
    listing_override: VendorListingOverride | str = Field(
        default="auto",
        description=_LISTING_OVERRIDE_DESCRIPTION,
    )
    listing_override_reason: str | None = Field(
        default=None,
        description="Why an admin overrode this vendor's listing.",
    )

    model_config = ConfigDict(populate_by_name=True)


class AdminVendorsListResponse(BaseModel):
    success: bool = True
    vendors: list[AdminVendorRow] = Field(default_factory=list)
    total: int = 0
    offset: int = 0
    limit: int = 50


class AdminVendorApprovalResponse(BaseModel):
    success: bool = True
    user_id: str
    approval_status: VendorApprovalStatus | str


class AdminVendorUnsubmitResponse(BaseModel):
    success: bool = True
    user_id: str
    status: VendorProfileStatus | str
    email_sent: bool = Field(
        default=False,
        description="True when the return-for-edits email was dispatched.",
    )


class AdminVendorUnsubmitBody(BaseModel):
    message: str | None = Field(
        default=None,
        max_length=5000,
        description="Optional note included in the vendor email (e.g. missing checklist items).",
    )
    send_email: bool = Field(
        default=True,
        description="Send the vendor a return-for-edits email when true.",
    )


class AdminVendorListingOverrideBody(BaseModel):
    listing_override: VendorListingOverride = Field(
        description=_LISTING_OVERRIDE_DESCRIPTION,
    )
    reason: str | None = Field(
        default=None,
        max_length=500,
        description="Required unless returning the vendor to auto - kept in the audit log.",
    )


class AdminVendorListingOverrideResponse(BaseModel):
    success: bool = True
    user_id: str
    listing_override: VendorListingOverride | str
    listing_visible: bool = False


class AdminVendorRestoreStripeConnectResponse(BaseModel):
    success: bool = True
    user_id: str
    stripe_account_id: str | None = None
    stripe_charges_enabled: bool = False
    stripe_payouts_enabled: bool = False
    restored_from_transfer_id: str | None = None


class AdminVendorProfileNudgeBody(BaseModel):
    user_ids: list[str] = Field(
        min_length=1,
        max_length=100,
        description="Vendor user ids with draft profiles to nudge by email.",
    )


class AdminVendorProfileNudgeFailure(BaseModel):
    user_id: str
    error: str


class AdminVendorProfileNudgeResponse(BaseModel):
    success: bool = True
    sent: int = 0
    skipped: int = 0
    failures: list[AdminVendorProfileNudgeFailure] = Field(default_factory=list)


class AdminVendorPayoutNudgeBody(BaseModel):
    user_ids: list[str] = Field(
        min_length=1,
        max_length=100,
        description="Approved vendor user ids without verified payouts to nudge by email.",
    )


class ExploreVendorRow(BaseModel):
    user_id: str
    email: str | None = None
    status: VendorProfileStatus | str = "draft"
    approval_status: VendorApprovalStatus | str
    profile_form_data: dict[str, Any] = Field(
        default_factory=dict,
        validation_alias="payload",
    )
    updated_at: str | None = None
    review_average: float | None = None
    review_count: int = 0
    completed_bookings: int = Field(
        default=0,
        description="All-time completed bookings (public trust signal).",
    )
    avg_response_seconds: float | None = Field(
        default=None,
        description="Average first-response time in seconds, when known.",
    )
    conversion_rate: float | None = Field(
        default=None,
        description="Completed / client enquiries (0-1), when enquiries exist.",
    )

    model_config = ConfigDict(populate_by_name=True)


def explore_vendor_row_from_db(row: dict[str, Any]) -> ExploreVendorRow:
    """Map a vendors-table dict (``payload``, ``status`` keys) to ``ExploreVendorRow``."""
    return ExploreVendorRow.model_validate(
        {
            **row,
            "user_id": str(row.get("user_id") or ""),
            "status": row.get("status") or "draft",
            "approval_status": row.get("approval_status") or "pending",
        }
    )


def admin_vendor_row_from_db(row: dict[str, Any]) -> AdminVendorRow:
    """Map a vendors-table dict (``payload``, ``status`` keys) to ``AdminVendorRow``."""
    return AdminVendorRow.model_validate(
        {
            **row,
            "user_id": str(row.get("user_id") or ""),
            "status": row.get("status") or "draft",
            "approval_status": row.get("approval_status") or "pending",
            "current_step": row.get("current_step") or 1,
        }
    )


class ExploreVendorsResponse(BaseModel):
    success: bool = True
    vendors: list[ExploreVendorRow] = Field(default_factory=list)


class ExploreVendorSingleResponse(BaseModel):
    success: bool = True
    vendor: ExploreVendorRow


class ExploreVendorFeaturedReview(BaseModel):
    rating: int
    body_excerpt: str
    reviewer_display: str


class ExploreVendorSearchRow(ExploreVendorRow):
    """Marketplace listing row, including which services matched the search."""

    matched_services: list[str] = Field(default_factory=list)
    match_tier: str = Field(
        default="exact",
        description="exact | related | fallback - how closely the listing matched the search",
    )
    featured_review: ExploreVendorFeaturedReview | None = None
    match_hint: str | None = None


class ExplorePlanNeed(BaseModel):
    id: str
    label: str
    service_key: str
    keywords: list[str] = Field(default_factory=list)
    optional: bool = False
    rationale: str | None = None


class ExploreSearchPlan(BaseModel):
    title: str
    event_types: list[str] = Field(default_factory=list)
    needs: list[ExplorePlanNeed] = Field(default_factory=list)
    intent_summary: str | None = None


class ExploreSearchSection(BaseModel):
    need_id: str
    label: str
    service_key: str
    optional: bool = False
    vendors: list[ExploreVendorSearchRow] = Field(default_factory=list)
    # Full matching pool size (may be larger than len(vendors)).
    total_count: int = 0
    why: str | None = None


class ExploreVendorSearchResponse(BaseModel):
    success: bool = True
    total_count: int = 0
    vendors: list[ExploreVendorSearchRow] = Field(default_factory=list)
    match_notice: str | None = None
    has_exact: bool = False
    has_related: bool = False
    search_mode: str = Field(default="simple", description="simple | plan")
    intent_summary: str | None = None
    plan: ExploreSearchPlan | None = None
    sections: list[ExploreSearchSection] = Field(default_factory=list)


class AdminVendorApprovalBody(BaseModel):
    approval_status: VendorApprovalStatus = Field(
        description=(
            "pending = awaiting review; approved = visible on client explore; "
            "banned = hidden from client explore."
        ),
    )


class AdminVendorListingMediaBody(BaseModel):
    display_order: list[str] = Field(
        default_factory=list,
        description=(
            "Full admin drag order of profile/portfolio URLs (hidden items stay in order). "
            "First visible item becomes the browse card cover."
        ),
    )
    hidden_image_urls: list[str] = Field(
        default_factory=list,
        description="Full list of profile/portfolio URLs hidden from public listing.",
    )


class AdminVendorListingMediaResponse(BaseModel):
    success: bool = True
    user_id: str
    listing_cover_image_url: str | None = None
    display_order: list[str] = Field(default_factory=list)
    hidden_image_urls: list[str] = Field(default_factory=list)
