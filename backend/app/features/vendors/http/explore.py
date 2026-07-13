"""Client-facing vendor explore listing (approved vendors only)."""

import uuid

from fastapi import APIRouter, HTTPException, Query

from app.core.logging import get_logger
from app.contracts.reviews import PublicReviewItem, VendorPublicReviewsResponse
from app.contracts.vendor import (
    ExploreVendorRow,
    ExploreVendorSearchResponse,
    ExploreVendorSingleResponse,
    ExploreVendorsResponse,
)
from app.features.bookings.reviews import (
    list_public_reviews_for_vendor,
    merge_review_stats_into_vendor_rows,
)
from app.features.vendors.moderation import list_approved_vendors_for_explore
from app.features.vendors.search import search_approved_vendors

router = APIRouter(prefix="/vendors", tags=["vendors"])
logger = get_logger(__name__)


@router.get("/explore", response_model=ExploreVendorsResponse)
def get_explore_vendors() -> ExploreVendorsResponse:
    rows = list_approved_vendors_for_explore()
    rows = merge_review_stats_into_vendor_rows(rows)
    logger.info("GET /vendors/explore approved_vendors_count=%s", len(rows))
    return ExploreVendorsResponse(success=True, vendors=rows)


@router.get("/explore/vendor/{vendor_user_id}", response_model=ExploreVendorSingleResponse)
def get_explore_vendor_by_id(vendor_user_id: str) -> ExploreVendorSingleResponse:
    """Single approved vendor for client browse detail (avoids loading the full list)."""
    try:
        uuid.UUID(vendor_user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid vendor id.") from e

    rows = list_approved_vendors_for_explore()
    for row in rows:
        if not isinstance(row, dict):
            continue
        if str(row.get("user_id") or "") != vendor_user_id:
            continue
        merged = merge_review_stats_into_vendor_rows([row])
        if not merged:
            break
        r0 = merged[0]
        vendor = ExploreVendorRow(
            user_id=str(r0.get("user_id") or ""),
            email=r0.get("email"),
            status=r0.get("status") or "draft",
            approval_status=r0.get("approval_status") or "pending",
            payload=r0.get("payload") if isinstance(r0.get("payload"), dict) else {},
            updated_at=str(r0.get("updated_at")) if r0.get("updated_at") else None,
            review_average=r0.get("review_average"),
            review_count=int(r0.get("review_count") or 0),
        )
        logger.info("GET /vendors/explore/vendor/%s found", vendor_user_id)
        return ExploreVendorSingleResponse(vendor=vendor)

    logger.info("GET /vendors/explore/vendor/%s not found", vendor_user_id)
    raise HTTPException(status_code=404, detail="Vendor not found or not listed.")


@router.get("/explore/search", response_model=ExploreVendorSearchResponse)
def get_explore_vendors_search(
    types: str | None = Query(None, description="Comma-separated service keys (e.g. photography,catering)."),
    location: str | None = Query(None, description="Substring match against city, name, services."),
    q: str | None = Query(None, description="Free-text search (vendor name, city, services)."),
    dates: str | None = Query(None, description="Comma-separated ISO dates (max 3); availability filter later."),
    flexible: bool = Query(False, description="When true, date selection is not used for filtering (reserved)."),
    budget_min: float | None = Query(None, ge=0),
    budget_max: float | None = Query(None, ge=0),
    sort: str = Query(
        "relevance",
        description="relevance | price_asc | price_desc | proximity | rating",
    ),
) -> ExploreVendorSearchResponse:
    result = search_approved_vendors(
        types=types,
        location=location,
        q=q,
        dates=dates,
        flexible=flexible,
        budget_min=budget_min,
        budget_max=budget_max,
        sort=sort,
    )
    logger.info(
        "GET /vendors/explore/search total_count=%s exact=%s related=%s sort=%s",
        len(result.vendors),
        result.has_exact,
        result.has_related,
        sort,
    )
    return ExploreVendorSearchResponse(
        success=True,
        total_count=len(result.vendors),
        vendors=result.vendors,
        match_notice=result.match_notice,
        has_exact=result.has_exact,
        has_related=result.has_related,
    )


@router.get("/{vendor_user_id}/reviews", response_model=VendorPublicReviewsResponse)
def get_vendor_public_reviews(vendor_user_id: str) -> VendorPublicReviewsResponse:
    try:
        uuid.UUID(vendor_user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid vendor id.") from e

    raw_rows, summary = list_public_reviews_for_vendor(vendor_user_id, limit=50)
    items = [
        PublicReviewItem(
            id=r["id"],
            rating=r["rating"],
            body=r["body"],
            created_at=str(r["created_at"]) if r.get("created_at") else None,
            reviewer_display=r["reviewer_display"],
            event_name=r["event_name"],
            event_date=r.get("event_date") or "",
            booking_total_label=r.get("booking_total_label") or "",
        )
        for r in raw_rows
    ]
    return VendorPublicReviewsResponse(
        average_rating=summary.get("average_rating"),
        review_count=int(summary.get("review_count") or 0),
        reviews=items,
    )
