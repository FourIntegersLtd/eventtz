"""Freeze: the vendor side of the booking-request lifecycle.

Covers `/api/v1/vendor/booking-requests` (list, vendor-initiated quote create),
`/{booking_id}` (detail), `/{booking_id}/adjustments` (PUT), `/{booking_id}/status`
(accept/decline/cancel) and `/{booking_id}/confirm-completion`. There is no vendor
`/cancel` route: a vendor withdraws by `PATCH .../status {"status": "cancelled"}`.
Payments, receipts, disputes and reviews live on the same rows but are other slices.

Every test seeds a fresh vendor and client pair with `seed_account`/`unique_email` and
plants `vendors`/`booking_requests` rows directly with `admin_db`. Vendors that must be
publicly bookable (for the vendor-quote create flow, which gates the same way as
client create) get `approval_status="approved"`, `listing_override="visible"` and a
non-empty `payload` (see `test_bookings_client.py`'s `_seed_bookable_vendor` docstring
for the empty-payload calendar quirk this avoids).
"""

from __future__ import annotations

from support.database import LocalDatabase

from conftest import API, new_browser, sign_in
from support.accounts import SeededAccount, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
VENDOR_PORTAL_FORBIDDEN = (
    "This page is for vendor accounts. If you offer services on Eventtz, create a vendor account or sign "
    "out and sign in again so we can refresh your account type. If you're planning an event, use client "
    "sign-in instead."
)

INVALID_BOOKING_ID = "Invalid booking id."
INVALID_CLIENT_ID = "Invalid client id."
BOOKING_NOT_FOUND = "Booking not found."
GROUP_QUERY_PARAM = "Query parameter group must be active, completed, closed, or all."
CANNOT_QUOTE_SELF = "Cannot send a quote to yourself."
QUOTES_CLIENT_ONLY = "Quotes can only be sent to a client account."
QUOTE_LINE_NEEDS_PRICE = "Each quote line needs a price."
QUOTE_LINE_MIN_PRICE = "Each quote line must be at least GBP 0.01."
QUOTE_MAX_LINES = "A quote cannot have more than 25 line items."
WITHDRAW_QUOTE_USE_CANCEL = "Withdraw a quote you sent using cancel instead of reject."
CLIENT_MUST_ACCEPT_QUOTE = "The client must accept a vendor quote."
COMPLETE_PAYOUT_SETUP = "Complete payout setup before accepting bookings."
CLIENT_MUST_CONFIRM_PRICE = "The client must confirm the updated price before you can accept this booking."
ADJUSTMENTS_NOT_ON_VENDOR_QUOTE = "Adjustments are not editable on vendor quotes before the client accepts."
ADDITIONAL_COSTS_PENDING_ONLY = "Additional costs can only be edited while the request is pending."
SURCHARGE_MAX = "Each surcharge cannot exceed GBP 5,000."
SURCHARGES_PCT = "Total surcharges cannot exceed 100% of the quoted line items."
DISCOUNTS_TOO_HIGH = "Discounts cannot reduce the booking total to zero or below."

# A package with details long enough to pass the vendor payload's 40-character minimum.
PACKAGE_DETAILS = "A full package covering setup, service and clearup on the day."
# A UUID no booking will ever have, for 404 checks.
MISSING_BOOKING_ID = "00000000-0000-4000-8000-000000000000"


def _seed_bookable_vendor(admin_db: LocalDatabase, label: str) -> SeededAccount:
    """A vendor approved, listing-override-visible and payout-gate-waived, with a non-empty payload."""
    account = seed_account(admin_db, unique_email(label), "vendor")
    admin_db.table("vendors").insert(
        {
            "user_id": account.user_id,
            "status": "complete",
            "approval_status": "approved",
            "listing_override": "visible",
            "listing_override_reason": "acceptance suite: bookable vendor",
            "payload": {"maxBookingsPerDay": "20"},
        }
    ).execute()
    return account


def _seed_unwaived_vendor(admin_db: LocalDatabase, label: str) -> SeededAccount:
    """A vendor approved but WITHOUT the payout-gate waiver or real Stripe fields.

    Not publicly bookable (no `listing_override`, no Stripe), so its bookings must be
    seeded directly rather than created through the API - used to freeze
    `COMPLETE_PAYOUT_SETUP`.
    """
    account = seed_account(admin_db, unique_email(label), "vendor")
    admin_db.table("vendors").insert(
        {
            "user_id": account.user_id,
            "status": "complete",
            "approval_status": "approved",
            "payload": {"maxBookingsPerDay": "5"},
        }
    ).execute()
    return account


def _seed_booking_row(
    admin_db: LocalDatabase,
    *,
    client_user_id: str,
    vendor_user_id: str,
    status: str = "pending",
    payment_status: str = "unpaid",
    initiator: str = "client",
    event_date: str = "2099-06-01",
    total_label: str = "£150",
    vendor_adjustments: list[dict[str, object]] | None = None,
) -> str:
    """A `booking_requests` row inserted directly, in whatever state a test needs."""
    row = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        "event_name": "Acceptance test event",
        "event_date": event_date,
        "status": status,
        "payment_status": payment_status,
        "initiator": initiator,
        "total_label": total_label,
        "selected_option_ids": ["pkg-1"] if initiator == "client" else [],
        "line_items": [
            {
                "id": "pkg-1",
                "heading": "Classic Package",
                "unit_price_gbp": 150.0,
                "description": PACKAGE_DETAILS,
            }
        ],
        "vendor_adjustments": vendor_adjustments or [],
    }
    inserted = admin_db.table("booking_requests").insert(row).execute().data
    return str(inserted[0]["id"])


def test_create_vendor_quote_success_returns_pending_booking(admin_db: LocalDatabase) -> None:
    """A valid vendor-initiated quote returns 200 with a pending booking."""
    vendor_account = _seed_bookable_vendor(admin_db, "quote-ok-vendor")
    client_account = seed_account(admin_db, unique_email("quote-ok-client"), "client")
    browser = sign_in(vendor_account)
    response = browser.post(
        f"{API}/vendor/booking-requests/vendor-quote",
        json={
            "client_user_id": client_account.user_id,
            "event_name": "DJ for a wedding",
            "event_date": "2099-06-01",
            "line_items": [{"id": "li-1", "heading": "DJ set", "unit_price_gbp": 200}],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["booking_status"] == "pending"


def test_create_vendor_quote_pricing_breakdown_matches_line_items(admin_db: LocalDatabase) -> None:
    """Detail after creating a quote shows the literal pricing figures for a known £200 line."""
    vendor_account = _seed_bookable_vendor(admin_db, "quote-pricing-vendor")
    client_account = seed_account(admin_db, unique_email("quote-pricing-client"), "client")
    browser = sign_in(vendor_account)
    created = browser.post(
        f"{API}/vendor/booking-requests/vendor-quote",
        json={
            "client_user_id": client_account.user_id,
            "event_name": "Pricing check",
            "event_date": "2099-06-01",
            "line_items": [{"id": "li-1", "heading": "DJ set", "unit_price_gbp": 200}],
        },
    ).json()
    booking_id = created["booking_request_id"]
    detail = browser.get(f"{API}/vendor/booking-requests/{booking_id}").json()["booking"]
    pricing = detail["pricing"]
    assert pricing["vendor_portion_gbp"] == 200.0
    assert pricing["service_fee_gbp"] == 10.0
    assert pricing["client_total_gbp"] == 210.0
    assert pricing["client_total_label"] == "GBP 210"


def test_create_vendor_quote_rejects_self(admin_db: LocalDatabase) -> None:
    """A vendor cannot send a quote to their own account."""
    vendor_account = _seed_bookable_vendor(admin_db, "quote-self-vendor")
    browser = sign_in(vendor_account)
    response = browser.post(
        f"{API}/vendor/booking-requests/vendor-quote",
        json={
            "client_user_id": vendor_account.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "line_items": [{"id": "li-1", "heading": "DJ", "unit_price_gbp": 100}],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == CANNOT_QUOTE_SELF


def test_create_vendor_quote_rejects_malformed_client_id(admin_db: LocalDatabase) -> None:
    """A non-UUID client id is rejected before any client lookup happens."""
    vendor_account = _seed_bookable_vendor(admin_db, "quote-badclient-vendor")
    browser = sign_in(vendor_account)
    response = browser.post(
        f"{API}/vendor/booking-requests/vendor-quote",
        json={
            "client_user_id": "not-a-uuid",
            "event_name": "x",
            "event_date": "2099-06-01",
            "line_items": [{"id": "li-1", "heading": "DJ", "unit_price_gbp": 100}],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_CLIENT_ID


def test_create_vendor_quote_rejects_vendor_as_target(admin_db: LocalDatabase) -> None:
    """A quote can only be sent to a client account, not another vendor."""
    vendor_account = _seed_bookable_vendor(admin_db, "quote-wrongtarget-vendor")
    other_vendor = seed_account(admin_db, unique_email("quote-wrongtarget-target"), "vendor")
    browser = sign_in(vendor_account)
    response = browser.post(
        f"{API}/vendor/booking-requests/vendor-quote",
        json={
            "client_user_id": other_vendor.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "line_items": [{"id": "li-1", "heading": "DJ", "unit_price_gbp": 100}],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == QUOTES_CLIENT_ONLY


def test_create_vendor_quote_rejects_empty_line_items(admin_db: LocalDatabase) -> None:
    """An empty `line_items` list fails request validation (`min_length=1`)."""
    vendor_account = _seed_bookable_vendor(admin_db, "quote-emptylines-vendor")
    client_account = seed_account(admin_db, unique_email("quote-emptylines-client"), "client")
    browser = sign_in(vendor_account)
    response = browser.post(
        f"{API}/vendor/booking-requests/vendor-quote",
        json={
            "client_user_id": client_account.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "line_items": [],
        },
    )
    assert response.status_code == 422


def test_create_vendor_quote_rejects_line_without_price(admin_db: LocalDatabase) -> None:
    """A line item with no `unit_price_gbp` is refused by the service layer."""
    vendor_account = _seed_bookable_vendor(admin_db, "quote-noprice-vendor")
    client_account = seed_account(admin_db, unique_email("quote-noprice-client"), "client")
    browser = sign_in(vendor_account)
    response = browser.post(
        f"{API}/vendor/booking-requests/vendor-quote",
        json={
            "client_user_id": client_account.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "line_items": [{"id": "li-1", "heading": "DJ"}],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == QUOTE_LINE_NEEDS_PRICE


def test_create_vendor_quote_rejects_price_below_minimum(admin_db: LocalDatabase) -> None:
    """A line item priced at £0 fails the £0.01 minimum."""
    vendor_account = _seed_bookable_vendor(admin_db, "quote-minprice-vendor")
    client_account = seed_account(admin_db, unique_email("quote-minprice-client"), "client")
    browser = sign_in(vendor_account)
    response = browser.post(
        f"{API}/vendor/booking-requests/vendor-quote",
        json={
            "client_user_id": client_account.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "line_items": [{"id": "li-1", "heading": "DJ", "unit_price_gbp": 0}],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == QUOTE_LINE_MIN_PRICE


def test_create_vendor_quote_rejects_more_than_twenty_five_lines(admin_db: LocalDatabase) -> None:
    """A quote with 26 line items is refused: the cap is 25."""
    vendor_account = _seed_bookable_vendor(admin_db, "quote-maxlines-vendor")
    client_account = seed_account(admin_db, unique_email("quote-maxlines-client"), "client")
    browser = sign_in(vendor_account)
    line_items = [
        {"id": f"li-{index}", "heading": f"Item {index}", "unit_price_gbp": 10} for index in range(26)
    ]
    response = browser.post(
        f"{API}/vendor/booking-requests/vendor-quote",
        json={
            "client_user_id": client_account.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "line_items": line_items,
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == QUOTE_MAX_LINES


def test_create_vendor_quote_requires_sign_in(admin_db: LocalDatabase) -> None:
    """Anonymous quote-create is rejected."""
    client_account = seed_account(admin_db, unique_email("quote-anon-client"), "client")
    browser = new_browser()
    response = browser.post(
        f"{API}/vendor/booking-requests/vendor-quote",
        json={
            "client_user_id": client_account.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "line_items": [{"id": "li-1", "heading": "DJ", "unit_price_gbp": 100}],
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_create_vendor_quote_forbidden_for_client_accounts(admin_db: LocalDatabase) -> None:
    """A client account cannot use the vendor quote-create route."""
    client_account = seed_account(admin_db, unique_email("quote-wrongrole-client"), "client")
    other_client = seed_account(admin_db, unique_email("quote-wrongrole-target"), "client")
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/vendor/booking-requests/vendor-quote",
        json={
            "client_user_id": other_client.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "line_items": [{"id": "li-1", "heading": "DJ", "unit_price_gbp": 100}],
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_list_vendor_booking_requests_returns_own_active_bookings(admin_db: LocalDatabase) -> None:
    """The active group lists a vendor's own pending/accepted bookings."""
    vendor_account = _seed_bookable_vendor(admin_db, "list-vendor")
    client_account = seed_account(admin_db, unique_email("list-vendor-client"), "client")
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(vendor_account)
    response = browser.get(f"{API}/vendor/booking-requests", params={"group": "active"})
    assert response.status_code == 200
    booking_ids = [booking["booking_request_id"] for booking in response.json()["bookings"]]
    assert booking_id in booking_ids


def test_list_vendor_booking_requests_rejects_unknown_group(admin_db: LocalDatabase) -> None:
    """An invalid `group` query parameter is rejected with the allowed values listed."""
    vendor_account = _seed_bookable_vendor(admin_db, "bad-group-vendor")
    browser = sign_in(vendor_account)
    response = browser.get(f"{API}/vendor/booking-requests", params={"group": "bogus"})
    assert response.status_code == 400
    assert response.json()["detail"] == GROUP_QUERY_PARAM


def test_list_vendor_booking_requests_requires_sign_in() -> None:
    """Anonymous listing is rejected."""
    browser = new_browser()
    response = browser.get(f"{API}/vendor/booking-requests")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_get_vendor_booking_detail_hidden_from_non_owner_vendor(admin_db: LocalDatabase) -> None:
    """Another vendor cannot see this booking: it is a 404, not a 403."""
    owner = _seed_bookable_vendor(admin_db, "detail-owner-vendor")
    other_vendor = seed_account(admin_db, unique_email("detail-other-vendor"), "vendor")
    client_account = seed_account(admin_db, unique_email("detail-owner-client"), "client")
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=owner.user_id
    )
    other_browser = sign_in(other_vendor)
    response = other_browser.get(f"{API}/vendor/booking-requests/{booking_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == BOOKING_NOT_FOUND


def test_get_vendor_booking_detail_not_found_for_missing_id(admin_db: LocalDatabase) -> None:
    """A booking id that does not exist is a 404 for a signed-in vendor."""
    vendor_account = _seed_bookable_vendor(admin_db, "detail-404-vendor")
    browser = sign_in(vendor_account)
    response = browser.get(f"{API}/vendor/booking-requests/{MISSING_BOOKING_ID}")
    assert response.status_code == 404
    assert response.json()["detail"] == BOOKING_NOT_FOUND


def test_get_vendor_booking_detail_rejects_malformed_id(admin_db: LocalDatabase) -> None:
    """A non-UUID path segment is a 400, not a 404."""
    vendor_account = _seed_bookable_vendor(admin_db, "detail-badid-vendor")
    browser = sign_in(vendor_account)
    response = browser.get(f"{API}/vendor/booking-requests/not-a-uuid")
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_BOOKING_ID


def test_vendor_withdraws_own_quote_via_cancelled_status(admin_db: LocalDatabase) -> None:
    """There is no vendor `/cancel` route: withdrawing a sent quote uses `status=cancelled`."""
    vendor_account = _seed_bookable_vendor(admin_db, "withdraw-vendor")
    client_account = seed_account(admin_db, unique_email("withdraw-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
        initiator="vendor",
    )
    browser = sign_in(vendor_account)
    response = browser.patch(
        f"{API}/vendor/booking-requests/{booking_id}/status", json={"status": "cancelled"}
    )
    assert response.status_code == 200
    assert response.json()["booking_status"] == "cancelled"


def test_vendor_declining_own_quote_is_refused(admin_db: LocalDatabase) -> None:
    """A vendor cannot decline a quote they sent; the message points at cancel instead."""
    vendor_account = _seed_bookable_vendor(admin_db, "decline-own-vendor")
    client_account = seed_account(admin_db, unique_email("decline-own-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
        initiator="vendor",
    )
    browser = sign_in(vendor_account)
    response = browser.patch(
        f"{API}/vendor/booking-requests/{booking_id}/status", json={"status": "declined"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == WITHDRAW_QUOTE_USE_CANCEL


def test_vendor_accepting_own_quote_is_refused(admin_db: LocalDatabase) -> None:
    """A vendor cannot accept their own vendor-initiated quote; the client must accept it."""
    vendor_account = _seed_bookable_vendor(admin_db, "accept-own-vendor")
    client_account = seed_account(admin_db, unique_email("accept-own-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
        initiator="vendor",
    )
    browser = sign_in(vendor_account)
    response = browser.patch(
        f"{API}/vendor/booking-requests/{booking_id}/status", json={"status": "accepted"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == CLIENT_MUST_ACCEPT_QUOTE


def test_vendor_accept_requires_payout_setup(admin_db: LocalDatabase) -> None:
    """A vendor without a Stripe Connect payout route (and no listing override) cannot accept."""
    vendor_account = _seed_unwaived_vendor(admin_db, "payout-gate-vendor")
    client_account = seed_account(admin_db, unique_email("payout-gate-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
    )
    browser = sign_in(vendor_account)
    response = browser.patch(
        f"{API}/vendor/booking-requests/{booking_id}/status", json={"status": "accepted"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == COMPLETE_PAYOUT_SETUP


def test_vendor_accept_requires_client_to_confirm_updated_price(admin_db: LocalDatabase) -> None:
    """A client-initiated booking with a pending vendor price adjustment blocks vendor accept."""
    vendor_account = _seed_bookable_vendor(admin_db, "price-confirm-vendor")
    client_account = seed_account(admin_db, unique_email("price-confirm-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
        initiator="client",
        vendor_adjustments=[
            {"id": "adj-1", "adjustment_category": "other", "label": "Extra", "amount_gbp": 50.0}
        ],
    )
    browser = sign_in(vendor_account)
    response = browser.patch(
        f"{API}/vendor/booking-requests/{booking_id}/status", json={"status": "accepted"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == CLIENT_MUST_CONFIRM_PRICE


def test_vendor_accept_succeeds_when_waived_and_price_confirmed(admin_db: LocalDatabase) -> None:
    """A bookable vendor (payout gate waived) can accept a plain pending client booking."""
    vendor_account = _seed_bookable_vendor(admin_db, "accept-ok-vendor")
    client_account = seed_account(admin_db, unique_email("accept-ok-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
    )
    browser = sign_in(vendor_account)
    response = browser.patch(
        f"{API}/vendor/booking-requests/{booking_id}/status", json={"status": "accepted"}
    )
    assert response.status_code == 200
    assert response.json()["booking_status"] == "accepted"


def test_vendor_decline_only_allowed_while_pending(admin_db: LocalDatabase) -> None:
    """A vendor cannot decline a booking that has already moved past pending."""
    vendor_account = _seed_bookable_vendor(admin_db, "decline-late-vendor")
    client_account = seed_account(admin_db, unique_email("decline-late-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
    )
    browser = sign_in(vendor_account)
    response = browser.patch(
        f"{API}/vendor/booking-requests/{booking_id}/status", json={"status": "declined"}
    )
    assert response.status_code == 400


def test_status_update_owned_by_another_vendor_is_not_found(admin_db: LocalDatabase) -> None:
    """A vendor cannot accept or decline a booking that belongs to another vendor."""
    owner = _seed_bookable_vendor(admin_db, "status-owner-vendor")
    other_vendor = seed_account(admin_db, unique_email("status-other-vendor"), "vendor")
    client_account = seed_account(admin_db, unique_email("status-owner-client"), "client")
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=owner.user_id, status="pending"
    )
    other_browser = sign_in(other_vendor)
    response = other_browser.patch(
        f"{API}/vendor/booking-requests/{booking_id}/status", json={"status": "accepted"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == BOOKING_NOT_FOUND


def test_status_update_requires_sign_in(admin_db: LocalDatabase) -> None:
    """Anonymous status update is rejected."""
    vendor_account = _seed_bookable_vendor(admin_db, "status-anon-vendor")
    client_account = seed_account(admin_db, unique_email("status-anon-client"), "client")
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = new_browser()
    response = browser.patch(
        f"{API}/vendor/booking-requests/{booking_id}/status", json={"status": "accepted"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_put_adjustments_succeeds_on_pending_client_booking(admin_db: LocalDatabase) -> None:
    """Adding a £50 surcharge to a £100 booking gives the confirmed £157.50 total."""
    vendor_account = _seed_bookable_vendor(admin_db, "adjustments-ok-vendor")
    client_account = seed_account(admin_db, unique_email("adjustments-ok-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
        total_label="£100",
    )
    admin_db.table("booking_requests").update(
        {"line_items": [{"id": "pkg-1", "heading": "Classic Package", "unit_price_gbp": 100.0}]}
    ).eq("id", booking_id).execute()
    browser = sign_in(vendor_account)
    response = browser.put(
        f"{API}/vendor/booking-requests/{booking_id}/adjustments",
        json={"adjustments": [{"tag": "other", "label": "Setup fee", "amount_gbp": 50}]},
    )
    assert response.status_code == 200
    pricing = response.json()["booking"]["pricing"]
    assert pricing["vendor_portion_gbp"] == 150.0
    assert pricing["service_fee_gbp"] == 7.5
    assert pricing["client_total_gbp"] == 157.5
    assert pricing["client_total_label"] == "GBP 157.50"


def test_put_adjustments_rejected_on_vendor_initiated_quote(admin_db: LocalDatabase) -> None:
    """Adjustments can only be added to client-initiated bookings, not vendor quotes."""
    vendor_account = _seed_bookable_vendor(admin_db, "adjustments-quote-vendor")
    client_account = seed_account(admin_db, unique_email("adjustments-quote-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
        initiator="vendor",
    )
    browser = sign_in(vendor_account)
    response = browser.put(
        f"{API}/vendor/booking-requests/{booking_id}/adjustments",
        json={"adjustments": [{"tag": "other", "label": "x", "amount_gbp": 10}]},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == ADJUSTMENTS_NOT_ON_VENDOR_QUOTE


def test_put_adjustments_rejected_once_no_longer_pending(admin_db: LocalDatabase) -> None:
    """Adjustments can only be edited while the booking is still pending."""
    vendor_account = _seed_bookable_vendor(admin_db, "adjustments-late-vendor")
    client_account = seed_account(admin_db, unique_email("adjustments-late-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
    )
    browser = sign_in(vendor_account)
    response = browser.put(
        f"{API}/vendor/booking-requests/{booking_id}/adjustments",
        json={"adjustments": [{"tag": "other", "label": "x", "amount_gbp": 10}]},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == ADDITIONAL_COSTS_PENDING_ONLY


def test_put_adjustments_rejects_single_surcharge_over_five_thousand(admin_db: LocalDatabase) -> None:
    """A single surcharge over £5,000 is capped regardless of the booking's subtotal."""
    vendor_account = _seed_bookable_vendor(admin_db, "adjustments-cap-vendor")
    client_account = seed_account(admin_db, unique_email("adjustments-cap-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
    )
    browser = sign_in(vendor_account)
    response = browser.put(
        f"{API}/vendor/booking-requests/{booking_id}/adjustments",
        json={"adjustments": [{"tag": "other", "label": "Big fee", "amount_gbp": 6000}]},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == SURCHARGE_MAX


def test_put_adjustments_rejects_surcharges_over_full_subtotal(admin_db: LocalDatabase) -> None:
    """Total surcharges cannot exceed 100% of the line items' subtotal (£150 here)."""
    vendor_account = _seed_bookable_vendor(admin_db, "adjustments-pct-vendor")
    client_account = seed_account(admin_db, unique_email("adjustments-pct-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
    )
    browser = sign_in(vendor_account)
    response = browser.put(
        f"{API}/vendor/booking-requests/{booking_id}/adjustments",
        json={"adjustments": [{"tag": "other", "label": "Fee", "amount_gbp": 200}]},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == SURCHARGES_PCT


def test_put_adjustments_rejects_discount_that_zeroes_out_total(admin_db: LocalDatabase) -> None:
    """A discount that would reduce the vendor's portion to zero or below is refused."""
    vendor_account = _seed_bookable_vendor(admin_db, "adjustments-discount-vendor")
    client_account = seed_account(admin_db, unique_email("adjustments-discount-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
    )
    browser = sign_in(vendor_account)
    response = browser.put(
        f"{API}/vendor/booking-requests/{booking_id}/adjustments",
        json={"adjustments": [{"tag": "discount", "label": "Discount", "amount_gbp": -150}]},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == DISCOUNTS_TOO_HIGH


def test_put_adjustments_rejects_amount_outside_pydantic_bounds(admin_db: LocalDatabase) -> None:
    """An amount past ±£1,000,000 fails request validation before the service's own cap runs."""
    vendor_account = _seed_bookable_vendor(admin_db, "adjustments-pydbound-vendor")
    client_account = seed_account(admin_db, unique_email("adjustments-pydbound-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
    )
    browser = sign_in(vendor_account)
    response = browser.put(
        f"{API}/vendor/booking-requests/{booking_id}/adjustments",
        json={"adjustments": [{"tag": "other", "label": "x", "amount_gbp": 2_000_000}]},
    )
    assert response.status_code == 422


def test_confirm_completion_requires_paid_booking(admin_db: LocalDatabase) -> None:
    """A vendor cannot confirm completion on an unpaid booking, even once accepted."""
    vendor_account = _seed_bookable_vendor(admin_db, "confirm-unpaid-vendor")
    client_account = seed_account(admin_db, unique_email("confirm-unpaid-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
        payment_status="unpaid",
        event_date="2020-01-01",
    )
    browser = sign_in(vendor_account)
    response = browser.post(f"{API}/vendor/booking-requests/{booking_id}/confirm-completion")
    assert response.status_code == 400


def test_confirm_completion_before_event_day_is_refused(admin_db: LocalDatabase) -> None:
    """A vendor cannot confirm completion before the event's day is over."""
    vendor_account = _seed_bookable_vendor(admin_db, "confirm-early-vendor")
    client_account = seed_account(admin_db, unique_email("confirm-early-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
        payment_status="paid",
        event_date="2099-06-01",
    )
    browser = sign_in(vendor_account)
    response = browser.post(f"{API}/vendor/booking-requests/{booking_id}/confirm-completion")
    assert response.status_code == 400


def test_confirm_completion_first_party_awaits_the_other(admin_db: LocalDatabase) -> None:
    """A vendor confirming first is told the client still needs to confirm."""
    vendor_account = _seed_bookable_vendor(admin_db, "confirm-first-vendor")
    client_account = seed_account(admin_db, unique_email("confirm-first-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
        payment_status="paid",
        event_date="2020-01-01",
    )
    browser = sign_in(vendor_account)
    response = browser.post(f"{API}/vendor/booking-requests/{booking_id}/confirm-completion")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "accepted"
    assert body["payment_status"] == "paid"
    assert body["awaiting_other_party"] is True


def test_confirm_completion_owned_by_another_vendor_is_not_found(admin_db: LocalDatabase) -> None:
    """A vendor cannot confirm completion on a booking belonging to another vendor."""
    owner = _seed_bookable_vendor(admin_db, "confirm-owner-vendor")
    other_vendor = seed_account(admin_db, unique_email("confirm-other-vendor"), "vendor")
    client_account = seed_account(admin_db, unique_email("confirm-owner-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=owner.user_id,
        status="accepted",
        payment_status="paid",
        event_date="2020-01-01",
    )
    other_browser = sign_in(other_vendor)
    response = other_browser.post(f"{API}/vendor/booking-requests/{booking_id}/confirm-completion")
    assert response.status_code == 404
    assert response.json()["detail"] == BOOKING_NOT_FOUND


def test_vendor_accepting_client_booking_notifies_the_client(admin_db: LocalDatabase) -> None:
    """A vendor accepting a client's booking writes a `booking_accepted` notification row."""
    vendor_account = _seed_bookable_vendor(admin_db, "accept-notify-vendor")
    client_account = seed_account(admin_db, unique_email("accept-notify-client"), "client")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
    )
    browser = sign_in(vendor_account)
    response = browser.patch(
        f"{API}/vendor/booking-requests/{booking_id}/status", json={"status": "accepted"}
    )
    assert response.status_code == 200
    notifications = {
        (row["user_id"], row["kind"])
        for row in admin_db.table("booking_notifications")
        .select("user_id, kind")
        .eq("booking_id", booking_id)
        .execute()
        .data
    }
    assert (client_account.user_id, "booking_accepted") in notifications
