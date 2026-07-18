"""Vendor portal analytics HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, Query, Request, Response

from app.contracts.payments import VendorAnalyticsResponse
from app.features.auth.http.guards import require_vendor
from app.features.vendors.analytics import get_vendor_analytics

router = APIRouter(prefix="/vendor", tags=["vendor-analytics"])


@router.get("/analytics", response_model=VendorAnalyticsResponse)
def vendor_analytics(
    request: Request,
    response: Response,
    days: int = Query(90, ge=7, le=365),
) -> VendorAnalyticsResponse:
    user = require_vendor(request, response)
    uid = str(user.get("id") or "")
    data = get_vendor_analytics(uid, days=days)
    return VendorAnalyticsResponse(**data)
