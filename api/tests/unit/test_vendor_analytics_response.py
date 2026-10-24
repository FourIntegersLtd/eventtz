"""Pins the exact JSON of `GET /vendor/analytics` (overview, funnel and the monthly series)."""

from __future__ import annotations

import json
from datetime import date

from app.features.marketplace.domain_metrics import vendor_analytics
from app.features.marketplace.rows import AnalyticsEnquiryRow, AnalyticsRatingRow
from app.features.marketplace.schemas import VendorAnalyticsResponse


def _response_json(
    *,
    enquiries: list[AnalyticsEnquiryRow],
    ratings: list[AnalyticsRatingRow],
    profile_views: int,
) -> str:
    """The route's body as the wire carries it, compact and in field order."""
    body = VendorAnalyticsResponse(
        **vendor_analytics(
            days=90,
            today=date(2026, 6, 15),
            enquiries=enquiries,
            ratings=ratings,
            profile_views=profile_views,
        )
    )
    return json.dumps(body.model_dump(mode="json"), separators=(",", ":"))


def test_an_empty_vendor_gets_zeroes_and_null_averages() -> None:
    """No bookings: counts are 0, money is 0.0, and the series are empty lists."""
    assert _response_json(enquiries=[], ratings=[], profile_views=0) == (
        '{"success":true,"period_days":90,"overview":{"enquiries":0,"completed":0,'
        '"total_revenue_gbp":0.0,"avg_booking_value_gbp":0.0,"avg_customer_rating":0.0,'
        '"review_count":0,"avg_response_seconds":null,"conversion_rate":0.0,'
        '"pending_enquiries":0,"expired_enquiries":0,"upcoming_bookings":0,"profile_views":0},'
        '"funnel":{"profile_views":0,"enquiries":0,"accepted":0,"paid":0,"completed":0},'
        '"enquiries_by_month":[],"revenue_by_month":[],"response_time_by_month":[],'
        '"rating_by_month":[]}'
    )


def test_a_busy_vendor_gets_literal_numbers_and_sorted_months() -> None:
    """A completed paid job, a pending expired enquiry and a rating: every key and number pinned."""
    enquiries = [
        AnalyticsEnquiryRow(
            status="completed",
            payment_status="paid",
            created_at="2026-05-02T10:00:00+00:00",
            accepted_at="2026-05-02T11:00:00+00:00",
            completed_at="2026-06-01T10:00:00+00:00",
            vendor_response_time_seconds=3600,
            vendor_amount_gbp=450.5,
            event_date="2026-05-30",
        ),
        AnalyticsEnquiryRow(
            status="pending",
            created_at="2026-06-03T09:00:00+00:00",
            failure_reason="VENDOR_NO_RESPONSE",
            event_date="2026-08-01",
        ),
        AnalyticsEnquiryRow(
            status="accepted",
            payment_status="pending",
            created_at="2026-06-04T09:00:00+00:00",
            vendor_response_time_seconds=1800,
            event_date="2026-07-01",
        ),
    ]
    ratings = [AnalyticsRatingRow(rating=5, created_at="2026-06-02T00:00:00+00:00")]
    assert _response_json(enquiries=enquiries, ratings=ratings, profile_views=40) == (
        '{"success":true,"period_days":90,"overview":{"enquiries":3,"completed":1,'
        '"total_revenue_gbp":450.5,"avg_booking_value_gbp":450.5,"avg_customer_rating":5.0,'
        '"review_count":1,"avg_response_seconds":2700.0,"conversion_rate":0.3333,'
        '"pending_enquiries":1,"expired_enquiries":1,"upcoming_bookings":1,"profile_views":40},'
        '"funnel":{"profile_views":40,"enquiries":3,"accepted":2,"paid":1,"completed":1},'
        '"enquiries_by_month":[{"month":"2026-05","count":1},{"month":"2026-06","count":2}],'
        '"revenue_by_month":[{"month":"2026-05","revenue_gbp":0.0},{"month":"2026-06","revenue_gbp":450.5}],'
        '"response_time_by_month":[{"month":"2026-05","avg_seconds":3600.0},{"month":"2026-06","avg_seconds":1800.0}],'
        '"rating_by_month":[{"month":"2026-05","avg_rating":null},{"month":"2026-06","avg_rating":5.0}]}'
    )
