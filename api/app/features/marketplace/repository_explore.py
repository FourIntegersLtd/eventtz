"""Read-only queries over other slices' tables for explore cards, public reviews and analytics.

`booking_requests`, `booking_reviews` and the `vendor_review_stats` view belong to
bookings and reviews, which are not rebuilt yet. They are read here through
lightweight table handles (typed, so ids bind as uuid) and move behind those
slices' services when they are rebuilt.

Every function takes the request's session and never commits (ADR 0002).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Date,
    DateTime,
    Double,
    Integer,
    Numeric,
    Text,
    Uuid,
    case,
    column,
    func,
    or_,
    select,
    table,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.marketplace.models import MarketplaceEvent
from app.features.marketplace.rows import (
    AnalyticsEnquiryRow,
    AnalyticsRatingRow,
    BookingTotalsRow,
    PublicReviewRow,
    ReviewStatsRow,
    SnippetCandidateRow,
)

_booking_requests = table(
    "booking_requests",
    column("id", Uuid),
    column("vendor_user_id", Uuid),
    column("status", Text),
    column("payment_status", Text),
    column("initiator", Text),
    column("event_name", Text),
    column("event_date", Date),
    column("total_label", Text),
    column("created_at", DateTime(timezone=True)),
    column("accepted_at", DateTime(timezone=True)),
    column("completed_at", DateTime(timezone=True)),
    column("vendor_response_time_seconds", Integer),
    column("payment_amount_gbp", Numeric),
    column("vendor_amount_gbp", Numeric),
    column("failure_reason", Text),
)
_booking_reviews = table(
    "booking_reviews",
    column("id", Uuid),
    column("booking_request_id", Uuid),
    column("vendor_user_id", Uuid),
    column("client_user_id", Uuid),
    column("rating", Integer),
    column("body", Text),
    column("created_at", DateTime(timezone=True)),
    column("hidden_at", DateTime(timezone=True)),
)
_vendor_review_stats = table(
    "vendor_review_stats",
    column("vendor_user_id", Uuid),
    column("review_count", Integer),
    column("average_rating", Double),
)
_users = table("users", column("id", Uuid), column("email", Text))

# How many reviews the public profile shows, and how many are scanned for plan-card quotes.
PUBLIC_REVIEW_LIMIT = 50
SNIPPET_VENDOR_LIMIT = 80
SNIPPET_REVIEW_LIMIT = 200
# Analytics reads at most this many enquiries and reviews in the period (the baseline's caps).
ANALYTICS_ENQUIRY_LIMIT = 2000
ANALYTICS_REVIEW_LIMIT = 1000


def _uuids(ids: list[str]) -> list[uuid.UUID]:
    """The ids that are valid UUIDs, parsed (the rest cannot name a row)."""
    return [parsed for parsed in (as_uuid(raw_id) for raw_id in ids) if parsed is not None]


async def review_stats(session: AsyncSession, vendor_user_ids: list[str]) -> list[ReviewStatsRow]:
    """Visible-review count and average for each vendor that has any."""
    vendor_ids = _uuids(vendor_user_ids)
    if not vendor_ids:
        return []
    result = await session.execute(
        select(
            _vendor_review_stats.c.vendor_user_id,
            _vendor_review_stats.c.review_count,
            _vendor_review_stats.c.average_rating,
        ).where(_vendor_review_stats.c.vendor_user_id.in_(vendor_ids))
    )
    return [ReviewStatsRow.model_validate(plain_row(row)) for row in result]


async def booking_totals(session: AsyncSession, vendor_user_ids: list[str]) -> list[BookingTotalsRow]:
    """Completed bookings, client enquiries and reply times per vendor, across all time."""
    vendor_ids = _uuids(vendor_user_ids)
    if not vendor_ids:
        return []
    requests = _booking_requests.c
    is_completed = or_(requests.status == "completed", requests.completed_at.is_not(None))
    result = await session.execute(
        select(
            requests.vendor_user_id,
            func.count(case((is_completed, 1))).label("completed_bookings"),
            func.count(case((requests.initiator == "client", 1))).label("client_enquiries"),
            func.sum(requests.vendor_response_time_seconds).label("response_seconds_total"),
            func.count(requests.vendor_response_time_seconds).label("responses_timed"),
        )
        .where(requests.vendor_user_id.in_(vendor_ids))
        .group_by(requests.vendor_user_id)
    )
    return [BookingTotalsRow.model_validate(plain_row(row)) for row in result]


async def visible_reviews(session: AsyncSession, vendor_user_id: str) -> list[PublicReviewRow]:
    """The vendor's newest visible reviews with each booking's event and the reviewer's email."""
    vendor_id = as_uuid(vendor_user_id)
    if vendor_id is None:
        return []
    reviews, requests = _booking_reviews.c, _booking_requests.c
    result = await session.execute(
        select(
            reviews.id,
            reviews.rating,
            reviews.body,
            reviews.created_at,
            _users.c.email.label("client_email"),
            requests.event_name,
            requests.event_date,
            requests.total_label,
        )
        .select_from(_booking_reviews)
        .outerjoin(_booking_requests, requests.id == reviews.booking_request_id)
        .outerjoin(_users, _users.c.id == reviews.client_user_id)
        .where(reviews.vendor_user_id == vendor_id, reviews.hidden_at.is_(None))
        .order_by(reviews.created_at.desc(), reviews.id.desc())
        .limit(PUBLIC_REVIEW_LIMIT)
    )
    return [PublicReviewRow.model_validate(plain_row(row)) for row in result]


async def snippet_candidates(session: AsyncSession, vendor_user_ids: list[str]) -> list[SnippetCandidateRow]:
    """Recent visible reviews of the first vendors, newest first, to pick card quotes from."""
    vendor_ids = _uuids(vendor_user_ids[:SNIPPET_VENDOR_LIMIT])
    if not vendor_ids:
        return []
    reviews = _booking_reviews.c
    result = await session.execute(
        select(
            reviews.vendor_user_id,
            reviews.rating,
            reviews.body,
            _users.c.email.label("client_email"),
        )
        .select_from(_booking_reviews)
        .outerjoin(_users, _users.c.id == reviews.client_user_id)
        .where(reviews.vendor_user_id.in_(vendor_ids), reviews.hidden_at.is_(None))
        .order_by(reviews.created_at.desc(), reviews.id.desc())
        .limit(SNIPPET_REVIEW_LIMIT)
    )
    return [SnippetCandidateRow.model_validate(plain_row(row)) for row in result]


async def client_enquiries_since(
    session: AsyncSession, vendor_user_id: str, since: datetime
) -> list[AnalyticsEnquiryRow]:
    """Client-started enquiries to the vendor created since `since`, oldest first."""
    vendor_id = as_uuid(vendor_user_id)
    if vendor_id is None:
        return []
    requests = _booking_requests.c
    result = await session.execute(
        select(
            requests.status,
            requests.payment_status,
            requests.created_at,
            requests.accepted_at,
            requests.completed_at,
            requests.vendor_response_time_seconds,
            requests.payment_amount_gbp,
            requests.vendor_amount_gbp,
            requests.event_date,
            requests.failure_reason,
        )
        .where(
            requests.vendor_user_id == vendor_id,
            requests.initiator == "client",
            requests.created_at >= since,
        )
        .order_by(requests.created_at.asc(), requests.id.asc())
        .limit(ANALYTICS_ENQUIRY_LIMIT)
    )
    return [AnalyticsEnquiryRow.model_validate(plain_row(row)) for row in result]


async def ratings_since(
    session: AsyncSession, vendor_user_id: str, since: datetime
) -> list[AnalyticsRatingRow]:
    """Ratings of the vendor's visible reviews left since `since`."""
    vendor_id = as_uuid(vendor_user_id)
    if vendor_id is None:
        return []
    reviews = _booking_reviews.c
    result = await session.execute(
        select(reviews.rating, reviews.created_at)
        .where(
            reviews.vendor_user_id == vendor_id,
            reviews.hidden_at.is_(None),
            reviews.created_at >= since,
        )
        .order_by(reviews.created_at.asc(), reviews.id.asc())
        .limit(ANALYTICS_REVIEW_LIMIT)
    )
    return [AnalyticsRatingRow.model_validate(plain_row(row)) for row in result]


async def profile_views_since(session: AsyncSession, vendor_user_id: str, since: datetime) -> int:
    """How many times the vendor's public profile was opened since `since`."""
    vendor_id = as_uuid(vendor_user_id)
    if vendor_id is None:
        return 0
    result = await session.execute(
        select(func.count())
        .select_from(MarketplaceEvent)
        .where(
            MarketplaceEvent.event_name == "vendor_profile_viewed",
            MarketplaceEvent.vendor_user_id == vendor_id,
            MarketplaceEvent.created_at >= since,
        )
    )
    return int(result.scalar_one())
