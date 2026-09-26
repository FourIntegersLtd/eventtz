"""Response shapes for the admin console's dashboards, analytics, directory and vendor insights.

Loosely typed where the baseline's own contract is (`overview`, `by_category`,
`recruitment_hints`...): `dict[str, Any]`/`list[dict[str, Any]]`, same as
`backend/app/contracts/admin.py`'s `AdminMarketplaceAnalyticsResponse`. Money stays
float GBP here, matching that existing baseline contract - not the integer-pence rule,
which applies inside a slice's own `domain.py` money maths, not a read-only display
aggregate carried over from elsewhere.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


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


class AdminMarketplaceAnalyticsResponse(BaseModel):
    """The marketplace funnel: enquiries through acceptance, payment and completion."""

    success: bool = True
    from_date: str
    to_date: str
    overview: dict[str, Any] = Field(default_factory=dict)
    by_category: list[dict[str, Any]] = Field(default_factory=list)
    by_location: list[dict[str, Any]] = Field(default_factory=list)
    failure_reasons: list[dict[str, Any]] = Field(default_factory=list)
    top_vendors: list[dict[str, Any]] = Field(default_factory=list)
    recruitment_hints: dict[str, Any] = Field(default_factory=dict)


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


class AdminVendorInsightsResponse(BaseModel):
    """One vendor's booking history and review standing, for the admin console's vendor page."""

    success: bool = True
    user_id: str
    review_average: float | None = None
    review_count: int = 0
    bookings_total: int = 0
    bookings_by_status: dict[str, int] = Field(default_factory=dict)
    bookings_by_month: list[dict[str, Any]] = Field(default_factory=list)
    open_disputes_on_bookings: int = 0
    explore_path: str = ""
