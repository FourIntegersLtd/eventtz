"""Pure maths for the admin console's dashboards, analytics and vendor insights: no I/O."""

from __future__ import annotations

from app.features.admin_insights import domain


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
    assert days[-1] == domain.today_utc().isoformat()
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
