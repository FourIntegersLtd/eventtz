"""Freeze: payments-adjacent routes not already covered by the bookings slice.

Covers `/api/v1/vendor/payments/*` (status, payout history; `connect-account` is
guard-only here since a real call always reaches Stripe), the client checkout
routes `/api/v1/client/booking-requests/{id}/checkout` and `.../checkout/sync`
(only the validation that runs before Stripe is ever called - Stripe is off in
this environment), `/api/v1/webhooks/stripe` (signature checks only), and the
admin `/api/v1/admin/bookings*` recovery tools plus `/api/v1/admin/financials*`.

`test_bookings_client.py` and `test_bookings_vendor.py` own the plain booking
lifecycle (create/list/detail/cancel/accept/decline/venue/confirm-completion);
this module does not repeat those.
"""

from __future__ import annotations

import secrets
import uuid
from datetime import date, timedelta

from supabase import Client

from conftest import API, new_browser, sign_in
from support.accounts import SeededAccount, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
VENDOR_PORTAL_FORBIDDEN = (
    "This page is for vendor accounts. If you offer services on Eventtz, create a vendor account or "
    "sign out and sign in again so we can refresh your account type. If you're planning an event, use "
    "client sign-in instead."
)
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
SUPER_ADMIN_ONLY = "Only super admins can perform this action."

BOOKING_NOT_FOUND_PERIOD = "Booking not found."
BOOKING_NOT_FOUND_NO_PERIOD = "Booking not found"
NO_FIELDS_TO_UPDATE = "No fields to update"
ONLY_ACCEPTED_CAN_BE_PAID = "Only accepted bookings can be paid."
BOOKING_ALREADY_PAID = "This booking has already been paid."
VENDOR_PAYOUTS_NOT_READY = "This vendor hasn't finished setting up payouts yet. Try again once they have."
ADD_EVENT_ADDRESS_BEFORE_PAY = (
    "Add your event address on the booking before paying. Your vendor needs it to prepare."
)
BOOKING_NO_LONGER_PAID = "This booking can no longer be paid."
NO_CHECKOUT_SESSION = "No checkout session found for this booking."
ONLY_UNPAID_PENDING_RESET = "Only unpaid or pending checkout bookings can be reset."
ONLY_ACCEPTED_MARK_PAID = "Only accepted bookings can be marked paid."
ONLY_PAID_PAYOUT_RELEASE = "Only paid bookings can have payout released."
ONLY_REFUNDED_COMPLETE_CANCEL = "Only refunded bookings can be completed as cancelled."
ONLY_ACCEPTED_MARK_COMPLETE = "Only accepted bookings can be marked complete."
STRIPE_PI_REQUIRED_FOR_AMOUNT = "stripe_payment_intent_id is required to set payment_amount_gbp."
MISSING_STRIPE_SIGNATURE = "Missing Stripe-Signature header."
INVALID_STRIPE_SIGNATURE = "Invalid signature."

PACKAGE_DETAILS = "A full package covering setup, service and clearup on the day."
MISSING_BOOKING_ID = "00000000-0000-4000-8000-000000000000"


def _seed_bookable_vendor(admin_db: Client, label: str, *, waived: bool = False) -> SeededAccount:
    """A vendor account whose `payload` prices a fixed GBP 150 package.

    `waived=True` sets `listing_override="visible"`, which the visibility helpers treat
    as an admin waiver of the Stripe Connect gate (`payout_gate_waived`), so checkout can
    proceed without a real Stripe Connect account.
    """
    account = seed_account(admin_db, unique_email(label), "vendor")
    row: dict[str, object] = {
        "user_id": account.user_id,
        "status": "complete",
        "approval_status": "approved",
        "payload": {
            "maxBookingsPerDay": "20",
            "packages": [
                {
                    "id": "pkg-1",
                    "title": "Classic Package",
                    "details": PACKAGE_DETAILS,
                    "price": "150",
                    "duration": "4 hours",
                    "pricingMode": "fixed",
                }
            ],
        },
    }
    if waived:
        row["listing_override"] = "visible"
        row["listing_override_reason"] = "acceptance suite: payments freeze"
    admin_db.table("vendors").insert(row).execute()
    return account


def _seed_booking_row(
    admin_db: Client,
    *,
    client_user_id: str,
    vendor_user_id: str,
    status: str = "accepted",
    payment_status: str = "unpaid",
    event_address: str | None = None,
    extra_fields: dict[str, object] | None = None,
) -> str:
    """A `booking_requests` row priced like `_seed_bookable_vendor`'s one package."""
    row: dict[str, object] = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        "event_name": "Acceptance payments test",
        "event_date": "2099-06-01",
        "status": status,
        "payment_status": payment_status,
        "initiator": "client",
        "total_label": "GBP 150",
        "selected_option_ids": ["pkg-1"],
        "line_items": [
            {
                "id": "pkg-1",
                "heading": "Classic Package",
                "unit_price_gbp": 150.0,
                "description": PACKAGE_DETAILS,
            }
        ],
        "vendor_adjustments": [],
    }
    if event_address is not None:
        row["event_address"] = event_address
    if extra_fields:
        row.update(extra_fields)
    inserted = admin_db.table("booking_requests").insert(row).execute().data
    return str(inserted[0]["id"])


# --- vendor/payments ---------------------------------------------------------------


def test_vendor_payments_status_requires_sign_in() -> None:
    """GET /vendor/payments/status requires sign-in."""
    with new_browser() as browser:
        response = browser.get(f"{API}/vendor/payments/status")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_vendor_payments_status_is_forbidden_for_a_client(admin_db: Client) -> None:
    """A client account cannot use the vendor payments routes."""
    account = seed_account(admin_db, unique_email("pay-status-wrong-role"), "client")
    browser = sign_in(account)
    response = browser.get(f"{API}/vendor/payments/status")
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_vendor_payments_status_defaults_for_a_vendor_with_no_profile(admin_db: Client) -> None:
    """A vendor with no `vendors` row yet gets an all-false status, read straight from the database."""
    account = seed_account(admin_db, unique_email("pay-status-fresh"), "vendor")
    browser = sign_in(account)
    response = browser.get(f"{API}/vendor/payments/status")
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "stripe_account_id": None,
        "charges_enabled": False,
        "payouts_enabled": False,
        "can_accept_bookings": False,
        "payout_gate_waived": False,
    }


def test_vendor_payments_status_reflects_an_admin_listing_waiver(admin_db: Client) -> None:
    """A `listing_override="visible"` vendor reads as payout-gate-waived and bookable."""
    vendor_account = _seed_bookable_vendor(admin_db, "pay-status-waived", waived=True)
    browser = sign_in(vendor_account)
    response = browser.get(f"{API}/vendor/payments/status")
    assert response.status_code == 200
    body = response.json()
    assert body["payout_gate_waived"] is True
    assert body["can_accept_bookings"] is True
    assert body["stripe_account_id"] is None


def test_vendor_payments_history_is_empty_for_a_vendor_with_no_paid_bookings(admin_db: Client) -> None:
    """A vendor with no paid or released bookings gets the empty ledger shape."""
    account = seed_account(admin_db, unique_email("pay-history-empty"), "vendor")
    browser = sign_in(account)
    response = browser.get(f"{API}/vendor/payments/history")
    assert response.status_code == 200
    assert response.json() == {
        "success": True,
        "payouts": [],
        "total_paid_out_gbp": 0.0,
        "total_paid_out_label": "GBP 0",
        "total_awaiting_gbp": 0.0,
        "total_awaiting_label": "GBP 0",
    }


def test_vendor_payments_history_splits_paid_out_from_awaiting(admin_db: Client) -> None:
    """`payout_released` bookings count as paid out; plain `paid` bookings as still awaiting."""
    vendor_account = _seed_bookable_vendor(admin_db, "pay-history-split")
    client_account = seed_account(admin_db, unique_email("pay-history-client"), "client")
    released_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="payout_released",
        extra_fields={"vendor_amount_gbp": 150.0, "payout_released_at": "2030-01-01T00:00:00+00:00"},
    )
    awaiting_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
        extra_fields={"vendor_amount_gbp": 150.0},
    )
    browser = sign_in(vendor_account)
    response = browser.get(f"{API}/vendor/payments/history")
    assert response.status_code == 200
    body = response.json()
    assert body["total_paid_out_gbp"] == 150.0
    assert body["total_paid_out_label"] == "GBP 150"
    assert body["total_awaiting_gbp"] == 150.0
    statuses_by_booking = {row["booking_id"]: row["status"] for row in body["payouts"]}
    assert statuses_by_booking[released_id] == "paid_out"
    assert statuses_by_booking[awaiting_id] == "awaiting_payout"


def test_vendor_connect_account_requires_sign_in() -> None:
    """POST /vendor/payments/connect-account requires sign-in (guard-only: Stripe is off)."""
    with new_browser() as browser:
        response = browser.post(f"{API}/vendor/payments/connect-account")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


# --- client checkout (pre-Stripe validation only) -----------------------------------


def test_checkout_requires_sign_in() -> None:
    """POST .../checkout requires sign-in."""
    with new_browser() as browser:
        response = browser.post(f"{API}/client/booking-requests/{MISSING_BOOKING_ID}/checkout")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_checkout_unknown_booking_is_a_400_not_a_404(admin_db: Client) -> None:
    """BASELINE QUIRK: unlike the read routes, checkout maps 'not found' to 400, not 404.

    `create_checkout_session_for_booking` raises a plain `ValueError`, and
    `_run_checkout_handler` maps every `ValueError` to 400 regardless of cause.
    """
    account = seed_account(admin_db, unique_email("checkout-missing"), "client")
    browser = sign_in(account)
    response = browser.post(f"{API}/client/booking-requests/{MISSING_BOOKING_ID}/checkout")
    assert response.status_code == 400
    assert response.json()["detail"] == BOOKING_NOT_FOUND_PERIOD


def test_checkout_rejects_a_pending_booking(admin_db: Client) -> None:
    """Only an accepted booking can be paid; a pending one is refused before any Stripe call."""
    client_account = seed_account(admin_db, unique_email("checkout-pending-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "checkout-pending-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="pending"
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/checkout")
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_ACCEPTED_CAN_BE_PAID


def test_checkout_rejects_an_already_paid_booking(admin_db: Client) -> None:
    """A booking already paid cannot be checked out again."""
    client_account = seed_account(admin_db, unique_email("checkout-paid-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "checkout-paid-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_user_id,
        status="accepted",
        payment_status="paid",
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/checkout")
    assert response.status_code == 400
    assert response.json()["detail"] == BOOKING_ALREADY_PAID


def test_checkout_rejects_a_vendor_not_ready_for_payouts(admin_db: Client) -> None:
    """A vendor with no Stripe Connect account and no admin waiver blocks checkout."""
    client_account = seed_account(admin_db, unique_email("checkout-notready-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "checkout-notready-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_user_id,
        event_address="1 Test Rd",
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/checkout")
    assert response.status_code == 400
    assert response.json()["detail"] == VENDOR_PAYOUTS_NOT_READY


def test_checkout_requires_an_event_address_even_for_a_waived_vendor(admin_db: Client) -> None:
    """With the payout gate waived, the next check reached is the event address, still before Stripe."""
    client_account = seed_account(admin_db, unique_email("checkout-noaddr-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "checkout-noaddr-vendor", waived=True).user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/checkout")
    assert response.status_code == 400
    assert response.json()["detail"] == ADD_EVENT_ADDRESS_BEFORE_PAY


def test_checkout_sync_requires_sign_in() -> None:
    """POST .../checkout/sync requires sign-in."""
    with new_browser() as browser:
        response = browser.post(f"{API}/client/booking-requests/{MISSING_BOOKING_ID}/checkout/sync", json={})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_checkout_sync_unknown_booking_is_a_400_not_a_404(admin_db: Client) -> None:
    """Same `ValueError`-to-400 mapping as `/checkout` applies to `/checkout/sync`."""
    account = seed_account(admin_db, unique_email("checkout-sync-missing"), "client")
    browser = sign_in(account)
    response = browser.post(f"{API}/client/booking-requests/{MISSING_BOOKING_ID}/checkout/sync", json={})
    assert response.status_code == 400
    assert response.json()["detail"] == BOOKING_NOT_FOUND_PERIOD


def test_checkout_sync_rejects_a_booking_that_is_not_accepted(admin_db: Client) -> None:
    """A pending booking cannot be synced: it was never eligible for checkout."""
    client_account = seed_account(admin_db, unique_email("checkout-sync-pending-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "checkout-sync-pending-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="pending"
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/checkout/sync", json={})
    assert response.status_code == 400
    assert response.json()["detail"] == BOOKING_NO_LONGER_PAID


def test_checkout_sync_already_paid_booking_short_circuits_without_calling_stripe(admin_db: Client) -> None:
    """A booking already `paid` returns its current status directly - no Stripe call needed."""
    client_account = seed_account(admin_db, unique_email("checkout-sync-paid-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "checkout-sync-paid-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_user_id,
        status="accepted",
        payment_status="paid",
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/checkout/sync", json={})
    assert response.status_code == 200
    assert response.json() == {"success": True, "payment_status": "paid"}


def test_checkout_sync_with_no_session_on_file_reports_the_expected_error(admin_db: Client) -> None:
    """An accepted, unpaid booking with no stored or supplied checkout session cannot be synced."""
    client_account = seed_account(admin_db, unique_email("checkout-sync-nosession-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "checkout-sync-nosession-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="accepted"
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/checkout/sync", json={})
    assert response.status_code == 400
    assert response.json()["detail"] == NO_CHECKOUT_SESSION


# --- webhooks/stripe -----------------------------------------------------------------


def test_stripe_webhook_without_a_signature_header_is_rejected() -> None:
    """No `Stripe-Signature` header at all is a 400 before any verification is attempted."""
    with new_browser() as browser:
        response = browser.post(f"{API}/webhooks/stripe", content=b"{}")
    assert response.status_code == 400
    assert response.json()["detail"] == MISSING_STRIPE_SIGNATURE


def test_stripe_webhook_with_a_bogus_signature_header_is_rejected() -> None:
    """A present but invalid signature fails HMAC verification even with Stripe unconfigured.

    Signature verification is a pure HMAC check against `STRIPE_WEBHOOK_SECRET` and does not
    require a live Stripe connection, so this is testable with Stripe fully off.
    """
    with new_browser() as browser:
        response = browser.post(
            f"{API}/webhooks/stripe",
            content=b'{"type": "checkout.session.completed"}',
            headers={"Stripe-Signature": "t=1,v1=not-a-real-signature"},
        )
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_STRIPE_SIGNATURE


# --- admin/bookings recovery -----------------------------------------------------------


def test_admin_list_bookings_requires_sign_in() -> None:
    """GET /admin/bookings requires sign-in."""
    with new_browser() as browser:
        response = browser.get(f"{API}/admin/bookings")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_admin_list_bookings_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account cannot list bookings from the admin console."""
    account = seed_account(admin_db, unique_email("admin-list-wrong-role"), "vendor")
    browser = sign_in(account)
    response = browser.get(f"{API}/admin/bookings")
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_admin_list_bookings_filters_by_status_and_search(admin_db: Client, as_staff) -> None:
    """`status` and `search` (event name substring) both narrow the admin booking list."""
    label = uuid.uuid4().hex[:8]
    client_account = seed_account(admin_db, unique_email("admin-list-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-list-vendor").user_id
    matching_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_user_id,
        status="pending",
        extra_fields={"event_name": f"admin-list-match-{label}"},
    )
    _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_user_id,
        status="accepted",
        extra_fields={"event_name": f"admin-list-other-{label}"},
    )
    response = as_staff.get(
        f"{API}/admin/bookings", params={"status": "pending", "search": f"admin-list-match-{label}"}
    )
    assert response.status_code == 200
    body = response.json()
    ids = {row["id"] for row in body["bookings"]}
    assert ids == {matching_id}
    assert body["total"] == 1


def test_admin_get_booking_detail_not_found_for_missing_id(as_staff) -> None:
    """A booking id that does not exist is a 404 (unlike the recovery-tool routes below)."""
    response = as_staff.get(f"{API}/admin/bookings/{MISSING_BOOKING_ID}")
    assert response.status_code == 404
    assert response.json()["detail"] == BOOKING_NOT_FOUND_NO_PERIOD


def test_admin_get_booking_detail_writes_a_view_audit_log_row(admin_db: Client, as_staff) -> None:
    """Viewing a booking's admin detail writes a `booking.view` audit log row."""
    client_account = seed_account(admin_db, unique_email("admin-view-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-view-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="pending"
    )
    response = as_staff.get(f"{API}/admin/bookings/{booking_id}")
    assert response.status_code == 200
    assert response.json()["booking"]["id"] == booking_id
    audit_rows = (
        admin_db.table("admin_audit_log")
        .select("action")
        .eq("action", "booking.view")
        .eq("entity_id", booking_id)
        .execute()
        .data
    )
    assert audit_rows


def test_admin_patch_payment_fields_requires_super_admin(admin_db: Client, as_staff) -> None:
    """A plain admin cannot patch a booking's Stripe/payment fields; only a super admin can."""
    client_account = seed_account(admin_db, unique_email("admin-patch-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-patch-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    response = as_staff.patch(
        f"{API}/admin/bookings/{booking_id}/payment-fields", json={"stripe_charge_id": "ch_x"}
    )
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_admin_patch_payment_fields_with_no_body_fields_is_400(admin_db: Client, as_super_admin) -> None:
    """An empty patch body is rejected before touching the booking."""
    client_account = seed_account(admin_db, unique_email("admin-patch-empty-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-patch-empty-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    response = as_super_admin.patch(f"{API}/admin/bookings/{booking_id}/payment-fields", json={})
    assert response.status_code == 400
    assert response.json()["detail"] == NO_FIELDS_TO_UPDATE


def test_admin_patch_payment_fields_amount_without_a_payment_intent_is_400(
    admin_db: Client, as_super_admin
) -> None:
    """Setting `payment_amount_gbp` needs a Stripe payment intent to verify it against."""
    client_account = seed_account(admin_db, unique_email("admin-patch-noamt-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-patch-noamt-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    response = as_super_admin.patch(
        f"{API}/admin/bookings/{booking_id}/payment-fields", json={"payment_amount_gbp": 10.0}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == STRIPE_PI_REQUIRED_FOR_AMOUNT


def test_admin_sync_payment_requires_super_admin(admin_db: Client, as_staff) -> None:
    """A plain admin cannot trigger a Stripe payment sync."""
    client_account = seed_account(admin_db, unique_email("admin-sync-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-sync-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    response = as_staff.post(f"{API}/admin/bookings/{booking_id}/sync-payment")
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_admin_sync_payment_rejects_a_booking_that_is_not_accepted(admin_db: Client, as_super_admin) -> None:
    """A pending booking cannot be synced for payment."""
    client_account = seed_account(admin_db, unique_email("admin-sync-pending-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-sync-pending-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="pending"
    )
    response = as_super_admin.post(f"{API}/admin/bookings/{booking_id}/sync-payment")
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_ACCEPTED_MARK_PAID


def test_admin_sync_payment_missing_booking_is_a_400_not_a_404(as_super_admin) -> None:
    """BASELINE QUIRK: the recovery-tool routes map a missing booking to 400, not 404,

    unlike `GET /admin/bookings/{id}` above - `_load_booking_row` raises a plain
    `ValueError`, and every recovery route maps `ValueError` to 400.
    """
    response = as_super_admin.post(f"{API}/admin/bookings/{MISSING_BOOKING_ID}/sync-payment")
    assert response.status_code == 400
    assert response.json()["detail"] == BOOKING_NOT_FOUND_PERIOD


def test_admin_release_payout_requires_super_admin(admin_db: Client, as_staff) -> None:
    """A plain admin cannot release a vendor payout."""
    client_account = seed_account(admin_db, unique_email("admin-release-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-release-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    response = as_staff.post(f"{API}/admin/bookings/{booking_id}/release-payout")
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_admin_release_payout_rejects_an_unpaid_booking(admin_db: Client, as_super_admin) -> None:
    """Only a paid booking is eligible for payout release."""
    client_account = seed_account(admin_db, unique_email("admin-release-unpaid-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-release-unpaid-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="accepted"
    )
    response = as_super_admin.post(f"{API}/admin/bookings/{booking_id}/release-payout")
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_PAID_PAYOUT_RELEASE


def test_admin_retry_payout_shares_the_same_eligibility_rule_as_release(
    admin_db: Client, as_super_admin
) -> None:
    """`retry-payout` is the same underlying command as `release-payout`, so the same guard applies."""
    client_account = seed_account(admin_db, unique_email("admin-retry-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-retry-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="accepted"
    )
    response = as_super_admin.post(f"{API}/admin/bookings/{booking_id}/retry-payout")
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_PAID_PAYOUT_RELEASE


def test_admin_reset_checkout_requires_super_admin(admin_db: Client, as_staff) -> None:
    """A plain admin cannot reset a booking's stale checkout session."""
    client_account = seed_account(admin_db, unique_email("admin-reset-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-reset-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    response = as_staff.post(f"{API}/admin/bookings/{booking_id}/reset-checkout")
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_admin_reset_checkout_rejects_an_already_paid_booking(admin_db: Client, as_super_admin) -> None:
    """A paid booking's checkout session cannot be reset."""
    client_account = seed_account(admin_db, unique_email("admin-reset-paid-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-reset-paid-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_user_id,
        status="accepted",
        payment_status="paid",
    )
    response = as_super_admin.post(f"{API}/admin/bookings/{booking_id}/reset-checkout")
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_UNPAID_PENDING_RESET


def test_admin_reset_checkout_clears_a_stale_session_and_returns_to_unpaid(
    admin_db: Client, as_super_admin
) -> None:
    """A pending checkout session is cleared and `payment_status` returns to unpaid."""
    client_account = seed_account(admin_db, unique_email("admin-reset-ok-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-reset-ok-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_user_id,
        status="accepted",
        payment_status="pending",
        extra_fields={"stripe_checkout_session_id": "cs_test_acceptance"},
    )
    response = as_super_admin.post(f"{API}/admin/bookings/{booking_id}/reset-checkout")
    assert response.status_code == 200
    booking = response.json()["booking"]
    assert booking["payment_status"] == "unpaid"
    assert booking["stripe_checkout_session_id"] is None


def test_admin_complete_cancellation_requires_super_admin(admin_db: Client, as_staff) -> None:
    """A plain admin cannot complete a booking's cancellation."""
    client_account = seed_account(admin_db, unique_email("admin-complete-cancel-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-complete-cancel-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    response = as_staff.post(f"{API}/admin/bookings/{booking_id}/complete-cancellation")
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_admin_complete_cancellation_requires_a_refunded_payment_status(
    admin_db: Client, as_super_admin
) -> None:
    """Only a refunded booking can be completed as cancelled."""
    client_account = seed_account(admin_db, unique_email("admin-complete-cancel-unpaid-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-complete-cancel-unpaid-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="accepted"
    )
    response = as_super_admin.post(f"{API}/admin/bookings/{booking_id}/complete-cancellation")
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_REFUNDED_COMPLETE_CANCEL


def test_admin_cancel_on_behalf_requires_super_admin(admin_db: Client, as_staff) -> None:
    """A plain admin cannot cancel a booking on a party's behalf."""
    client_account = seed_account(admin_db, unique_email("admin-cancel-behalf-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-cancel-behalf-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="pending"
    )
    response = as_staff.post(
        f"{API}/admin/bookings/{booking_id}/cancel-on-behalf",
        json={"party": "client", "reason": "test reason"},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_admin_cancel_on_behalf_requires_a_reason_of_at_least_3_characters(
    admin_db: Client, as_super_admin
) -> None:
    """`reason` has its own min-length validation, rejected as a 422 before the service runs."""
    client_account = seed_account(admin_db, unique_email("admin-cancel-behalf-short-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-cancel-behalf-short-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="pending"
    )
    response = as_super_admin.post(
        f"{API}/admin/bookings/{booking_id}/cancel-on-behalf", json={"party": "client", "reason": "ab"}
    )
    assert response.status_code == 422


def test_admin_cancel_on_behalf_cancels_a_pending_unpaid_booking_and_logs_the_reason(
    admin_db: Client, as_super_admin
) -> None:
    """A super admin can cancel a pending, unpaid booking on behalf of a party, with an audit trail."""
    client_account = seed_account(admin_db, unique_email("admin-cancel-behalf-ok-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-cancel-behalf-ok-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="pending"
    )
    response = as_super_admin.post(
        f"{API}/admin/bookings/{booking_id}/cancel-on-behalf",
        json={"party": "vendor", "reason": "vendor asked support to cancel"},
    )
    assert response.status_code == 200
    assert response.json()["booking"]["status"] == "cancelled"

    audit_rows = (
        admin_db.table("admin_audit_log")
        .select("payload")
        .eq("action", "booking.cancel_on_behalf")
        .eq("entity_id", booking_id)
        .execute()
        .data
    )
    assert audit_rows
    assert audit_rows[-1]["payload"] == {"party": "vendor", "reason": "vendor asked support to cancel"}


def test_admin_confirm_completion_requires_super_admin(admin_db: Client, as_staff) -> None:
    """A plain admin cannot confirm completion on a party's behalf."""
    client_account = seed_account(admin_db, unique_email("admin-confirm-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-confirm-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    response = as_staff.post(
        f"{API}/admin/bookings/{booking_id}/confirm-completion", json={"party": "client"}
    )
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_admin_confirm_completion_rejects_a_booking_that_is_not_accepted(
    admin_db: Client, as_super_admin
) -> None:
    """Only an accepted booking can have completion confirmed on a party's behalf."""
    client_account = seed_account(admin_db, unique_email("admin-confirm-pending-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-confirm-pending-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id, status="pending"
    )
    response = as_super_admin.post(
        f"{API}/admin/bookings/{booking_id}/confirm-completion", json={"party": "client"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_ACCEPTED_MARK_COMPLETE


def test_admin_run_maintenance_requires_super_admin(admin_db: Client, as_staff) -> None:
    """A plain admin cannot trigger the maintenance sweep for one booking."""
    client_account = seed_account(admin_db, unique_email("admin-maint-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-maint-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    response = as_staff.post(f"{API}/admin/bookings/{booking_id}/run-maintenance")
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_admin_run_maintenance_on_a_missing_booking_is_a_400(as_super_admin) -> None:
    """The maintenance sweep also maps a missing booking to 400, like the other recovery routes."""
    response = as_super_admin.post(f"{API}/admin/bookings/{MISSING_BOOKING_ID}/run-maintenance")
    assert response.status_code == 400
    assert response.json()["detail"] == BOOKING_NOT_FOUND_PERIOD


def test_admin_support_hold_requires_super_admin(admin_db: Client, as_staff) -> None:
    """A plain admin cannot toggle a booking's support hold."""
    client_account = seed_account(admin_db, unique_email("admin-hold-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-hold-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    response = as_staff.patch(f"{API}/admin/bookings/{booking_id}/support-hold", json={"hold": True})
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_admin_support_hold_toggles_and_persists(admin_db: Client, as_super_admin) -> None:
    """Setting the support hold on then off persists both states."""
    client_account = seed_account(admin_db, unique_email("admin-hold-ok-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-hold-ok-vendor").user_id
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_user_id
    )
    held = as_super_admin.patch(f"{API}/admin/bookings/{booking_id}/support-hold", json={"hold": True})
    assert held.status_code == 200
    assert held.json()["booking"]["support"]["support_hold"] is True

    released = as_super_admin.patch(f"{API}/admin/bookings/{booking_id}/support-hold", json={"hold": False})
    assert released.status_code == 200
    assert released.json()["booking"]["support"]["support_hold"] is False


# --- admin/financials -----------------------------------------------------------------


def test_admin_financials_summary_requires_sign_in() -> None:
    """GET /admin/financials/summary requires sign-in."""
    with new_browser() as browser:
        response = browser.get(f"{API}/admin/financials/summary")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_admin_financials_summary_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account cannot see platform financials."""
    account = seed_account(admin_db, unique_email("admin-fin-wrong-role"), "vendor")
    browser = sign_in(account)
    response = browser.get(f"{API}/admin/financials/summary")
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_admin_financials_summary_totals_a_paid_booking(admin_db: Client, as_staff) -> None:
    """GMV, platform fee, and vendor portion are summed from paid/released bookings in the date range.

    Scoped to a `paid_at` on a randomly chosen far-future day, and a date range tight around
    just that day, so repeated runs of this suite (which never delete their seeded rows) never
    accumulate onto the same day and inflate the count.
    """
    paid_day = date(2031, 1, 1) + timedelta(days=secrets.randbelow(3650))
    client_account = seed_account(admin_db, unique_email("admin-fin-client"), "client")
    vendor_user_id = _seed_bookable_vendor(admin_db, "admin-fin-vendor").user_id
    _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_user_id,
        status="accepted",
        payment_status="paid",
        extra_fields={
            "payment_amount_gbp": 157.5,
            "vendor_amount_gbp": 150.0,
            "platform_fee_gbp": 7.5,
            "paid_at": f"{paid_day.isoformat()}T12:00:00+00:00",
        },
    )
    response = as_staff.get(
        f"{API}/admin/financials/summary",
        params={"date_from": paid_day.isoformat(), "date_to": (paid_day + timedelta(days=1)).isoformat()},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["paid_booking_count"] == 1
    assert body["gmv_gbp"] == 157.5
    assert body["platform_fee_gbp"] == 7.5
    assert body["vendor_portion_gbp"] == 150.0
    assert body["held_in_platform_balance_gbp"] == 150.0
    assert body["payout_released_gbp"] == 0.0


def test_admin_financials_export_requires_super_admin(admin_db: Client, as_staff) -> None:
    """A plain admin cannot export the financials CSV; only a super admin can."""
    response = as_staff.get(f"{API}/admin/financials/export.csv")
    assert response.status_code == 403
    assert response.json()["detail"] == SUPER_ADMIN_ONLY


def test_admin_financials_export_returns_a_csv_attachment_and_logs_the_export(
    admin_db: Client, as_super_admin
) -> None:
    """The export is a CSV attachment with the frozen column headers, and writes an audit log row."""
    response = as_super_admin.get(
        f"{API}/admin/financials/export.csv", params={"date_from": "2030-01-01", "date_to": "2030-01-02"}
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv; charset=utf-8"
    assert response.headers["content-disposition"] == 'attachment; filename="eventtz-financials.csv"'
    header_line = response.text.splitlines()[0]
    assert header_line == (
        "booking_id,status,payment_status,event_name,paid_at,client_total_gbp,vendor_portion_gbp,"
        "service_fee_gbp,payment_amount_gbp,payout_released_at"
    )

    audit_rows = (
        admin_db.table("admin_audit_log")
        .select("action")
        .eq("action", "financials.export_csv")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    assert audit_rows
