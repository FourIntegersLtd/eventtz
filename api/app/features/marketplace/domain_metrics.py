"""Pure rules for the numbers clients and vendors see: trust signals, review quotes, analytics.

Public signals (review average, completed bookings, reply time, conversion) are
safe to show clients; revenue and pending counts stay on the vendor's own
analytics screen. Ported from the baseline `vendors/public_metrics.py`,
`vendors/analytics.py` and the snippet helpers in `bookings/reviews.py`.
"""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from typing import Any

from pydantic import BaseModel

from app.features.marketplace.rows import (
    AnalyticsEnquiryRow,
    AnalyticsRatingRow,
    BookingTotalsRow,
    ReviewStatsRow,
    SnippetCandidateRow,
)

# Payment states that mean the client's money arrived (as the staff dashboard counts them).
PAID_PAYMENT_STATUSES = ("paid", "payout_released", "partially_refunded")
# Longest review quote on a plan card, in characters (a longer one ends in "…").
SNIPPET_EXCERPT_MAX = 140
_ANONYMOUS_REVIEWER = "Verified client"


@dataclass(frozen=True)
class VendorSignals:
    """A vendor's public trust signals, as explore cards show them."""

    review_average: float | None = None
    review_count: int = 0
    completed_bookings: int = 0
    avg_response_seconds: float | None = None
    conversion_rate: float | None = None


class FeaturedReview(BaseModel):
    """A real review quoted on a plan-search card."""

    rating: int
    body_excerpt: str
    reviewer_display: str


def vendor_signals(
    vendor_user_ids: list[str], stats: list[ReviewStatsRow], totals: list[BookingTotalsRow]
) -> dict[str, VendorSignals]:
    """Signals for every vendor asked about; a vendor with no reviews or bookings gets the empty ones."""
    stats_by_vendor = {row.vendor_user_id: row for row in stats}
    totals_by_vendor = {row.vendor_user_id: row for row in totals}
    signals: dict[str, VendorSignals] = {}
    for vendor_id in vendor_user_ids:
        review_stats = stats_by_vendor.get(vendor_id)
        booking_totals = totals_by_vendor.get(vendor_id)
        completed = booking_totals.completed_bookings if booking_totals else 0
        enquiries = booking_totals.client_enquiries if booking_totals else 0
        timed = booking_totals.responses_timed if booking_totals else 0
        signals[vendor_id] = VendorSignals(
            review_average=review_stats.average_rating if review_stats else None,
            review_count=review_stats.review_count if review_stats else 0,
            completed_bookings=completed,
            avg_response_seconds=(
                round((booking_totals.response_seconds_total or 0) / timed, 1)
                if booking_totals and timed
                else None
            ),
            conversion_rate=round(completed / enquiries, 4) if enquiries else None,
        )
    return signals


def reviewer_display(email: str | None) -> str:
    """How a reviewer is named in public: the capitalised start of their email's local part."""
    if not email or not isinstance(email, str):
        return _ANONYMOUS_REVIEWER
    local_part = email.split("@", 1)[0].strip()
    local_part = re.sub(r"[^a-zA-Z0-9._-]", "", local_part)
    if not local_part:
        return _ANONYMOUS_REVIEWER
    return local_part[:1].upper() + local_part[1:18] if len(local_part) > 1 else local_part.upper()


def choose_snippets(
    candidates: list[SnippetCandidateRow], prefer_terms_by_vendor: dict[str, list[str]]
) -> dict[str, FeaturedReview]:
    """One quote per vendor: the best rated, then the best fit to the section's service, then length.

    Candidates arrive newest first; a later review replaces the kept one only on a
    strictly higher score. Empty bodies and ratings below 1 are never quoted.
    """
    best: dict[str, tuple[float, SnippetCandidateRow, str]] = {}
    for candidate in candidates:
        body = (candidate.body or "").strip()
        rating = candidate.rating or 0
        if not candidate.vendor_user_id or not body or rating < 1:
            continue
        lowered = body.lower()
        terms = prefer_terms_by_vendor.get(candidate.vendor_user_id) or []
        term_hits = sum(1 for term in terms if term and term in lowered)
        score = rating * 10.0 + term_hits * 8.0 + min(len(body), 160) / 40.0
        kept = best.get(candidate.vendor_user_id)
        if kept is not None and kept[0] >= score:
            continue
        excerpt = body if len(body) <= SNIPPET_EXCERPT_MAX else body[: SNIPPET_EXCERPT_MAX - 1].rstrip() + "…"
        best[candidate.vendor_user_id] = (score, candidate, excerpt)
    return {
        vendor_id: FeaturedReview(
            rating=candidate.rating or 0,
            body_excerpt=excerpt,
            reviewer_display=reviewer_display(candidate.client_email),
        )
        for vendor_id, (_score, candidate, excerpt) in best.items()
    }


def _amount(value: float | None) -> float:
    """A money column as a float, missing counting as zero."""
    return float(value) if value is not None else 0.0


def _month_key(iso_timestamp: str | None) -> str | None:
    """`YYYY-MM` from an ISO date or timestamp."""
    if not iso_timestamp:
        return None
    stripped = iso_timestamp.strip()
    return stripped[:7] if len(stripped) >= 7 else None


def _is_completed(enquiry: AnalyticsEnquiryRow) -> bool:
    """A booking counts as completed by status or by having a completion time."""
    return enquiry.status == "completed" or bool(enquiry.completed_at)


def _earned(enquiry: AnalyticsEnquiryRow) -> float:
    """What the vendor earned from a booking: their share, else the whole payment."""
    return _amount(enquiry.vendor_amount_gbp or enquiry.payment_amount_gbp)


def _average(values: list[int], digits: int) -> float | None:
    """The mean rounded to `digits`, or `None` for no values."""
    return round(sum(values) / len(values), digits) if values else None


def vendor_analytics(
    *,
    days: int,
    today: date,
    enquiries: list[AnalyticsEnquiryRow],
    ratings: list[AnalyticsRatingRow],
    profile_views: int,
) -> dict[str, Any]:
    """The vendor analytics screen as a dict; its keys must match `VendorAnalyticsResponse` (pinned by a test)."""
    accepted = [
        enquiry for enquiry in enquiries if enquiry.accepted_at or enquiry.status in ("accepted", "completed")
    ]
    paid = [enquiry for enquiry in accepted if (enquiry.payment_status or "") in PAID_PAYMENT_STATUSES]
    completed = [enquiry for enquiry in enquiries if _is_completed(enquiry)]
    pending = [enquiry for enquiry in enquiries if enquiry.status == "pending"]
    expired = [enquiry for enquiry in pending if enquiry.failure_reason == "VENDOR_NO_RESPONSE"]

    upcoming = 0
    for enquiry in enquiries:
        if enquiry.status not in ("accepted", "completed"):
            continue
        try:
            if date.fromisoformat((enquiry.event_date or "")[:10]) >= today:
                upcoming += 1
        except ValueError:
            pass

    response_times = [
        enquiry.vendor_response_time_seconds
        for enquiry in enquiries
        if enquiry.vendor_response_time_seconds is not None
    ]
    revenue = sum(_earned(enquiry) for enquiry in completed)

    rating_values: list[int] = []
    ratings_by_month: dict[str, list[int]] = defaultdict(list)
    for review in ratings:
        if review.rating is None:
            continue
        rating_values.append(review.rating)
        month = _month_key(review.created_at)
        if month:
            ratings_by_month[month].append(review.rating)

    enquiries_by_month: dict[str, int] = defaultdict(int)
    revenue_by_month: dict[str, float] = defaultdict(float)
    responses_by_month: dict[str, list[int]] = defaultdict(list)
    for enquiry in enquiries:
        month = _month_key(enquiry.created_at)
        if month:
            enquiries_by_month[month] += 1
        if enquiry.vendor_response_time_seconds is not None and month:
            responses_by_month[month].append(enquiry.vendor_response_time_seconds)
        if _is_completed(enquiry):
            earned_month = _month_key(enquiry.completed_at or enquiry.created_at)
            if earned_month:
                revenue_by_month[earned_month] += _earned(enquiry)

    months = sorted(
        set(enquiries_by_month) | set(revenue_by_month) | set(responses_by_month) | set(ratings_by_month)
    )
    return {
        "success": True,
        "period_days": days,
        "overview": {
            "enquiries": len(enquiries),
            "completed": len(completed),
            "total_revenue_gbp": round(revenue, 2),
            "avg_booking_value_gbp": round(revenue / len(completed), 2) if completed else 0.0,
            "avg_customer_rating": _average(rating_values, 2) or 0.0,
            "review_count": len(rating_values),
            "avg_response_seconds": _average(response_times, 1),
            "conversion_rate": round(len(completed) / len(enquiries), 4) if enquiries else 0.0,
            "pending_enquiries": len(pending),
            "expired_enquiries": len(expired),
            "upcoming_bookings": upcoming,
            "profile_views": profile_views,
        },
        "funnel": {
            "profile_views": profile_views,
            "enquiries": len(enquiries),
            "accepted": len(accepted),
            "paid": len(paid),
            "completed": len(completed),
        },
        "enquiries_by_month": [
            {"month": month, "count": enquiries_by_month.get(month, 0)} for month in months
        ],
        "revenue_by_month": [
            {"month": month, "revenue_gbp": round(revenue_by_month.get(month, 0.0), 2)} for month in months
        ],
        "response_time_by_month": [
            {"month": month, "avg_seconds": _average(responses_by_month.get(month, []), 1)}
            for month in months
        ],
        "rating_by_month": [
            {"month": month, "avg_rating": _average(ratings_by_month.get(month, []), 2)} for month in months
        ],
    }
