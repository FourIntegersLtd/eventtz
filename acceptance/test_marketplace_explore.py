"""Freeze: public vendor discovery - explore list, detail, search, and public reviews.

Owned by the `vendors` slice, mounted at `/api/v1/vendors`. These routes are public
(anonymous browsing works); a signed-in caller only changes QA-scoped visibility,
which is not exercised here. Every test seeds a fresh vendor account with a unique
`businessName` directly in `vendors` (bypassing onboarding validation) so list/search
assertions can filter to the vendor(s) that test created.

A vendor is publicly listed only when `approval_status = "approved"` and Stripe
Connect reports both `stripe_charges_enabled` and `stripe_payouts_enabled` (or an
admin `listing_override` says otherwise) - see `backend/app/features/vendors/visibility.py`.
Only GB is a supported market, so any `country` other than `GB` is silently treated
as `GB` (`normalize_country_code`).
"""

from __future__ import annotations

import uuid

from supabase import Client

from conftest import API, new_browser
from support.accounts import seed_account, unique_email

VENDOR_NOT_FOUND_INVALID_ID = "We couldn't find that vendor."
VENDOR_NOT_FOUND_OR_NOT_LISTED = "Vendor not found or not listed."

EXPLORE_URL = f"{API}/vendors/explore"
EXPLORE_SEARCH_URL = f"{API}/vendors/explore/search"

# A syntactically valid UUID that no vendor will ever have.
MISSING_VENDOR_ID = "00000000-0000-4000-8000-000000000000"


def _seed_listable_vendor(
    admin_db: Client,
    label: str,
    *,
    business_name: str | None = None,
    approval_status: str = "approved",
    payouts_verified: bool = True,
    listing_override: str = "auto",
    base_city: str = "London",
    services_offered: list[str] | None = None,
    hourly_rate: float | None = 100,
    min_list_price_gbp: float | None = 100,
) -> tuple[str, str]:
    """A fresh vendor account with a `vendors` row that (by default) is publicly listed.

    Returns (user_id, business_name).
    """
    account = seed_account(admin_db, unique_email(label), "vendor")
    name = business_name or f"Acceptance {label} {uuid.uuid4().hex[:8]}"
    services = services_offered if services_offered is not None else ["catering"]
    payload: dict[str, object] = {
        "businessName": name,
        "baseCity": base_city,
        "servicesOffered": services,
        "hourlyRate": str(hourly_rate) if hourly_rate is not None else "",
    }
    admin_db.table("vendors").insert(
        {
            "user_id": account.user_id,
            "status": "complete",
            "approval_status": approval_status,
            "payload": payload,
            "country_code": "GB",
            "base_city_normalized": base_city.strip().lower(),
            "services_offered": services,
            "min_list_price_gbp": min_list_price_gbp,
            "listing_override": listing_override,
            "stripe_account_id": "acct_fake" if payouts_verified else None,
            "stripe_charges_enabled": payouts_verified,
            "stripe_payouts_enabled": payouts_verified,
        }
    ).execute()
    return account.user_id, name


def _explore_names(admin_db: Client, *, country: str | None = None) -> dict[str, dict[str, object]]:
    """`{business_name: vendor_row}` from a fresh GET /vendors/explore."""
    with new_browser() as browser:
        params = {"country": country} if country else {}
        response = browser.get(EXPLORE_URL, params=params)
    assert response.status_code == 200
    body = response.json()
    return {
        row["profile_form_data"]["businessName"]: row
        for row in body["vendors"]
        if isinstance(row.get("profile_form_data"), dict) and row["profile_form_data"].get("businessName")
    }


# --- GET /vendors/explore --------------------------------------------------------------------


def test_explore_lists_an_approved_and_payout_verified_vendor(admin_db: Client) -> None:
    """A fresh approved vendor with verified payouts appears with the expected shape."""
    user_id, name = _seed_listable_vendor(admin_db, "explore-listed")
    rows = _explore_names(admin_db)
    assert name in rows
    row = rows[name]
    assert row["user_id"] == user_id
    assert row["approval_status"] == "approved"
    assert row["status"] == "complete"
    assert row["review_average"] is None
    assert row["review_count"] == 0
    assert row["completed_bookings"] == 0
    assert row["avg_response_seconds"] is None
    assert row["conversion_rate"] is None


def test_explore_excludes_a_pending_vendor(admin_db: Client) -> None:
    """A vendor still awaiting admin approval never appears on explore."""
    _user_id, name = _seed_listable_vendor(admin_db, "explore-pending", approval_status="pending")
    rows = _explore_names(admin_db)
    assert name not in rows


def test_explore_excludes_an_approved_vendor_without_verified_payouts(admin_db: Client) -> None:
    """Approval alone is not enough - Stripe must report both charges and payouts enabled."""
    _user_id, name = _seed_listable_vendor(admin_db, "explore-nopayout", payouts_verified=False)
    rows = _explore_names(admin_db)
    assert name not in rows


def test_explore_excludes_a_banned_vendor_even_with_verified_payouts(admin_db: Client) -> None:
    """`approval_status` always wins: a banned vendor is never listed."""
    _user_id, name = _seed_listable_vendor(admin_db, "explore-banned", approval_status="banned")
    rows = _explore_names(admin_db)
    assert name not in rows


def test_explore_listing_override_hidden_takes_down_an_otherwise_listable_vendor(admin_db: Client) -> None:
    """`listing_override=hidden` removes an approved, payout-verified vendor from explore."""
    _user_id, name = _seed_listable_vendor(admin_db, "explore-override-hidden", listing_override="hidden")
    rows = _explore_names(admin_db)
    assert name not in rows


def test_explore_listing_override_visible_waives_the_payout_gate(admin_db: Client) -> None:
    """`listing_override=visible` lists an approved vendor even without verified Stripe payouts."""
    _user_id, name = _seed_listable_vendor(
        admin_db,
        "explore-override-visible",
        payouts_verified=False,
        listing_override="visible",
    )
    rows = _explore_names(admin_db)
    assert name in rows


def test_explore_defaults_to_the_gb_market_for_an_unsupported_country(admin_db: Client) -> None:
    """`country=US` is not a supported market, so it silently falls back to GB.

    BASELINE QUIRK: an unsupported country code is not rejected; it is normalized
    to the only enabled market (GB) rather than returning an error or empty list.
    """
    _user_id, name = _seed_listable_vendor(admin_db, "explore-market-fallback")
    rows = _explore_names(admin_db, country="US")
    assert name in rows


# --- GET /vendors/explore/vendor/{vendor_user_id} --------------------------------------------


def test_explore_vendor_detail_invalid_id_is_400() -> None:
    """A non-UUID vendor id is a validation error, not a 404."""
    with new_browser() as browser:
        response = browser.get(f"{EXPLORE_URL}/vendor/not-a-uuid")
    assert response.status_code == 400
    assert response.json()["detail"] == VENDOR_NOT_FOUND_INVALID_ID


def test_explore_vendor_detail_unknown_id_is_404() -> None:
    """A syntactically valid but unknown vendor id is a 404."""
    with new_browser() as browser:
        response = browser.get(f"{EXPLORE_URL}/vendor/{MISSING_VENDOR_ID}")
    assert response.status_code == 404
    assert response.json()["detail"] == VENDOR_NOT_FOUND_OR_NOT_LISTED


def test_explore_vendor_detail_not_publicly_listed_is_404(admin_db: Client) -> None:
    """A pending vendor's detail page 404s the same as an unknown vendor - no leak."""
    user_id, _name = _seed_listable_vendor(admin_db, "explore-detail-pending", approval_status="pending")
    with new_browser() as browser:
        response = browser.get(f"{EXPLORE_URL}/vendor/{user_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == VENDOR_NOT_FOUND_OR_NOT_LISTED


def test_explore_vendor_detail_returns_the_listed_vendor(admin_db: Client) -> None:
    """A listable vendor's detail page returns its profile data."""
    user_id, name = _seed_listable_vendor(admin_db, "explore-detail-ok")
    with new_browser() as browser:
        response = browser.get(f"{EXPLORE_URL}/vendor/{user_id}")
    assert response.status_code == 200
    body = response.json()
    vendor = body["vendor"]
    assert vendor["user_id"] == user_id
    assert vendor["profile_form_data"]["businessName"] == name
    assert vendor["approval_status"] == "approved"


# --- GET /vendors/explore/search ---------------------------------------------------------------


def test_explore_search_finds_a_vendor_by_free_text_business_name(admin_db: Client) -> None:
    """`q` matches on business name (via the token-only fallback: OpenAI is unconfigured)."""
    unique_word = f"acceptancesearch{uuid.uuid4().hex[:10]}"
    user_id, name = _seed_listable_vendor(admin_db, "search-q", business_name=f"{unique_word} Catering Co")
    with new_browser() as browser:
        response = browser.get(EXPLORE_SEARCH_URL, params={"q": unique_word})
    assert response.status_code == 200
    body = response.json()
    assert body["search_mode"] == "simple"
    ids = {row["user_id"] for row in body["vendors"]}
    assert user_id in ids
    matched = next(row for row in body["vendors"] if row["user_id"] == user_id)
    assert matched["profile_form_data"]["businessName"] == name


def test_explore_search_filters_by_service_type_chip(admin_db: Client) -> None:
    """`types` narrows results to vendors offering that exact service."""
    label = uuid.uuid4().hex[:8]
    catering_id, _catering_name = _seed_listable_vendor(
        admin_db, f"search-type-cater-{label}", services_offered=["catering"]
    )
    dj_id, _dj_name = _seed_listable_vendor(admin_db, f"search-type-dj-{label}", services_offered=["dj"])
    with new_browser() as browser:
        response = browser.get(
            EXPLORE_SEARCH_URL,
            params={"q": label, "types": "catering"},
        )
    assert response.status_code == 200
    ids = {row["user_id"] for row in response.json()["vendors"]}
    assert catering_id in ids
    assert dj_id not in ids


def test_explore_search_budget_max_excludes_a_pricier_vendor(admin_db: Client) -> None:
    """`budget_max` excludes vendors whose lowest listed price is above it."""
    unique_word = f"acceptancebudget{uuid.uuid4().hex[:10]}"
    cheap_id, _cheap_name = _seed_listable_vendor(
        admin_db, "search-budget-cheap", business_name=f"{unique_word} cheap", min_list_price_gbp=50
    )
    pricey_id, _pricey_name = _seed_listable_vendor(
        admin_db, "search-budget-pricey", business_name=f"{unique_word} pricey", min_list_price_gbp=500
    )
    with new_browser() as browser:
        response = browser.get(
            EXPLORE_SEARCH_URL,
            params={"q": unique_word, "budget_max": 100},
        )
    assert response.status_code == 200
    ids = {row["user_id"] for row in response.json()["vendors"]}
    assert cheap_id in ids
    assert pricey_id not in ids


def test_explore_search_vendor_ids_restricts_to_the_given_ids(admin_db: Client) -> None:
    """`vendor_ids` (used by the favorites view) restricts the pool to those ids only."""
    label = uuid.uuid4().hex[:8]
    kept_id, _kept_name = _seed_listable_vendor(admin_db, f"search-vids-keep-{label}")
    other_id, _other_name = _seed_listable_vendor(admin_db, f"search-vids-other-{label}")
    with new_browser() as browser:
        response = browser.get(
            EXPLORE_SEARCH_URL,
            params={"q": label, "vendor_ids": kept_id},
        )
    assert response.status_code == 200
    ids = {row["user_id"] for row in response.json()["vendors"]}
    assert ids == {kept_id}
    assert other_id not in ids


def test_explore_search_with_no_query_returns_all_listable_vendors(admin_db: Client) -> None:
    """An empty `q` runs the plain ranked-list mode, still scoped to listable vendors."""
    user_id, _name = _seed_listable_vendor(admin_db, "search-no-query")
    with new_browser() as browser:
        response = browser.get(EXPLORE_SEARCH_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["search_mode"] == "simple"
    ids = {row["user_id"] for row in body["vendors"]}
    assert user_id in ids


def test_explore_search_excludes_a_non_listable_vendor(admin_db: Client) -> None:
    """Search only ever draws from the same publicly listable pool as explore."""
    label = uuid.uuid4().hex[:8]
    _user_id, name = _seed_listable_vendor(admin_db, f"search-nonlisted-{label}", approval_status="pending")
    with new_browser() as browser:
        response = browser.get(EXPLORE_SEARCH_URL, params={"q": label})
    assert response.status_code == 200
    names = {row["profile_form_data"].get("businessName") for row in response.json()["vendors"]}
    assert name not in names


def test_explore_search_invalid_sort_falls_back_to_relevance(admin_db: Client) -> None:
    """An unrecognized `sort` value is not a validation error - it silently becomes relevance."""
    label = uuid.uuid4().hex[:8]
    user_id, _name = _seed_listable_vendor(admin_db, f"search-badsort-{label}")
    with new_browser() as browser:
        response = browser.get(EXPLORE_SEARCH_URL, params={"q": label, "sort": "bogus-sort-key"})
    assert response.status_code == 200
    ids = {row["user_id"] for row in response.json()["vendors"]}
    assert user_id in ids


# --- GET /vendors/{vendor_user_id}/reviews -------------------------------------------------


def test_public_reviews_invalid_id_is_400() -> None:
    """A non-UUID vendor id is a validation error."""
    with new_browser() as browser:
        response = browser.get(f"{API}/vendors/not-a-uuid/reviews")
    assert response.status_code == 400
    assert response.json()["detail"] == VENDOR_NOT_FOUND_INVALID_ID


def test_public_reviews_unknown_vendor_returns_an_empty_summary() -> None:
    """An unknown (or reviewless) vendor gets a 200 with an empty review list, not a 404."""
    with new_browser() as browser:
        response = browser.get(f"{API}/vendors/{MISSING_VENDOR_ID}/reviews")
    assert response.status_code == 200
    body = response.json()
    assert body == {"success": True, "average_rating": None, "review_count": 0, "reviews": []}


def test_public_reviews_returns_a_visible_review_for_a_completed_booking(admin_db: Client) -> None:
    """A review on a completed booking shows up with the expected public shape."""
    vendor_id, _name = _seed_listable_vendor(admin_db, "reviews-visible")
    client_account = seed_account(admin_db, unique_email("reviews-client"), "client")
    review_body = f"Wonderful vendor, would book again {uuid.uuid4().hex[:8]}."
    booking = (
        admin_db.table("booking_requests")
        .insert(
            {
                "client_user_id": client_account.user_id,
                "vendor_user_id": vendor_id,
                "event_name": "Acceptance review event",
                "event_date": "2099-01-01",
                "total_label": "£250",
                "status": "completed",
            }
        )
        .execute()
    )
    booking_id = str(booking.data[0]["id"])
    admin_db.table("booking_reviews").insert(
        {
            "booking_request_id": booking_id,
            "vendor_user_id": vendor_id,
            "client_user_id": client_account.user_id,
            "rating": 5,
            "body": review_body,
        }
    ).execute()

    with new_browser() as browser:
        response = browser.get(f"{API}/vendors/{vendor_id}/reviews")
    assert response.status_code == 200
    body = response.json()
    assert body["review_count"] == 1
    assert body["average_rating"] == 5.0
    assert len(body["reviews"]) == 1
    review = body["reviews"][0]
    assert review["rating"] == 5
    assert review["body"] == review_body
    assert review["event_name"] == "Acceptance review event"
    assert review["booking_total_label"] == "£250"
