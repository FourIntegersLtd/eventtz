"""Freeze: the admin console's read models (workstream 8).

Covers `GET /api/v1/admin/dashboard-summary`, `GET /api/v1/admin/dashboard-metrics`,
`GET /api/v1/admin/marketplace-analytics`, `GET /api/v1/admin/directory/search` and
`GET /api/v1/admin/vendors/{user_id}/insights`.

These are staff-only read models over shared, ever-growing tables (bookings, vendors,
users, reviews, disputes) that every acceptance run and every other workstream's tests
also write to. So this file asserts *shapes* and *types* for the counts (they are
allowed to grow between runs), and literal values only where a test controls every row
that could match (a directory search on a never-reused email, a fresh account's
vendor-insights zeros).
"""

from __future__ import annotations

from datetime import UTC, datetime

from supabase import Client

from conftest import API
from support.accounts import SeededAccount, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
INVALID_DATE = "Invalid date. Use YYYY-MM-DD."

DASHBOARD_SUMMARY_URL = f"{API}/admin/dashboard-summary"
DASHBOARD_METRICS_URL = f"{API}/admin/dashboard-metrics"
MARKETPLACE_ANALYTICS_URL = f"{API}/admin/marketplace-analytics"
DIRECTORY_SEARCH_URL = f"{API}/admin/directory/search"

# A syntactically valid id that never names a row, for the "unknown vendor" cases.
MISSING_USER_ID = "00000000-0000-4000-8000-000000000000"

# Every count in the summary must be a non-negative int: the local database is shared
# across concurrent acceptance runs, so no test here can pin an exact total.
_SUMMARY_COUNT_KEYS = (
    "users_client",
    "users_vendor",
    "users_admin",
    "vendors_pending",
    "vendors_approved",
    "vendors_banned",
    "bookings_pending",
    "bookings_accepted",
    "bookings_completed",
    "bookings_declined",
    "bookings_cancelled",
    "bookings_paid_count",
    "bookings_needing_support",
    "conversations_count",
    "reviews_count",
)


def _vendor_insights_url(user_id: str) -> str:
    """The `/admin/vendors/{user_id}/insights` URL for one vendor."""
    return f"{API}/admin/vendors/{user_id}/insights"


# --- GET /admin/dashboard-summary ------------------------------------------------------------------


def test_dashboard_summary_requires_sign_in(anonymous) -> None:
    response = anonymous.get(DASHBOARD_SUMMARY_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_dashboard_summary_forbidden_for_client_account(as_client) -> None:
    response = as_client.get(DASHBOARD_SUMMARY_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_dashboard_summary_forbidden_for_vendor_account(as_vendor) -> None:
    response = as_vendor.get(DASHBOARD_SUMMARY_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_dashboard_summary_ok_for_plain_admin(as_staff) -> None:
    """A plain admin may view the summary (no route here is super-admin-only)."""
    response = as_staff.get(DASHBOARD_SUMMARY_URL)
    assert response.status_code == 200
    body = response.json()
    for key in _SUMMARY_COUNT_KEYS:
        assert isinstance(body[key], int), key
        assert body[key] >= 0, key


def test_dashboard_summary_ok_for_super_admin(as_super_admin) -> None:
    response = as_super_admin.get(DASHBOARD_SUMMARY_URL)
    assert response.status_code == 200


def test_dashboard_summary_counts_a_freshly_seeded_client(admin_db: Client, as_staff) -> None:
    """Seeding one more client can only ever raise `users_client`, never lower it."""
    before = as_staff.get(DASHBOARD_SUMMARY_URL).json()["users_client"]
    seed_account(admin_db, unique_email("dashboard-summary-client"), "client")
    after = as_staff.get(DASHBOARD_SUMMARY_URL).json()["users_client"]
    assert after >= before + 1


# --- GET /admin/dashboard-metrics ------------------------------------------------------------------


def test_dashboard_metrics_requires_sign_in(anonymous) -> None:
    response = anonymous.get(DASHBOARD_METRICS_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_dashboard_metrics_forbidden_for_client_account(as_client) -> None:
    response = as_client.get(DASHBOARD_METRICS_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_dashboard_metrics_default_period_is_30_days(as_staff) -> None:
    response = as_staff.get(DASHBOARD_METRICS_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["period_days"] == 30
    assert len(body["bookings_created"]) == 30
    assert len(body["bookings_paid"]) == 30
    assert len(body["signups"]) == 30
    assert isinstance(body["open_disputes_count"], int)
    assert body["open_disputes_count"] >= 0
    first_day = body["bookings_created"][0]
    assert set(first_day) == {"date", "count", "gmv_gbp"}
    first_signup_day = body["signups"][0]
    assert set(first_signup_day) == {"date", "clients", "vendors"}


def test_dashboard_metrics_accepts_7_60_90_day_windows(as_staff) -> None:
    for days in (7, 60, 90):
        response = as_staff.get(DASHBOARD_METRICS_URL, params={"days": days})
        assert response.status_code == 200
        body = response.json()
        assert body["period_days"] == days
        assert len(body["bookings_created"]) == days


def test_dashboard_metrics_out_of_range_days_is_422(as_staff) -> None:
    # `days` is `Query(30, ge=7, le=90)`; outside that range FastAPI itself refuses.
    response = as_staff.get(DASHBOARD_METRICS_URL, params={"days": 5})
    assert response.status_code == 422


def test_dashboard_metrics_off_allowed_set_falls_back_to_30(as_staff) -> None:
    # 45 is inside [7, 90] but not one of the four allowed buckets {7,30,60,90}.
    response = as_staff.get(DASHBOARD_METRICS_URL, params={"days": 45})
    assert response.status_code == 200
    assert response.json()["period_days"] == 30


def test_dashboard_metrics_prices_a_paid_booking_with_no_payment_amount_snapshot(
    admin_db: Client, as_staff
) -> None:
    """`bookings_paid`'s takings for a paid booking that never got a `payment_amount_gbp`
    snapshot fall back to pricing its stored line items and vendor adjustments, same as
    `backend/app/features/admin/dashboard_metrics.py`'s `_booking_gmv_gbp` (which prices
    the row through `build_pricing_breakdown_for_booking_row` when the snapshot is null).
    One £100 line item, no adjustments, the platform's default 5% fee and no referral
    code prices to £105 - the shared dashboard total for today can only ever rise by at
    least that much once this booking is seeded.
    """
    before = as_staff.get(DASHBOARD_METRICS_URL, params={"days": 7}).json()
    today = datetime.now(UTC).date().isoformat()
    before_gmv = next(day["gmv_gbp"] for day in before["bookings_paid"] if day["date"] == today)

    vendor = seed_account(admin_db, unique_email("dashboard-gmv-fallback-vendor"), "vendor")
    client_account = seed_account(admin_db, unique_email("dashboard-gmv-fallback-client"), "client")
    paid_at = datetime.now(UTC).isoformat()
    admin_db.table("booking_requests").insert(
        {
            "client_user_id": client_account.user_id,
            "vendor_user_id": vendor.user_id,
            "event_name": "Acceptance GMV-fallback event",
            "event_date": today,
            "total_label": "£105",
            "status": "accepted",
            "initiator": "client",
            "payment_status": "paid",
            "paid_at": paid_at,
            "line_items": [{"unit_price_gbp": 100}],
            "vendor_adjustments": [],
        }
    ).execute()

    after = as_staff.get(DASHBOARD_METRICS_URL, params={"days": 7}).json()
    after_gmv = next(day["gmv_gbp"] for day in after["bookings_paid"] if day["date"] == today)
    assert after_gmv >= round(before_gmv + 105.0, 2)


# --- GET /admin/marketplace-analytics --------------------------------------------------------------


def test_marketplace_analytics_requires_sign_in(anonymous) -> None:
    response = anonymous.get(MARKETPLACE_ANALYTICS_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_marketplace_analytics_forbidden_for_vendor_account(as_vendor) -> None:
    response = as_vendor.get(MARKETPLACE_ANALYTICS_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_marketplace_analytics_default_shape_for_plain_admin(as_staff) -> None:
    response = as_staff.get(MARKETPLACE_ANALYTICS_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert len(body["from_date"]) == 10  # YYYY-MM-DD
    assert len(body["to_date"]) == 10
    overview = body["overview"]
    for key in ("vendors_total", "vendors_active", "enquiries", "accepted", "paid", "completed"):
        assert isinstance(overview[key], int), key
    for key in ("by_category", "by_location", "failure_reasons", "top_vendors"):
        assert isinstance(body[key], list), key
    for key in ("enquiries_by_month", "completed_by_month"):
        assert isinstance(body[key], list), key
        for entry in body[key]:
            assert set(entry) == {"month", "count"}
    assert set(body["recruitment_hints"]) == {"categories", "locations"}


def test_marketplace_analytics_invalid_from_date_is_400(as_staff) -> None:
    response = as_staff.get(MARKETPLACE_ANALYTICS_URL, params={"from_date": "not-a-date"})
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_DATE


def test_marketplace_analytics_invalid_to_date_is_400(as_staff) -> None:
    response = as_staff.get(MARKETPLACE_ANALYTICS_URL, params={"to_date": "31-12-2025"})
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_DATE


def test_marketplace_analytics_accepts_a_date_range(as_staff) -> None:
    response = as_staff.get(
        MARKETPLACE_ANALYTICS_URL, params={"from_date": "2025-01-01", "to_date": "2025-01-31"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["from_date"] == "2025-01-01"
    assert body["to_date"] == "2025-01-31"


def test_marketplace_analytics_buckets_enquiries_and_completions_by_month(
    admin_db: Client, as_staff
) -> None:
    """`enquiries_by_month` counts by when a booking was made; `completed_by_month` by when
    it finished, falling back to `updated_at` and then `created_at` for a completed booking
    that never got its own `completed_at` (matches
    `backend/app/features/admin/marketplace_analytics.py`'s `completed_at or updated_at or
    created_at`). Two bookings, fixed a few years in the past so no other test's rows can
    land in the same months, prove the union-of-months ordering spans both.
    """
    vendor = seed_account(admin_db, unique_email("marketplace-month-vendor"), "vendor")
    client_one = seed_account(admin_db, unique_email("marketplace-month-client-one"), "client")
    client_two = seed_account(admin_db, unique_email("marketplace-month-client-two"), "client")

    # March: enquired and completed in the same month (direct `completed_at`).
    admin_db.table("booking_requests").insert(
        {
            "client_user_id": client_one.user_id,
            "vendor_user_id": vendor.user_id,
            "event_name": "Acceptance month-bucket event (march)",
            "event_date": "2019-03-01",
            "total_label": "£300",
            "status": "completed",
            "initiator": "client",
            "payment_status": "paid",
            "payment_amount_gbp": 300,
            "created_at": "2019-03-15T10:00:00+00:00",
            "updated_at": "2019-03-20T10:00:00+00:00",
            "completed_at": "2019-03-20T10:00:00+00:00",
        }
    ).execute()

    # April: enquired in April, completed later with no `completed_at` of its own, so
    # `completed_by_month` must fall back to `updated_at`.
    admin_db.table("booking_requests").insert(
        {
            "client_user_id": client_two.user_id,
            "vendor_user_id": vendor.user_id,
            "event_name": "Acceptance month-bucket event (april)",
            "event_date": "2019-04-01",
            "total_label": "£150",
            "status": "completed",
            "initiator": "client",
            "payment_status": "paid",
            "payment_amount_gbp": 150,
            "created_at": "2019-04-05T10:00:00+00:00",
            "updated_at": "2019-04-25T10:00:00+00:00",
        }
    ).execute()

    response = as_staff.get(
        MARKETPLACE_ANALYTICS_URL, params={"from_date": "2019-03-01", "to_date": "2019-04-30"}
    )
    assert response.status_code == 200
    body = response.json()

    enquiries_by_month = {row["month"]: row["count"] for row in body["enquiries_by_month"]}
    completed_by_month = {row["month"]: row["count"] for row in body["completed_by_month"]}
    assert enquiries_by_month.get("2019-03", 0) >= 1
    assert enquiries_by_month.get("2019-04", 0) >= 1
    assert completed_by_month.get("2019-03", 0) >= 1
    assert completed_by_month.get("2019-04", 0) >= 1
    # Union-of-months ordering: every month named in either series appears in both,
    # ascending, and the two series cover exactly the same months.
    assert [row["month"] for row in body["enquiries_by_month"]] == sorted(enquiries_by_month)
    assert [row["month"] for row in body["completed_by_month"]] == sorted(completed_by_month)
    assert {row["month"] for row in body["enquiries_by_month"]} == {
        row["month"] for row in body["completed_by_month"]
    }


# --- GET /admin/directory/search --------------------------------------------------------------------


def test_directory_search_requires_sign_in(anonymous) -> None:
    response = anonymous.get(DIRECTORY_SEARCH_URL, params={"q": "a"})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_directory_search_forbidden_for_client_account(as_client) -> None:
    response = as_client.get(DIRECTORY_SEARCH_URL, params={"q": "a"})
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_directory_search_missing_query_is_422(as_staff) -> None:
    # `q` is `Query(..., min_length=1)`.
    response = as_staff.get(DIRECTORY_SEARCH_URL)
    assert response.status_code == 422


def test_directory_search_finds_a_seeded_client_by_email(admin_db: Client, as_staff) -> None:
    account = seed_account(admin_db, unique_email("directory-search-client"), "client")
    response = as_staff.get(DIRECTORY_SEARCH_URL, params={"q": account.email, "kinds": "client"})
    assert response.status_code == 200
    body = response.json()
    assert body["users"] == [
        {"user_id": account.user_id, "label": account.email, "kind": "client", "email": account.email}
    ]


def test_directory_search_kinds_filter_excludes_the_other_kind(admin_db: Client, as_staff) -> None:
    account = seed_account(admin_db, unique_email("directory-search-vendor-only"), "vendor")
    response = as_staff.get(DIRECTORY_SEARCH_URL, params={"q": account.email, "kinds": "client"})
    assert response.status_code == 200
    assert response.json()["users"] == []


def test_directory_search_unmatched_query_is_empty(as_staff) -> None:
    response = as_staff.get(DIRECTORY_SEARCH_URL, params={"q": unique_email("directory-search-nobody")})
    assert response.status_code == 200
    assert response.json()["users"] == []


# --- GET /admin/vendors/{user_id}/insights -----------------------------------------------------------


def test_vendor_insights_requires_sign_in(anonymous) -> None:
    response = anonymous.get(_vendor_insights_url(MISSING_USER_ID))
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_vendor_insights_forbidden_for_vendor_account(as_vendor) -> None:
    response = as_vendor.get(_vendor_insights_url(MISSING_USER_ID))
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_vendor_insights_unknown_vendor_is_all_zero(as_staff) -> None:
    """No row anywhere names this id, so every count is zero rather than a 404."""
    response = as_staff.get(_vendor_insights_url(MISSING_USER_ID))
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["user_id"] == MISSING_USER_ID
    assert body["review_average"] is None
    assert body["review_count"] == 0
    assert body["bookings_total"] == 0
    assert body["bookings_by_status"] == {}
    assert body["bookings_by_month"] == []
    assert body["open_disputes_on_bookings"] == 0
    assert body["explore_path"] == f"/client/browse/{MISSING_USER_ID}"


def test_vendor_insights_malformed_id_is_also_all_zero(as_staff) -> None:
    # The baseline never validates the id as a UUID before querying with it.
    response = as_staff.get(_vendor_insights_url("not-a-uuid"))
    assert response.status_code == 200
    body = response.json()
    assert body["bookings_total"] == 0
    assert body["review_count"] == 0


def test_vendor_insights_ok_for_a_freshly_seeded_vendor(admin_db: Client, as_staff) -> None:
    account: SeededAccount = seed_account(admin_db, unique_email("vendor-insights"), "vendor")
    response = as_staff.get(_vendor_insights_url(account.user_id))
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == account.user_id
    # No booking or review has ever named this brand-new account.
    assert body["bookings_total"] == 0
    assert body["review_count"] == 0
    assert body["explore_path"] == f"/client/browse/{account.user_id}"


def test_vendor_insights_ok_for_super_admin(as_super_admin) -> None:
    response = as_super_admin.get(_vendor_insights_url(MISSING_USER_ID))
    assert response.status_code == 200
