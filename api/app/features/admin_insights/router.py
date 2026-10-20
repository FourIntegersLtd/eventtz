"""Staff routes for the admin console's dashboards, analytics, directory and vendor insights.

Every route here only requires `CurrentStaff` (a plain admin or a super admin):
these are read models, not actions that change anything, so there is no
super-admin-only gate anywhere in this slice.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.pagination import DEFAULT_LIST_LIMIT
from app.features.admin_insights import service
from app.features.admin_insights.errors import InvalidDateFilter
from app.features.admin_insights.schemas import (
    AdminDashboardMetrics,
    AdminDashboardSummary,
    AdminDirectorySearchResponse,
    AdminMarketplaceAnalyticsResponse,
    AdminVendorInsightsResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/dashboard-summary", response_model=AdminDashboardSummary, responses=error_responses(*ROLE_ERRORS)
)
async def get_dashboard_summary(session: SessionDep, principal: CurrentStaff) -> AdminDashboardSummary:
    """Headline counts across users, vendors, bookings, conversations and reviews."""
    return await service.dashboard_summary(session)


@router.get(
    "/dashboard-metrics", response_model=AdminDashboardMetrics, responses=error_responses(*ROLE_ERRORS)
)
async def get_dashboard_metrics(
    session: SessionDep,
    principal: CurrentStaff,
    days: Annotated[int, Query(ge=7, le=90)] = 30,
) -> AdminDashboardMetrics:
    """Bookings-created, bookings-paid and signup charts over a rolling window of days."""
    return await service.dashboard_metrics(session, requested_days=days)


@router.get(
    "/marketplace-analytics",
    response_model=AdminMarketplaceAnalyticsResponse,
    responses=error_responses(*ROLE_ERRORS, InvalidDateFilter),
)
async def get_marketplace_analytics(
    session: SessionDep,
    principal: CurrentStaff,
    from_date: str | None = None,
    to_date: str | None = None,
    category_offset: Annotated[int, Query(ge=0)] = 0,
    category_limit: Annotated[int, Query(ge=1, le=200)] = DEFAULT_LIST_LIMIT,
) -> AdminMarketplaceAnalyticsResponse:
    """The marketplace funnel over client-initiated enquiries in a date range (default: last 30 days)."""
    return await service.marketplace_analytics(
        session,
        from_date_raw=from_date,
        to_date_raw=to_date,
        category_offset=category_offset,
        category_limit=category_limit,
    )


@router.get(
    "/directory/search", response_model=AdminDirectorySearchResponse, responses=error_responses(*ROLE_ERRORS)
)
async def search_directory(
    session: SessionDep,
    principal: CurrentStaff,
    search_term: Annotated[str, Query(alias="q", min_length=1, max_length=200)],
    kinds: Annotated[str, Query(description="Comma-separated: client, vendor, or both.")] = "client,vendor",
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
) -> AdminDirectorySearchResponse:
    """Accounts matching `q`: a client's email, or a vendor's email or business name."""
    return await service.directory_search(session, query=search_term, kinds=kinds, limit=limit)


@router.get(
    "/vendors/{user_id}/insights",
    response_model=AdminVendorInsightsResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def get_vendor_insights(
    session: SessionDep, principal: CurrentStaff, user_id: str
) -> AdminVendorInsightsResponse:
    """One vendor's booking history and review standing. Never 404s: an unknown id reads as all-zero."""
    return await service.vendor_insights(session, user_id)
