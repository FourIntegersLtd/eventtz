"""The vendor's own analytics screen."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentVendor
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.features.marketplace import service_analytics
from app.features.marketplace.schemas import VendorAnalyticsResponse

router = APIRouter(prefix="/vendor", tags=["vendor-analytics"])


@router.get("/analytics", response_model=VendorAnalyticsResponse, responses=error_responses(*ROLE_ERRORS))
async def vendor_analytics(
    session: SessionDep, vendor: CurrentVendor, days: int = Query(90, ge=7, le=365)
) -> VendorAnalyticsResponse:
    """Enquiries, the booking funnel, revenue, ratings and reply times over the last `days` days."""
    return VendorAnalyticsResponse(**await service_analytics.analytics_for(session, vendor, days))
