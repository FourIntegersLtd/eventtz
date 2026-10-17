"""The private staff record of a vendor's cancellations (Terms: a warning first, then a pause).

Kept apart from the other bookings services so the vendors slice can read it without
importing the booking flows (which import vendors).
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings import repository_admin
from app.features.bookings.domain_policy import VENDOR_CANCELLATION_REVIEW_DAYS, cancellation_review_flag


async def cancellation_counts(session: AsyncSession, vendor_user_ids: list[str]) -> dict[str, int]:
    """Per vendor, the cancellations counted against them in the review window; absent means zero."""
    since = datetime.now(UTC) - timedelta(days=VENDOR_CANCELLATION_REVIEW_DAYS)
    return await repository_admin.vendor_cancellation_counts(session, vendor_user_ids, since=since)


def needs_review(cancellation_count: int) -> bool:
    """True when the count has reached the staff-review threshold."""
    return cancellation_review_flag(cancellation_count)
