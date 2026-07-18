"""Admin console: dashboard and marketplace analytics."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.auth.http.guards import require_admin
from app.contracts.admin import (
    AdminDashboardMetrics,
    AdminDashboardSummary,
    AdminMarketplaceAnalyticsResponse,
)
from app.features.admin import get_admin_dashboard_metrics, get_admin_dashboard_summary

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard-summary", response_model=AdminDashboardSummary)
def admin_dashboard_summary(request: Request, response: Response) -> AdminDashboardSummary:
    require_admin(request, response)
    data = get_admin_dashboard_summary()
    return AdminDashboardSummary(**data)


@router.get("/dashboard-metrics", response_model=AdminDashboardMetrics)
def admin_dashboard_metrics(
    request: Request,
    response: Response,
    days: int = Query(30, ge=7, le=90),
) -> AdminDashboardMetrics:
    require_admin(request, response)
    allowed = days if days in {7, 30, 60, 90} else 30
    data = get_admin_dashboard_metrics(allowed)
    return AdminDashboardMetrics(**data)


@router.get("/marketplace-analytics", response_model=AdminMarketplaceAnalyticsResponse)
def admin_marketplace_analytics(
    request: Request,
    response: Response,
    from_date: str | None = Query(None, description="YYYY-MM-DD"),
    to_date: str | None = Query(None, description="YYYY-MM-DD"),
    country_code: str | None = Query(None),
) -> AdminMarketplaceAnalyticsResponse:
    require_admin(request, response)
    from datetime import date as date_cls

    from app.features.admin.marketplace_analytics import get_marketplace_analytics

    def _parse(d: str | None) -> date_cls | None:
        if not d:
            return None
        try:
            return date_cls.fromisoformat(d.strip()[:10])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date. Use YYYY-MM-DD.") from None

    data = get_marketplace_analytics(
        from_date=_parse(from_date),
        to_date=_parse(to_date),
        country_code=country_code,
    )
    return AdminMarketplaceAnalyticsResponse(**data)
