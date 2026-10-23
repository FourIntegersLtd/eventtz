"""Browsing listed vendors: the explore list, one vendor's page and their public reviews.

Staff-designated QA vendors are hidden from everyone except the test client each
one is assigned to (`QA_CLIENT_VENDOR_VISIBILITY`); that client also sees them
when they are approved but not otherwise listed.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.settings import get_settings
from app.features.marketplace import repository_explore, service_events
from app.features.marketplace.domain_metrics import VendorSignals as VendorSignals

# Re-exported: bookings names a booking's reviewer the way public reviews do.
from app.features.marketplace.domain_metrics import reviewer_display as reviewer_display
from app.features.marketplace.domain_metrics import vendor_signals
from app.features.marketplace.domain_search import vendor_available_on
from app.features.marketplace.errors import InvalidVendorId, VendorNotListed
from app.features.marketplace.schemas import ExploreVendorRow, PublicReviewItem, VendorPublicReviewsResponse
from app.features.vendors import service_listing
from app.features.vendors.schemas import ListedVendor
from app.features.vendors.service_catalogue import normalize_country_code

# Visible reviews shown on a vendor's page.
PUBLIC_REVIEW_LIMIT = 50


def require_vendor_uuid(vendor_user_id: str) -> None:
    """Raise `InvalidVendorId` unless the path id is a UUID."""
    try:
        uuid.UUID(vendor_user_id)
    except ValueError as error:
        raise InvalidVendorId() from error


# --- QA visibility --------------------------------------------------------------------------------


def _qa_vendor_ids_for(viewer: Principal | None) -> frozenset[str]:
    """The QA vendors this viewer may see: only a client named in the setting has any."""
    if viewer is None or viewer.user_type != "client":
        return frozenset()
    email = (viewer.email or "").strip().lower()
    if not email:
        return frozenset()
    return get_settings().qa_client_vendor_visibility_map.get(email, frozenset())


def _is_qa_vendor(vendor_user_id: str) -> bool:
    """True when the vendor is a staff-designated QA vendor."""
    return vendor_user_id.strip() in get_settings().qa_scoped_vendor_ids


async def bookable_vendor_payload(
    session: AsyncSession, vendor_user_id: str, *, viewer: Principal | None, operator: bool = False
) -> dict[str, Any] | None:
    """The profile form of a vendor who can take this booking, or `None` when they cannot.

    A listed vendor qualifies. A QA vendor qualifies only when approved and either the
    viewer is the test client assigned to them or the vendor is acting on their own
    bookings (`operator`). Closed accounts never qualify.
    """
    if _is_qa_vendor(vendor_user_id):
        if not operator and vendor_user_id.strip() not in _qa_vendor_ids_for(viewer):
            return None
        found = await service_listing.approved_vendors(session, user_ids=[vendor_user_id], country_code=None)
        return found[0].payload if found else None
    listed = await service_listing.listed_vendor(session, vendor_user_id)
    return listed.payload if listed is not None else None


def vendor_works_on(payload: dict[str, Any], event_dates: list[str]) -> bool:
    """True unless a date is blocked or falls on a weekday the vendor does not work (as in search)."""
    return vendor_available_on(payload, event_dates)


async def vendors_for_viewer(
    session: AsyncSession, viewer: Principal | None, listed: list[ListedVendor], *, country_code: str
) -> list[ListedVendor]:
    """Drop QA vendors the viewer may not see, then add the viewer's own QA vendors.

    The added QA vendors ignore the search filters (as in the baseline); they only
    need to be approved and in the market.
    """
    visible_qa_ids = _qa_vendor_ids_for(viewer)
    vendors = [
        vendor for vendor in listed if not _is_qa_vendor(vendor.user_id) or vendor.user_id in visible_qa_ids
    ]
    if not visible_qa_ids:
        return vendors
    seen_ids = {vendor.user_id for vendor in vendors}
    for qa_vendor in await service_listing.approved_vendors(
        session, user_ids=sorted(visible_qa_ids), country_code=country_code
    ):
        if qa_vendor.user_id not in seen_ids:
            vendors.append(qa_vendor)
            seen_ids.add(qa_vendor.user_id)
    return vendors


# --- signals --------------------------------------------------------------------------------------


async def signals_for(session: AsyncSession, vendor_user_ids: list[str]) -> dict[str, VendorSignals]:
    """Review stats and booking signals for each vendor."""
    if not vendor_user_ids:
        return {}
    stats = await repository_explore.review_stats(session, vendor_user_ids)
    totals = await repository_explore.booking_totals(session, vendor_user_ids)
    return vendor_signals(vendor_user_ids, stats, totals)


def explore_row(vendor: ListedVendor, signals: VendorSignals | None) -> ExploreVendorRow:
    """One explore card from a listed vendor and their signals."""
    found = signals or VendorSignals()
    return ExploreVendorRow(
        user_id=vendor.user_id,
        email=vendor.email,
        status=vendor.status or "draft",
        approval_status=vendor.approval_status or "pending",
        profile_form_data=vendor.payload,
        updated_at=vendor.updated_at,
        review_average=found.review_average,
        review_count=found.review_count,
        completed_bookings=found.completed_bookings,
        avg_response_seconds=found.avg_response_seconds,
        conversion_rate=found.conversion_rate,
    )


# --- use cases ------------------------------------------------------------------------------------


async def explore_vendors(
    session: AsyncSession, viewer: Principal | None, country: str | None
) -> list[ExploreVendorRow]:
    """Every listed vendor in the market (GB by default), newest first, with their signals."""
    country_code = normalize_country_code(country)
    listed = await service_listing.listed_vendors(session, country_code=country_code)
    vendors = await vendors_for_viewer(session, viewer, listed, country_code=country_code)
    signals = await signals_for(session, [vendor.user_id for vendor in vendors])
    return [explore_row(vendor, signals.get(vendor.user_id)) for vendor in vendors]


async def explore_vendor(
    session: AsyncSession, viewer: Principal | None, vendor_user_id: str
) -> ExploreVendorRow:
    """One listed vendor's page (any market); records a profile view for the funnel."""
    require_vendor_uuid(vendor_user_id)
    vendor: ListedVendor | None
    if _is_qa_vendor(vendor_user_id):
        allowed = vendor_user_id.strip() in _qa_vendor_ids_for(viewer)
        found = (
            await service_listing.approved_vendors(session, user_ids=[vendor_user_id], country_code=None)
            if allowed
            else []
        )
        vendor = found[0] if found else None
    else:
        vendor = await service_listing.listed_vendor(session, vendor_user_id)
    if vendor is None:
        raise VendorNotListed()

    services = vendor.payload.get("servicesOffered")
    await service_events.record_marketplace_event(
        session,
        "vendor_profile_viewed",
        vendor_user_id=vendor_user_id,
        category=str(services[0]) if isinstance(services, list) and services else None,
        location=str(vendor.payload.get("baseCity") or "") or None,
    )
    signals = await signals_for(session, [vendor.user_id])
    return explore_row(vendor, signals.get(vendor.user_id))


async def public_reviews(session: AsyncSession, vendor_user_id: str) -> VendorPublicReviewsResponse:
    """The vendor's visible reviews, newest first (at most 50), with their average and count.

    Works for any vendor id, listed or not (as in the baseline).
    """
    require_vendor_uuid(vendor_user_id)
    reviews = await repository_explore.visible_reviews(session, vendor_user_id)
    stats = await repository_explore.review_stats(session, [vendor_user_id])
    summary = stats[0] if stats else None
    return VendorPublicReviewsResponse(
        average_rating=summary.average_rating if summary else None,
        review_count=summary.review_count if summary else 0,
        reviews=[
            PublicReviewItem(
                id=review.id,
                rating=review.rating or 0,
                body=review.body or "",
                created_at=review.created_at,
                reviewer_display=reviewer_display(review.client_email),
                event_name=review.event_name or "Event",
                event_date=(review.event_date or "")[:10],
                booking_total_label=review.total_label or "",
            )
            for review in reviews[:PUBLIC_REVIEW_LIMIT]
        ],
    )
