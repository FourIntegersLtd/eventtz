"""Approved vendors for client explore and search."""

import uuid

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.core.logging import get_logger
from app.contracts.reviews import PublicReviewItem, VendorPublicReviewsResponse
from app.contracts.vendor import (
    ExplorePlanNeed,
    ExploreSearchPlan,
    ExploreSearchSection,
    ExploreVendorSearchResponse,
    ExploreVendorSingleResponse,
    ExploreVendorsResponse,
    explore_vendor_row_from_db,
)
from app.features.bookings.reviews import (
    list_public_reviews_for_vendor,
    merge_review_stats_into_vendor_rows,
)
from app.features.vendors.public_metrics import merge_public_metrics_into_vendor_rows
from app.features.vendors.moderation import (
    get_approved_vendor_for_explore_by_id,
    list_approved_vendors_for_explore,
)
from app.features.vendors.qa_visibility import explore_viewer_from_auth
from app.features.auth.http.guards import get_optional_session_user
from app.features.vendors.markets import normalize_country_code
from app.features.vendors import messages as vendor_messages

from app.features.vendors.search import search_approved_vendors

router = APIRouter(prefix="/vendors", tags=["vendors"])
logger = get_logger(__name__)


def _parse_vendor_ids(raw: str | None) -> list[str] | None:
    if not raw or not str(raw).strip():
        return None
    out: list[str] = []
    for part in str(raw).split(","):
        p = part.strip()
        if p:
            out.append(p)
    return out[:500] if out else None


@router.get("/explore", response_model=ExploreVendorsResponse)
def get_explore_vendors(
    request: Request,
    response: Response,
    country: str | None = Query(None, description="ISO country code (default GB)."),
) -> ExploreVendorsResponse:
    viewer = explore_viewer_from_auth(get_optional_session_user(request, response))
    rows = list_approved_vendors_for_explore(
        country_code=normalize_country_code(country),
        viewer=viewer,
    )
    rows = merge_review_stats_into_vendor_rows(rows)
    rows = merge_public_metrics_into_vendor_rows(rows)
    logger.info("GET /vendors/explore approved_vendors_count=%s", len(rows))
    return ExploreVendorsResponse(success=True, vendors=rows)


@router.get("/explore/vendor/{vendor_user_id}", response_model=ExploreVendorSingleResponse)
def get_explore_vendor_by_id(
    vendor_user_id: str,
    request: Request,
    response: Response,
) -> ExploreVendorSingleResponse:
    """One approved vendor for the client browse detail page (direct lookup)."""
    try:
        uuid.UUID(vendor_user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=vendor_messages.VENDOR_NOT_FOUND_INVALID_ID) from e

    viewer = explore_viewer_from_auth(get_optional_session_user(request, response))
    row = get_approved_vendor_for_explore_by_id(vendor_user_id, viewer=viewer)
    if not row:
        logger.info("GET /vendors/explore/vendor/%s not found", vendor_user_id)
        raise HTTPException(status_code=404, detail=vendor_messages.VENDOR_NOT_FOUND_OR_NOT_LISTED)

    merged = merge_review_stats_into_vendor_rows([row])
    merged = merge_public_metrics_into_vendor_rows(merged)
    if not merged:
        raise HTTPException(status_code=404, detail=vendor_messages.VENDOR_NOT_FOUND_OR_NOT_LISTED)
    r0 = merged[0]
    try:
        from app.features.analytics.events import record_marketplace_event

        payload = r0.get("payload") if isinstance(r0.get("payload"), dict) else {}
        services = payload.get("servicesOffered") if isinstance(payload.get("servicesOffered"), list) else []
        category = str(services[0]) if services else None
        location = str(payload.get("baseCity") or r0.get("base_city_normalized") or "") or None
        record_marketplace_event(
            "vendor_profile_viewed",
            vendor_user_id=vendor_user_id,
            category=category,
            location=location,
        )
    except Exception:
        pass
    vendor = explore_vendor_row_from_db(r0)
    logger.info("GET /vendors/explore/vendor/%s found", vendor_user_id)
    return ExploreVendorSingleResponse(vendor=vendor)


@router.get("/explore/search", response_model=ExploreVendorSearchResponse)
def get_explore_vendors_search(
    request: Request,
    response: Response,
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
    vendor_ids: str | None = Query(
        None,
        description="Comma-separated vendor user IDs - restrict search (e.g. favorites).",
    ),
    country: str | None = Query(None, description="ISO country code (default GB)."),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> ExploreVendorSearchResponse:
    viewer = explore_viewer_from_auth(get_optional_session_user(request, response))
    result = search_approved_vendors(
        types=types,
        location=location,
        q=q,
        dates=dates,
        flexible=flexible,
        budget_min=budget_min,
        budget_max=budget_max,
        sort=sort,
        vendor_user_ids=_parse_vendor_ids(vendor_ids),
        country=country,
        limit=limit,
        offset=offset,
        viewer=viewer,
    )
    logger.info(
        "GET /vendors/explore/search total_count=%s page=%s mode=%s exact=%s related=%s sort=%s",
        result.total_count,
        len(result.vendors),
        result.search_mode,
        result.has_exact,
        result.has_related,
        sort,
    )
    plan_out = None
    if result.plan is not None:
        # Checklist keeps ``rationale``; browse sections use ``why`` for the same copy.
        plan_out = ExploreSearchPlan(
            title=result.plan.title,
            event_types=list(result.plan.event_types),
            needs=[
                ExplorePlanNeed(
                    id=n.id,
                    label=n.label,
                    service_key=n.service_key,
                    keywords=list(n.keywords),
                    optional=n.optional,
                    rationale=n.rationale,
                )
                for n in result.plan.needs
            ],
            intent_summary=result.plan.intent_summary,
        )
    sections_out = [
        ExploreSearchSection(
            need_id=s.need_id,
            label=s.label,
            service_key=s.service_key,
            optional=s.optional,
            vendors=s.vendors,
            total_count=s.total_count,
            why=s.why,
        )
        for s in result.sections
    ]
    return ExploreVendorSearchResponse(
        success=True,
        total_count=result.total_count,
        vendors=result.vendors,
        match_notice=result.match_notice,
        has_exact=result.has_exact,
        has_related=result.has_related,
        search_mode=result.search_mode,
        intent_summary=result.intent_summary,
        plan=plan_out,
        sections=sections_out,
    )


@router.get("/{vendor_user_id}/reviews", response_model=VendorPublicReviewsResponse)
def get_vendor_public_reviews(vendor_user_id: str) -> VendorPublicReviewsResponse:
    try:
        uuid.UUID(vendor_user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=vendor_messages.VENDOR_NOT_FOUND_INVALID_ID) from e

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
