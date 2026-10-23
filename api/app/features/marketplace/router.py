"""Public explore routes: the vendor list, search, one vendor's page and their reviews."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import OptionalUser
from app.core.db import SessionDep
from app.core.errors import AppError, error_responses
from app.core.pagination import PageDep
from app.core.ports import LanguageModelDependency
from app.features.marketplace import service_explore, service_search
from app.features.marketplace.errors import InvalidVendorId, VendorNotListed
from app.features.marketplace.schemas import (
    ExploreVendorSearchResponse,
    ExploreVendorSingleResponse,
    ExploreVendorsResponse,
    VendorPublicReviewsResponse,
)

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("/explore", response_model=ExploreVendorsResponse, responses=error_responses(AppError))
async def get_explore_vendors(
    session: SessionDep,
    viewer: OptionalUser,
    country: str | None = Query(None, description="ISO country code (default GB)."),
) -> ExploreVendorsResponse:
    """Every listed vendor in one market, newest first."""
    return ExploreVendorsResponse(vendors=await service_explore.explore_vendors(session, viewer, country))


@router.get(
    "/explore/vendor/{vendor_user_id}",
    response_model=ExploreVendorSingleResponse,
    responses=error_responses(InvalidVendorId, VendorNotListed),
)
async def get_explore_vendor_by_id(
    session: SessionDep, viewer: OptionalUser, vendor_user_id: str
) -> ExploreVendorSingleResponse:
    """One listed vendor for the browse detail page."""
    return ExploreVendorSingleResponse(
        vendor=await service_explore.explore_vendor(session, viewer, vendor_user_id)
    )


@router.get(
    "/explore/search", response_model=ExploreVendorSearchResponse, responses=error_responses(AppError)
)
async def get_explore_vendors_search(
    session: SessionDep,
    viewer: OptionalUser,
    language_model: LanguageModelDependency,
    page: PageDep,
    types: str | None = Query(None, description="Comma-separated service keys (e.g. photography,catering)."),
    location: str | None = Query(None, description="Substring match against city, name, services."),
    search: str | None = Query(
        None, alias="q", description="Free-text search (vendor name, city, services)."
    ),
    dates: str | None = Query(
        None, description="Comma-separated ISO dates (max 3); availability filter later."
    ),
    flexible: bool = Query(
        False, description="When true, date selection is not used for filtering (reserved)."
    ),
    budget_min: float | None = Query(None, ge=0),
    budget_max: float | None = Query(None, ge=0),
    sort: str = Query("relevance", description="relevance | price_asc | price_desc | proximity | rating"),
    vendor_ids: str | None = Query(
        None, description="Comma-separated vendor user IDs - restrict search (e.g. favorites)."
    ),
    country: str | None = Query(None, description="ISO country code (default GB)."),
) -> ExploreVendorSearchResponse:
    """Search listed vendors: a ranked page, or checklist sections for event planning."""
    result = await service_search.search_vendors(
        session,
        viewer,
        service_search.SearchRequest(
            types=types,
            location=location,
            search=search,
            dates=dates,
            flexible=flexible,
            budget_min=budget_min,
            budget_max=budget_max,
            sort=sort,
            vendor_ids=vendor_ids,
            country=country,
            limit=page.limit,
            offset=page.offset,
        ),
        language_model=language_model,
    )
    return service_search.search_response(result)


@router.get(
    "/{vendor_user_id}/reviews",
    response_model=VendorPublicReviewsResponse,
    responses=error_responses(InvalidVendorId),
)
async def get_vendor_public_reviews(session: SessionDep, vendor_user_id: str) -> VendorPublicReviewsResponse:
    """A vendor's visible reviews, newest first."""
    return await service_explore.public_reviews(session, vendor_user_id)
