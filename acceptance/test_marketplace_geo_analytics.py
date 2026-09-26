"""Freeze: client address-lookup stubs (`geo`) and vendor marketplace analytics.

Address lookup (`getAddress.io` / OS Places) is fully disabled in `uk_address.py` -
the provider functions are commented out and replaced with stubs that always
return empty results. This file freezes that disabled behaviour, not a real
provider integration. Vendor analytics (`/vendor/analytics`) is owned by the
`vendors` slice and reads only from `booking_requests` and `booking_reviews`,
scoped to bookings the caller's vendor account initiated as the counterparty
(`initiator = "client"`).
"""

from __future__ import annotations

from supabase import Client

from conftest import API, new_browser, sign_in
from support.accounts import seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. "
    "Sign in with a client account, or create one from the homepage."
)
VENDOR_PORTAL_FORBIDDEN = (
    "This page is for vendor accounts. "
    "If you offer services on Eventtz, create a vendor account or sign out and sign in again "
    "so we can refresh your account type. "
    "If you're planning an event, use client sign-in instead."
)
INVALID_ADDRESS_ID = "Invalid address id."
ADDRESS_RESOLVE_FAILED = (
    "Could not resolve that address. Configure OS_PLACES_API_KEY (OS Places API on "
    "OS Data Hub - not Maps) or GETADDRESS_API_KEY, then try again."
)

GEO_URL = f"{API}/client/geo"
ANALYTICS_URL = f"{API}/vendor/analytics"


def _fresh_client_browser(admin_db: Client, label: str):
    """A browser signed in as a brand-new client account."""
    account = seed_account(admin_db, unique_email(label), "client")
    return sign_in(account)


def _fresh_vendor_browser(admin_db: Client, label: str) -> tuple[object, str]:
    """A browser signed in as a brand-new vendor account, and that account's user id."""
    account = seed_account(admin_db, unique_email(label), "vendor")
    return sign_in(account), account.user_id


# --- address-autocomplete -----------------------------------------------------------------


def test_address_autocomplete_without_a_session_is_401() -> None:
    """GET /client/geo/address-autocomplete requires sign-in."""
    with new_browser() as browser:
        response = browser.get(f"{GEO_URL}/address-autocomplete", params={"term": "SW1A 1AA"})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_address_autocomplete_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account cannot call the client address helpers."""
    account = seed_account(admin_db, unique_email("geo-autocomplete-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.get(f"{GEO_URL}/address-autocomplete", params={"term": "SW1A 1AA"})
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_address_autocomplete_term_too_short_is_a_validation_error(admin_db: Client) -> None:
    """`term` must be at least 2 characters."""
    browser = _fresh_client_browser(admin_db, "geo-autocomplete-short")
    response = browser.get(f"{GEO_URL}/address-autocomplete", params={"term": "a"})
    assert response.status_code == 422


def test_address_autocomplete_always_returns_empty_with_provider_unconfigured(admin_db: Client) -> None:
    """The address provider is disabled: autocomplete always returns no suggestions."""
    browser = _fresh_client_browser(admin_db, "geo-autocomplete-empty")
    response = browser.get(f"{GEO_URL}/address-autocomplete", params={"term": "10 Downing Street"})
    assert response.status_code == 200
    assert response.json() == {"success": True, "suggestions": [], "provider_configured": False}


# --- address-find --------------------------------------------------------------------------


def test_address_find_without_a_session_is_401() -> None:
    """GET /client/geo/address-find requires sign-in."""
    with new_browser() as browser:
        response = browser.get(f"{GEO_URL}/address-find", params={"postcode": "SW1A 1AA"})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_address_find_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account cannot call the client address helpers."""
    account = seed_account(admin_db, unique_email("geo-find-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.get(f"{GEO_URL}/address-find", params={"postcode": "SW1A 1AA"})
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_address_find_postcode_too_short_is_a_validation_error(admin_db: Client) -> None:
    """`postcode` must be at least 4 characters."""
    browser = _fresh_client_browser(admin_db, "geo-find-short")
    response = browser.get(f"{GEO_URL}/address-find", params={"postcode": "AB1"})
    assert response.status_code == 422


def test_address_find_always_returns_empty_with_provider_unconfigured(admin_db: Client) -> None:
    """The address provider is disabled: find always returns no address lines."""
    browser = _fresh_client_browser(admin_db, "geo-find-empty")
    response = browser.get(f"{GEO_URL}/address-find", params={"postcode": "SW1A 1AA"})
    assert response.status_code == 200
    assert response.json() == {"success": True, "addresses": [], "provider_configured": False}


# --- address-resolve/{address_id} ------------------------------------------------------------


def test_address_resolve_without_a_session_is_401() -> None:
    """GET /client/geo/address-resolve/{id} requires sign-in."""
    with new_browser() as browser:
        response = browser.get(f"{GEO_URL}/address-resolve/some-id")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_address_resolve_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account cannot call the client address helpers."""
    account = seed_account(admin_db, unique_email("geo-resolve-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.get(f"{GEO_URL}/address-resolve/some-id")
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_address_resolve_id_over_500_chars_is_400(admin_db: Client) -> None:
    """An address id longer than 500 characters is rejected before any lookup."""
    browser = _fresh_client_browser(admin_db, "geo-resolve-toolong")
    response = browser.get(f"{GEO_URL}/address-resolve/{'x' * 501}")
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_ADDRESS_ID


def test_address_resolve_always_404s_with_provider_unconfigured(admin_db: Client) -> None:
    """The address provider is disabled: any id fails to resolve.

    BASELINE QUIRK: with no provider configured this is always a 404, with a
    message that reads like a real lookup failure rather than "address lookup
    is disabled" - the stub cannot distinguish "not configured" from "not found".
    """
    browser = _fresh_client_browser(admin_db, "geo-resolve-404")
    response = browser.get(f"{GEO_URL}/address-resolve/some-address-id")
    assert response.status_code == 404
    assert response.json()["detail"] == ADDRESS_RESOLVE_FAILED


# --- vendor analytics ------------------------------------------------------------------------


def test_vendor_analytics_without_a_session_is_401() -> None:
    """GET /vendor/analytics requires sign-in."""
    with new_browser() as browser:
        response = browser.get(ANALYTICS_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_vendor_analytics_is_forbidden_for_a_client(admin_db: Client) -> None:
    """A client account cannot call the vendor analytics endpoint."""
    browser = _fresh_client_browser(admin_db, "analytics-client")
    response = browser.get(ANALYTICS_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_vendor_analytics_days_below_minimum_is_a_validation_error(admin_db: Client) -> None:
    """`days` must be at least 7."""
    browser, _vendor_id = _fresh_vendor_browser(admin_db, "analytics-days-low")
    response = browser.get(ANALYTICS_URL, params={"days": 1})
    assert response.status_code == 422


def test_vendor_analytics_days_above_maximum_is_a_validation_error(admin_db: Client) -> None:
    """`days` must be at most 365."""
    browser, _vendor_id = _fresh_vendor_browser(admin_db, "analytics-days-high")
    response = browser.get(ANALYTICS_URL, params={"days": 1000})
    assert response.status_code == 422


def test_vendor_analytics_with_no_bookings_is_all_zeroes(admin_db: Client) -> None:
    """A brand-new vendor with no enquiries gets an empty-but-well-shaped report."""
    browser, _vendor_id = _fresh_vendor_browser(admin_db, "analytics-empty")
    response = browser.get(ANALYTICS_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["period_days"] == 90
    assert body["overview"] == {
        "enquiries": 0,
        "completed": 0,
        "total_revenue_gbp": 0.0,
        "avg_booking_value_gbp": 0.0,
        "avg_customer_rating": 0.0,
        "review_count": 0,
        "avg_response_seconds": None,
        "conversion_rate": 0.0,
        "pending_enquiries": 0,
        "expired_enquiries": 0,
        "upcoming_bookings": 0,
        "profile_views": 0,
    }
    assert body["funnel"] == {
        "profile_views": 0,
        "enquiries": 0,
        "accepted": 0,
        "paid": 0,
        "completed": 0,
    }
    assert body["enquiries_by_month"] == []
    assert body["revenue_by_month"] == []
    assert body["response_time_by_month"] == []
    assert body["rating_by_month"] == []


def test_vendor_analytics_counts_a_completed_client_initiated_enquiry(admin_db: Client) -> None:
    """A completed booking the client initiated counts as an enquiry and a completion."""
    browser, vendor_id = _fresh_vendor_browser(admin_db, "analytics-completed")
    client_account = seed_account(admin_db, unique_email("analytics-completed-client"), "client")
    admin_db.table("booking_requests").insert(
        {
            "client_user_id": client_account.user_id,
            "vendor_user_id": vendor_id,
            "event_name": "Acceptance analytics event",
            "event_date": "2020-01-01",
            "total_label": "£300",
            "status": "completed",
            "initiator": "client",
            "payment_amount_gbp": 300,
            "vendor_amount_gbp": 270,
        }
    ).execute()

    response = browser.get(ANALYTICS_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["overview"]["enquiries"] == 1
    assert body["overview"]["completed"] == 1
    assert body["overview"]["total_revenue_gbp"] == 270.0
    assert body["overview"]["avg_booking_value_gbp"] == 270.0
    assert body["overview"]["conversion_rate"] == 1.0
    assert body["funnel"]["enquiries"] == 1
    assert body["funnel"]["completed"] == 1


def test_vendor_analytics_ignores_a_vendor_initiated_booking(admin_db: Client) -> None:
    """Only bookings the client initiated count towards enquiries (vendor-initiated ones do not)."""
    browser, vendor_id = _fresh_vendor_browser(admin_db, "analytics-vendor-initiated")
    client_account = seed_account(admin_db, unique_email("analytics-vendor-init-client"), "client")
    admin_db.table("booking_requests").insert(
        {
            "client_user_id": client_account.user_id,
            "vendor_user_id": vendor_id,
            "event_name": "Acceptance vendor-initiated event",
            "event_date": "2020-01-01",
            "total_label": "£300",
            "status": "completed",
            "initiator": "vendor",
        }
    ).execute()

    response = browser.get(ANALYTICS_URL)
    assert response.status_code == 200
    assert response.json()["overview"]["enquiries"] == 0


def test_vendor_analytics_scopes_bookings_to_the_signed_in_vendor(admin_db: Client) -> None:
    """One vendor's analytics never include another vendor's bookings."""
    browser_one, vendor_one_id = _fresh_vendor_browser(admin_db, "analytics-scope-a")
    _browser_two, vendor_two_id = _fresh_vendor_browser(admin_db, "analytics-scope-b")
    client_account = seed_account(admin_db, unique_email("analytics-scope-client"), "client")
    admin_db.table("booking_requests").insert(
        {
            "client_user_id": client_account.user_id,
            "vendor_user_id": vendor_two_id,
            "event_name": "Acceptance scope event",
            "event_date": "2020-01-01",
            "total_label": "£300",
            "status": "completed",
            "initiator": "client",
        }
    ).execute()

    response = browser_one.get(ANALYTICS_URL)
    assert response.status_code == 200
    assert response.json()["overview"]["enquiries"] == 0
    assert vendor_one_id != vendor_two_id
