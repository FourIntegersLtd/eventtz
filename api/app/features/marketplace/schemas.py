"""Request and response bodies for explore, search, public reviews, favourites, geo and analytics.

Names and fields match the baseline contracts (`backend/app/contracts/vendor.py`,
`reviews.py`, `favorites.py`, `geo_address.py`, `payments.py`) so the generated web
types do not change.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

# --- explore --------------------------------------------------------------------------------------


class ExploreVendorRow(BaseModel):
    """One vendor card: the profile form, approval and public trust signals."""

    model_config = ConfigDict(populate_by_name=True)

    user_id: str
    email: str | None = None
    status: str = "draft"
    approval_status: str
    profile_form_data: dict[str, Any] = Field(default_factory=dict, validation_alias="payload")
    updated_at: str | None = None
    review_average: float | None = None
    review_count: int = 0
    completed_bookings: int = Field(
        default=0, description="All-time completed bookings (public trust signal)."
    )
    avg_response_seconds: float | None = Field(
        default=None, description="Average first-response time in seconds, when known."
    )
    conversion_rate: float | None = Field(
        default=None, description="Completed / client enquiries (0-1), when enquiries exist."
    )


class ExploreVendorsResponse(BaseModel):
    """Every listed vendor in one market."""

    success: bool = True
    vendors: list[ExploreVendorRow] = Field(default_factory=list)


class ExploreVendorSingleResponse(BaseModel):
    """One listed vendor, for the vendor detail page."""

    success: bool = True
    vendor: ExploreVendorRow


class ExploreVendorFeaturedReview(BaseModel):
    """A real review quoted on a plan-search card."""

    rating: int
    body_excerpt: str
    reviewer_display: str


class ExploreVendorSearchRow(ExploreVendorRow):
    """Marketplace listing row, including which services matched the search."""

    matched_services: list[str] = Field(default_factory=list)
    match_tier: str = Field(
        default="exact", description="exact | related | fallback - how closely the listing matched the search"
    )
    featured_review: ExploreVendorFeaturedReview | None = None
    match_hint: str | None = None


class ExplorePlanNeed(BaseModel):
    """One checklist item of a plan search."""

    id: str
    label: str
    service_key: str
    keywords: list[str] = Field(default_factory=list)
    optional: bool = False
    rationale: str | None = None


class ExploreSearchPlan(BaseModel):
    """The checklist a plan search built from the query."""

    title: str
    event_types: list[str] = Field(default_factory=list)
    needs: list[ExplorePlanNeed] = Field(default_factory=list)
    intent_summary: str | None = None


class ExploreSearchSection(BaseModel):
    """One need of a plan search and its vendors."""

    need_id: str
    label: str
    service_key: str
    optional: bool = False
    vendors: list[ExploreVendorSearchRow] = Field(default_factory=list)
    # The whole unclaimed pool, which may be more than the cards shown.
    total_count: int = 0
    why: str | None = None


class ExploreVendorSearchResponse(BaseModel):
    """A search: one page of ranked vendors (simple) or the checklist sections (plan)."""

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


# --- public reviews -------------------------------------------------------------------------------


class PublicReviewItem(BaseModel):
    """One visible review on a vendor's public page."""

    id: str
    rating: int = Field(ge=1, le=5)
    body: str
    created_at: str | None = None
    reviewer_display: str
    event_name: str
    event_date: str = ""
    booking_total_label: str = ""
    image_urls: list[str] = Field(default_factory=list)


class VendorPublicReviewsResponse(BaseModel):
    """A vendor's visible reviews, newest first, with their average and count."""

    success: bool = True
    average_rating: float | None = None
    review_count: int = 0
    reviews: list[PublicReviewItem] = Field(default_factory=list)


# --- favourites -----------------------------------------------------------------------------------


class ClientFavoritesListResponse(BaseModel):
    """The client's saved vendors, most recently saved first."""

    success: bool = True
    vendor_user_ids: list[str] = Field(default_factory=list)


class ClientFavoritesMergeBody(BaseModel):
    """Vendors saved while signed out, to add to the account."""

    vendor_user_ids: list[str] = Field(default_factory=list, max_length=500)


class ClientFavoriteResponse(BaseModel):
    """Whether saving or unsaving a vendor worked."""

    success: bool


class ClientFavoritesMergeResponse(BaseModel):
    """How many vendor ids were merged into the account."""

    success: bool = True
    merged: int = 0


# --- geo ------------------------------------------------------------------------------------------


class AddressAutocompleteItem(BaseModel):
    """One address suggestion."""

    id: str
    address: str


class AddressAutocompleteResponse(BaseModel):
    """Address suggestions for a partial address, and whether a lookup provider is set up."""

    success: bool = True
    suggestions: list[AddressAutocompleteItem] = Field(default_factory=list)
    provider_configured: bool = True


class AddressResolveResponse(BaseModel):
    """One address, resolved to its parts."""

    success: bool = True
    postcode: str
    formatted_line: str
    line_1: str | None = None
    town_or_city: str | None = None
    county: str | None = None


class AddressFindResponse(BaseModel):
    """All address lines at a postcode."""

    success: bool = True
    addresses: list[str] = Field(default_factory=list)
    provider_configured: bool = True


# --- vendor analytics -----------------------------------------------------------------------------


class VendorAnalyticsResponse(BaseModel):
    """The vendor's analytics screen: headline numbers, the funnel and monthly series."""

    success: bool = True
    period_days: int = 90
    overview: dict[str, Any] = Field(default_factory=dict)
    funnel: dict[str, Any] = Field(default_factory=dict)
    enquiries_by_month: list[dict[str, Any]] = Field(default_factory=list)
    revenue_by_month: list[dict[str, Any]] = Field(default_factory=list)
    response_time_by_month: list[dict[str, Any]] = Field(default_factory=list)
    rating_by_month: list[dict[str, Any]] = Field(default_factory=list)
