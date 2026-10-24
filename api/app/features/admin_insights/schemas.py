"""Response shapes for the admin console's dashboards, analytics, directory and vendor insights.

Marketplace analytics is fully named models (as sent by the baseline). Money stays
float GBP here, matching that existing baseline contract - not the integer-pence rule,
which applies inside a slice's own `domain.py` money maths, not a read-only display
aggregate carried over from elsewhere.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.core.pagination import DEFAULT_LIST_LIMIT


class AdminDashboardSummary(BaseModel):
    """Headline counts across users, vendors, bookings, conversations and reviews."""

    success: bool = True
    users_client: int
    users_vendor: int
    users_admin: int
    vendors_pending: int
    vendors_approved: int
    vendors_banned: int
    bookings_pending: int
    bookings_accepted: int
    bookings_completed: int
    bookings_declined: int
    bookings_cancelled: int
    bookings_paid_count: int
    bookings_needing_support: int
    conversations_count: int
    reviews_count: int


class AdminDashboardTimeBucket(BaseModel):
    """One day's count and takings, for the bookings-created and bookings-paid charts."""

    date: str
    count: int = 0
    gmv_gbp: float = 0.0


class AdminDashboardSignupBucket(BaseModel):
    """One day's new client and vendor accounts."""

    date: str
    clients: int = 0
    vendors: int = 0


class AdminDashboardMetrics(BaseModel):
    """The admin dashboard's charts over a rolling window of days."""

    success: bool = True
    period_days: int
    bookings_created: list[AdminDashboardTimeBucket] = Field(default_factory=list)
    bookings_paid: list[AdminDashboardTimeBucket] = Field(default_factory=list)
    signups: list[AdminDashboardSignupBucket] = Field(default_factory=list)
    open_disputes_count: int = 0


class MarketplaceOverview(BaseModel):
    """Headline funnel numbers; rates are fractions (0 to 1), money is pounds."""

    vendors_total: int
    vendors_active: int
    enquiries: int
    accepted: int
    paid: int
    completed: int
    enquiry_to_acceptance_rate: float
    acceptance_to_payment_rate: float
    overall_conversion_rate: float
    avg_booking_value_gbp: float
    avg_vendor_response_seconds: float | None
    reply_within_1h_rate: float | None
    reply_within_6h_rate: float | None
    reply_within_24h_rate: float | None
    enquiry_vendor_reminders: int
    enquiry_client_nudges: int
    enquiry_multi_batches: int
    avg_customer_rating: float
    review_count: int
    profile_views: int
    unfulfilled: int


class MarketplaceMonthCount(BaseModel):
    """A count of bookings in one `YYYY-MM` month."""

    month: str
    count: int


class MarketplaceBreakdownRow(BaseModel):
    """The funnel for one category or location (`key`)."""

    key: str
    enquiries: int
    accepted: int
    paid: int
    completed: int
    failed: int
    revenue_gbp: float
    conversion_rate: float
    accept_rate: float
    avg_booking_value_gbp: float


class MarketplaceFailureReason(BaseModel):
    """How many unfinished enquiries ended for one failure reason."""

    reason: str
    count: int


class MarketplaceTopVendor(BaseModel):
    """One vendor's enquiry results in the range."""

    vendor_user_id: str
    business_name: str
    enquiries: int
    completed: int
    conversion_rate: float
    avg_response_seconds: float | None
    revenue_gbp: float


class MarketplaceCategoryHint(BaseModel):
    """A category with high demand and a high failure rate."""

    category: str
    enquiries: int
    failed: int
    message: str


class MarketplaceLocationHint(BaseModel):
    """A location with high demand and a high failure rate."""

    location: str
    enquiries: int
    failed: int
    message: str


class MarketplaceRecruitmentHints(BaseModel):
    """Where Eventtz should recruit more vendors."""

    categories: list[MarketplaceCategoryHint] = Field(default_factory=list)
    locations: list[MarketplaceLocationHint] = Field(default_factory=list)


class AdminMarketplaceAnalyticsResponse(BaseModel):
    """The marketplace funnel: enquiries through acceptance, payment and completion."""

    success: bool = True
    from_date: str
    to_date: str
    overview: MarketplaceOverview
    enquiries_by_month: list[MarketplaceMonthCount] = Field(default_factory=list)
    completed_by_month: list[MarketplaceMonthCount] = Field(default_factory=list)
    by_category: list[MarketplaceBreakdownRow] = Field(default_factory=list)
    by_category_chart: list[MarketplaceBreakdownRow] = Field(default_factory=list)
    by_category_total: int = 0
    category_offset: int = 0
    category_limit: int = DEFAULT_LIST_LIMIT
    by_location: list[MarketplaceBreakdownRow] = Field(default_factory=list)
    failure_reasons: list[MarketplaceFailureReason] = Field(default_factory=list)
    top_vendors: list[MarketplaceTopVendor] = Field(default_factory=list)
    recruitment_hints: MarketplaceRecruitmentHints


class AdminDirectoryUserRow(BaseModel):
    """One matched account: a client or vendor, with the label the console should show."""

    user_id: str
    label: str
    kind: Literal["client", "vendor"]
    email: str | None = None


class AdminDirectorySearchResponse(BaseModel):
    """Every account matching a directory search, capped at `limit`."""

    success: bool = True
    users: list[AdminDirectoryUserRow]


class AdminVendorMonthBookings(BaseModel):
    """One month of a vendor's bookings: the `month` (YYYY-MM) plus a count per booking status.

    The status keys are open-ended (every status the vendor has ever had appears in every row),
    so they ride as extra integer fields after `month`.
    """

    model_config = ConfigDict(extra="allow", json_schema_extra={"additionalProperties": {"type": "integer"}})

    month: str


class AdminVendorInsightsResponse(BaseModel):
    """One vendor's booking history and review standing, for the admin console's vendor page."""

    success: bool = True
    user_id: str
    review_average: float | None = None
    review_count: int = 0
    bookings_total: int = 0
    bookings_by_status: dict[str, int] = Field(default_factory=dict)
    bookings_by_month: list[AdminVendorMonthBookings] = Field(default_factory=list)
    open_disputes_on_bookings: int = 0
    explore_path: str = ""
