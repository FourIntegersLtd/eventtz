"""Shared types for vendor profiles and marketplace listings."""

from typing import Any

from pydantic import BaseModel, Field

from app.contracts.types import VendorApprovalStatus, VendorProfileStatus


class VendorProfilePutBody(BaseModel):
    current_step: int = Field(ge=1, le=20)
    payload: dict[str, Any] = Field(default_factory=dict)
    status: VendorProfileStatus | None = Field(
        default=None,
        description="draft | submitted | complete",
    )


class VendorProfileState(BaseModel):
    success: bool = True
    current_step: int
    status: VendorProfileStatus | str
    approval_status: VendorApprovalStatus | str = "pending"
    payload: dict[str, Any] = Field(default_factory=dict)
    updated_at: str | None = None


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
    status: VendorProfileStatus | str = "draft"
    approval_status: VendorApprovalStatus | str = "pending"
    current_step: int = 1
    payload: dict[str, Any] = Field(default_factory=dict)
    created_at: str | None = None
    updated_at: str | None = None


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


class ExploreVendorRow(BaseModel):
    user_id: str
    email: str | None = None
    status: VendorProfileStatus | str = "draft"
    approval_status: VendorApprovalStatus | str
    payload: dict[str, Any] = Field(default_factory=dict)
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
        description="Completed / client enquiries (0–1), when enquiries exist.",
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
        description="exact | related | fallback — how closely the listing matched the search",
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
