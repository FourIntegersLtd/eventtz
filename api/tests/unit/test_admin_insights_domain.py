"""Pure maths for the admin console's dashboards, analytics and vendor insights: no I/O."""

from __future__ import annotations

import json

from app.core.time import uk_today
from app.features.admin_insights import domain
from app.features.admin_insights.schemas import AdminMarketplaceAnalyticsResponse


def test_resolve_metrics_days_falls_back_to_30_outside_the_allowed_set() -> None:
    """45 is inside FastAPI's [7, 90] range but not one of the four real chart windows."""
    assert domain.resolve_metrics_days(7) == 7
    assert domain.resolve_metrics_days(30) == 30
    assert domain.resolve_metrics_days(60) == 60
    assert domain.resolve_metrics_days(90) == 90
    assert domain.resolve_metrics_days(45) == 30


def test_date_range_is_ascending_and_ends_today() -> None:
    """A 3-day window is three consecutive dates, the last one being today."""
    days = domain.date_range(3)
    assert len(days) == 3
    assert days[-1] == uk_today().isoformat()
    assert days == sorted(days)


def test_day_key_reads_the_first_ten_characters_of_an_iso_timestamp() -> None:
    assert domain.day_key("2025-06-01T10:30:00+00:00") == "2025-06-01"
    assert domain.day_key("2025-06-01") == "2025-06-01"
    assert domain.day_key(None) is None
    assert domain.day_key("") is None
    assert domain.day_key("2025") is None


def test_build_booking_created_buckets_counts_by_day_and_never_carries_gmv() -> None:
    """`bookings_created` always reports zero GMV, matching the baseline's own hardcoded 0.0."""
    days = ["2025-01-01", "2025-01-02"]
    rows = [
        {"created_at": "2025-01-01T09:00:00+00:00"},
        {"created_at": "2025-01-01T18:00:00+00:00"},
        {"created_at": "2025-01-02T00:00:00+00:00"},
        {"created_at": "2024-12-31T23:59:59+00:00"},  # outside the window, ignored
    ]
    buckets = domain.build_booking_created_buckets(days, rows)
    assert buckets == [
        {"date": "2025-01-01", "count": 2, "gmv_gbp": 0.0},
        {"date": "2025-01-02", "count": 1, "gmv_gbp": 0.0},
    ]


def test_build_booking_paid_buckets_sums_takings_and_skips_missing_amounts() -> None:
    # `gmv_gbp` is precomputed by the service layer (the stored snapshot, or a priced
    # breakdown when it's missing - see `service._with_gmv_fallback`); a row that still
    # has no usable figure at all contributes to `count` but not `gmv_gbp`.
    days = ["2025-01-01"]
    rows = [
        {"paid_at": "2025-01-01T09:00:00+00:00", "gmv_gbp": 150.00},
        {"paid_at": "2025-01-01T10:00:00+00:00", "gmv_gbp": 49.50},
        {"paid_at": "2025-01-01T11:00:00+00:00", "gmv_gbp": None},
    ]
    buckets = domain.build_booking_paid_buckets(days, rows)
    assert buckets == [{"date": "2025-01-01", "count": 3, "gmv_gbp": 199.50}]


def test_build_signup_buckets_splits_clients_and_vendors() -> None:
    days = ["2025-01-01"]
    rows = [
        {"created_at": "2025-01-01T00:00:00+00:00", "user_type": "client"},
        {"created_at": "2025-01-01T00:00:00+00:00", "user_type": "client"},
        {"created_at": "2025-01-01T00:00:00+00:00", "user_type": "vendor"},
    ]
    assert domain.build_signup_buckets(days, rows) == [{"date": "2025-01-01", "clients": 2, "vendors": 1}]


def test_booking_needs_attention_flags_a_pending_checkout() -> None:
    row = {"status": "pending", "payment_status": "pending"}
    assert domain.booking_needs_attention(row, payouts_enabled=True, has_active_dispute=False)


def test_booking_needs_attention_flags_an_accepted_booking_stuck_unpaid_with_a_checkout() -> None:
    row = {"status": "accepted", "payment_status": "unpaid", "stripe_checkout_session_id": "cs_1"}
    assert domain.booking_needs_attention(row, payouts_enabled=True, has_active_dispute=False)


def test_booking_needs_attention_flags_a_dispute_on_paid_money() -> None:
    row = {"status": "accepted", "payment_status": "paid"}
    assert domain.booking_needs_attention(row, payouts_enabled=True, has_active_dispute=True)


def test_booking_needs_attention_flags_a_support_hold_on_paid_money() -> None:
    row = {"status": "accepted", "payment_status": "paid", "support_hold": True}
    assert domain.booking_needs_attention(row, payouts_enabled=True, has_active_dispute=False)


def test_booking_needs_attention_flags_disabled_payouts_before_completion() -> None:
    row = {"status": "accepted", "payment_status": "paid"}
    assert domain.booking_needs_attention(row, payouts_enabled=False, has_active_dispute=False)


def test_booking_needs_attention_is_false_for_a_clean_completed_booking() -> None:
    row = {
        "status": "accepted",
        "payment_status": "paid",
        "client_completion_confirmed_at": "2025-01-01T00:00:00+00:00",
        "vendor_completion_confirmed_at": "2025-01-01T00:00:00+00:00",
    }
    assert not domain.booking_needs_attention(row, payouts_enabled=True, has_active_dispute=False)


def test_count_bookings_needing_support_counts_only_flagged_rows() -> None:
    rows = [
        {"id": "b1", "vendor_user_id": "v1", "status": "pending", "payment_status": "pending"},
        {
            "id": "b2",
            "vendor_user_id": "v1",
            "status": "accepted",
            "payment_status": "paid",
            "client_completion_confirmed_at": "2025-01-01T00:00:00+00:00",
            "vendor_completion_confirmed_at": "2025-01-01T00:00:00+00:00",
        },
    ]
    total = domain.count_bookings_needing_support(
        rows, payouts_enabled_by_vendor={"v1": True}, disputed_booking_ids=set()
    )
    assert total == 1


def test_primary_category_prefers_services_offered_then_payload_then_unknown() -> None:
    assert domain.primary_category(None) == "unknown"
    assert domain.primary_category({"services_offered": ["Catering"]}) == "catering"
    assert domain.primary_category({"payload": {"servicesOffered": ["DJ"]}}) == "dj"
    assert domain.primary_category({}) == "unknown"


def test_location_for_booking_prefers_vendor_city_then_payload_then_postcode() -> None:
    assert domain.location_for_booking({"base_city_normalized": "london"}, {}) == "london"
    assert domain.location_for_booking({"payload": {"baseCity": "Leeds"}}, {}) == "leeds"
    assert domain.location_for_booking(None, {"event_postcode": "sw1a 1aa"}) == "SW1A"
    assert domain.location_for_booking(None, {}) == "unknown"


def test_build_vendor_insights_for_an_unknown_vendor_is_all_zero() -> None:
    built = domain.build_vendor_insights(
        user_id="missing", review_average=None, review_count=0, booking_rows=[], open_disputes=0
    )
    assert built == {
        "success": True,
        "user_id": "missing",
        "review_average": None,
        "review_count": 0,
        "bookings_total": 0,
        "bookings_by_status": {},
        "bookings_by_month": [],
        "open_disputes_on_bookings": 0,
        "explore_path": "/client/browse/missing",
    }


def test_build_vendor_insights_buckets_bookings_by_status_and_month() -> None:
    booking_rows = [
        {"created_at": "2025-01-05T00:00:00+00:00", "status": "completed"},
        {"created_at": "2025-01-20T00:00:00+00:00", "status": "completed"},
        {"created_at": "2025-02-01T00:00:00+00:00", "status": "cancelled"},
    ]
    built = domain.build_vendor_insights(
        user_id="vendor-1", review_average=4.5, review_count=2, booking_rows=booking_rows, open_disputes=1
    )
    assert built["bookings_total"] == 3
    assert built["bookings_by_status"] == {"completed": 2, "cancelled": 1}
    assert built["bookings_by_month"] == [
        {"month": "2025-01", "cancelled": 0, "completed": 2},
        {"month": "2025-02", "cancelled": 1, "completed": 0},
    ]
    assert built["review_average"] == 4.5
    assert built["open_disputes_on_bookings"] == 1


def test_build_marketplace_analytics_computes_the_funnel_for_one_vendor() -> None:
    """One enquiry that goes all the way: accepted, paid and completed."""
    enquiries = [
        {
            "vendor_user_id": "vendor-1",
            "status": "completed",
            "payment_status": "paid",
            "accepted_at": "2025-01-02T00:00:00+00:00",
            "completed_at": "2025-01-10T00:00:00+00:00",
            "event_postcode": "sw1a 1aa",
            "payment_amount_gbp": "200.00",
            "failure_reason": None,
            "vendor_response_time_seconds": 1800,
        },
        {
            "vendor_user_id": "vendor-1",
            "status": "declined",
            "payment_status": "unpaid",
            "accepted_at": None,
            "completed_at": None,
            "event_postcode": "sw1a 1aa",
            "payment_amount_gbp": None,
            "failure_reason": "vendor_declined",
            "vendor_response_time_seconds": 7200,
        },
    ]
    built = domain.build_marketplace_analytics(
        from_date="2025-01-01",
        to_date="2025-01-31",
        enquiries=enquiries,
        vendors_by_id={"vendor-1": {"payload": {"businessName": "Ada's Catering"}}},
        vendors_total=1,
        vendors_active=1,
        avg_rating=4.8,
        review_count=3,
        profile_views=5,
        vendor_reminders=1,
        client_nudges=0,
        multi_batches=0,
    )
    overview = built["overview"]
    assert overview["enquiries"] == 2
    assert overview["accepted"] == 1
    assert overview["paid"] == 1
    assert overview["completed"] == 1
    assert overview["enquiry_to_acceptance_rate"] == 0.5
    assert overview["acceptance_to_payment_rate"] == 1.0
    assert overview["overall_conversion_rate"] == 0.5
    assert overview["avg_booking_value_gbp"] == 200.0
    assert overview["unfulfilled"] == 1

    assert built["failure_reasons"] == [{"reason": "vendor_declined", "count": 1}]
    assert len(built["top_vendors"]) == 1
    top_vendor = built["top_vendors"][0]
    assert top_vendor["vendor_user_id"] == "vendor-1"
    assert top_vendor["business_name"] == "Ada's Catering"
    assert top_vendor["completed"] == 1
    assert top_vendor["revenue_gbp"] == 200.0

    assert {row["key"] for row in built["by_location"]} == {"SW1A"}
    assert set(built["recruitment_hints"]) == {"categories", "locations"}


def test_build_marketplace_analytics_buckets_enquiries_and_completions_by_month() -> None:
    """Mirrors `backend/app/features/admin/marketplace_analytics.py`'s time series: every
    enquiry counts against the month it was created in; a completed one counts (separately)
    against the month it finished in, falling back to `updated_at` then `created_at`. Both
    series cover the union of months, in order, with zero-filled gaps.
    """
    enquiries = [
        # Created and completed in January.
        {
            "vendor_user_id": "vendor-1",
            "status": "completed",
            "payment_status": "paid",
            "created_at": "2025-01-05T00:00:00+00:00",
            "completed_at": "2025-01-20T00:00:00+00:00",
        },
        # Created in January, completed in February with no `completed_at` snapshot -
        # falls back to `updated_at`.
        {
            "vendor_user_id": "vendor-1",
            "status": "completed",
            "payment_status": "paid",
            "created_at": "2025-01-10T00:00:00+00:00",
            "updated_at": "2025-02-15T00:00:00+00:00",
            "completed_at": None,
        },
        # Created in March, never completed - counts only in enquiries_by_month.
        {
            "vendor_user_id": "vendor-1",
            "status": "declined",
            "payment_status": "unpaid",
            "created_at": "2025-03-01T00:00:00+00:00",
            "completed_at": None,
        },
    ]
    built = domain.build_marketplace_analytics(
        from_date="2025-01-01",
        to_date="2025-03-31",
        enquiries=enquiries,
        vendors_by_id={},
        vendors_total=1,
        vendors_active=1,
        avg_rating=0.0,
        review_count=0,
        profile_views=0,
        vendor_reminders=0,
        client_nudges=0,
        multi_batches=0,
    )
    assert built["enquiries_by_month"] == [
        {"month": "2025-01", "count": 2},
        {"month": "2025-02", "count": 0},
        {"month": "2025-03", "count": 1},
    ]
    assert built["completed_by_month"] == [
        {"month": "2025-01", "count": 1},
        {"month": "2025-02", "count": 1},
        {"month": "2025-03", "count": 0},
    ]


EXPECTED_MARKETPLACE_ANALYTICS_JSON = {
    "success": True,
    "from_date": "2025-01-01",
    "to_date": "2025-02-28",
    "overview": {
        "vendors_total": 2,
        "vendors_active": 2,
        "enquiries": 6,
        "accepted": 1,
        "paid": 1,
        "completed": 1,
        "enquiry_to_acceptance_rate": 0.1667,
        "acceptance_to_payment_rate": 1.0,
        "overall_conversion_rate": 0.1667,
        "avg_booking_value_gbp": 200.0,
        "avg_vendor_response_seconds": 6300.0,
        "reply_within_1h_rate": 0.1667,
        "reply_within_6h_rate": 1.0,
        "reply_within_24h_rate": 1.0,
        "enquiry_vendor_reminders": 1,
        "enquiry_client_nudges": 0,
        "enquiry_multi_batches": 0,
        "avg_customer_rating": 4.5,
        "review_count": 3,
        "profile_views": 5,
        "unfulfilled": 5,
    },
    "enquiries_by_month": [{"month": "2025-01", "count": 1}, {"month": "2025-02", "count": 5}],
    "completed_by_month": [{"month": "2025-01", "count": 1}, {"month": "2025-02", "count": 0}],
    "by_category": [
        {
            "key": "dj",
            "enquiries": 5,
            "accepted": 0,
            "paid": 0,
            "completed": 0,
            "failed": 5,
            "revenue_gbp": 0.0,
            "conversion_rate": 0.0,
            "accept_rate": 0.0,
            "avg_booking_value_gbp": 0.0,
        },
        {
            "key": "unknown",
            "enquiries": 1,
            "accepted": 1,
            "paid": 1,
            "completed": 1,
            "failed": 0,
            "revenue_gbp": 200.0,
            "conversion_rate": 1.0,
            "accept_rate": 1.0,
            "avg_booking_value_gbp": 200.0,
        },
    ],
    "by_category_chart": [
        {
            "key": "dj",
            "enquiries": 5,
            "accepted": 0,
            "paid": 0,
            "completed": 0,
            "failed": 5,
            "revenue_gbp": 0.0,
            "conversion_rate": 0.0,
            "accept_rate": 0.0,
            "avg_booking_value_gbp": 0.0,
        },
        {
            "key": "unknown",
            "enquiries": 1,
            "accepted": 1,
            "paid": 1,
            "completed": 1,
            "failed": 0,
            "revenue_gbp": 200.0,
            "conversion_rate": 1.0,
            "accept_rate": 1.0,
            "avg_booking_value_gbp": 200.0,
        },
    ],
    "by_category_total": 2,
    "category_offset": 0,
    "category_limit": 25,
    "by_location": [
        {
            "key": "SW1A",
            "enquiries": 6,
            "accepted": 1,
            "paid": 1,
            "completed": 1,
            "failed": 5,
            "revenue_gbp": 200.0,
            "conversion_rate": 0.1667,
            "accept_rate": 0.1667,
            "avg_booking_value_gbp": 200.0,
        }
    ],
    "failure_reasons": [{"reason": "vendor_declined", "count": 5}],
    "top_vendors": [
        {
            "vendor_user_id": "vendor-1",
            "business_name": "Ada's Catering",
            "enquiries": 1,
            "completed": 1,
            "conversion_rate": 1.0,
            "avg_response_seconds": 1800.0,
            "revenue_gbp": 200.0,
        },
        {
            "vendor_user_id": "vendor-2",
            "business_name": "Bo DJ",
            "enquiries": 5,
            "completed": 0,
            "conversion_rate": 0.0,
            "avg_response_seconds": 7200.0,
            "revenue_gbp": 0.0,
        },
    ],
    "recruitment_hints": {
        "categories": [
            {
                "category": "dj",
                "enquiries": 5,
                "failed": 5,
                "message": "High demand for dj - consider recruiting more vendors",
            }
        ],
        "locations": [
            {
                "location": "SW1A",
                "enquiries": 6,
                "failed": 5,
                "message": "High demand for SW1A - consider recruiting more supply",
            }
        ],
    },
}

EMPTY_MARKETPLACE_ANALYTICS_JSON = {
    "success": True,
    "from_date": "2025-01-01",
    "to_date": "2025-01-31",
    "overview": {
        "vendors_total": 0,
        "vendors_active": 0,
        "enquiries": 0,
        "accepted": 0,
        "paid": 0,
        "completed": 0,
        "enquiry_to_acceptance_rate": 0.0,
        "acceptance_to_payment_rate": 0.0,
        "overall_conversion_rate": 0.0,
        "avg_booking_value_gbp": 0.0,
        "avg_vendor_response_seconds": None,
        "reply_within_1h_rate": None,
        "reply_within_6h_rate": None,
        "reply_within_24h_rate": None,
        "enquiry_vendor_reminders": 0,
        "enquiry_client_nudges": 0,
        "enquiry_multi_batches": 0,
        "avg_customer_rating": 0.0,
        "review_count": 0,
        "profile_views": 0,
        "unfulfilled": 0,
    },
    "enquiries_by_month": [],
    "completed_by_month": [],
    "by_category": [],
    "by_category_chart": [],
    "by_category_total": 0,
    "category_offset": 0,
    "category_limit": 25,
    "by_location": [],
    "failure_reasons": [],
    "top_vendors": [],
    "recruitment_hints": {"categories": [], "locations": []},
}


def _enquiry(vendor: str, status: str, payment: str, created_at: str, **extra: object) -> dict:
    """One `booking_requests` row as the repository returns it."""
    return {
        "vendor_user_id": vendor,
        "status": status,
        "payment_status": payment,
        "created_at": created_at,
        "event_postcode": "sw1a 1aa",
        **extra,
    }


def _build(
    enquiries: list[dict],
    vendors: dict,
    *,
    to_date: str,
    vendor_count: int = 0,
    rating: float = 0.0,
    reviews: int = 0,
    views: int = 0,
    reminders: int = 0,
) -> dict:
    """`build_marketplace_analytics` with the arguments both freeze tests share."""
    return domain.build_marketplace_analytics(
        from_date="2025-01-01",
        to_date=to_date,
        enquiries=enquiries,
        vendors_by_id=vendors,
        vendors_total=vendor_count,
        vendors_active=vendor_count,
        avg_rating=rating,
        review_count=reviews,
        profile_views=views,
        vendor_reminders=reminders,
        client_nudges=0,
        multi_batches=0,
    )


def test_marketplace_analytics_response_json_is_frozen() -> None:
    """The whole `/admin/marketplace-analytics` body (keys, key order, floats, ints) as it was
    sent before its dict fields became named models. One paid, completed enquiry (vendor 1)
    and five declined ones (vendor 2, a DJ), so the recruitment hints fire.
    """
    enquiries = [
        _enquiry(
            "vendor-1",
            "completed",
            "paid",
            "2025-01-05T00:00:00+00:00",
            accepted_at="2025-01-06T00:00:00+00:00",
            completed_at="2025-01-20T00:00:00+00:00",
            payment_amount_gbp="200.00",
            vendor_response_time_seconds=1800,
        )
    ] + [
        _enquiry(
            "vendor-2",
            "declined",
            "unpaid",
            f"2025-02-0{day}T00:00:00+00:00",
            failure_reason="vendor_declined",
            vendor_response_time_seconds=7200,
        )
        for day in range(1, 6)
    ]
    vendors = {
        "vendor-1": {"payload": {"businessName": "Ada's Catering"}},
        "vendor-2": {"payload": {"businessName": "Bo DJ", "servicesOffered": ["DJ"]}},
    }
    built = _build(
        enquiries, vendors, to_date="2025-02-28", vendor_count=2, rating=4.5, reviews=3, views=5, reminders=1
    )
    categories = list(built["by_category"])
    built["by_category_chart"] = categories
    built["by_category"] = categories[0:25]
    built["by_category_total"] = len(categories)
    built["category_offset"] = 0
    built["category_limit"] = 25

    sent = AdminMarketplaceAnalyticsResponse(**built).model_dump(mode="json")

    assert sent == EXPECTED_MARKETPLACE_ANALYTICS_JSON
    assert json.dumps(sent) == json.dumps(EXPECTED_MARKETPLACE_ANALYTICS_JSON)


def test_marketplace_analytics_response_json_for_an_empty_range_is_frozen() -> None:
    """No enquiries: every list is empty and the nullable averages are `null`, not absent."""
    sent = AdminMarketplaceAnalyticsResponse(**_build([], {}, to_date="2025-01-31")).model_dump(mode="json")

    assert sent == EMPTY_MARKETPLACE_ANALYTICS_JSON
    assert json.dumps(sent) == json.dumps(EMPTY_MARKETPLACE_ANALYTICS_JSON)
