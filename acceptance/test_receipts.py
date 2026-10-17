"""Freeze: client receipts, vendor payment records, payout statements, restore-Connect.

Local Stripe is off, so the happy paths never call it. The client receipt is a
frozen `payment_receipt_snapshot` (returned as stored, with the live
`payment_status` laid over it). Vendor documents are built from the booking
row. Restore-Connect stops at "Stripe is not configured." before any transfer
lookup or vendor-row write.
"""

from __future__ import annotations

import uuid

import httpx
from support.database import LocalDatabase

from conftest import API, new_browser, sign_in
from support.accounts import SeededAccount, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. "
    "Sign in with a client account, or create one from the homepage."
)
VENDOR_PORTAL_FORBIDDEN = (
    "This page is for vendor accounts. If you offer services on Eventtz, create a vendor account or "
    "sign out and sign in again so we can refresh your account type. If you're planning an event, use "
    "client sign-in instead."
)
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
SUPER_ADMIN_ONLY = "Only super admins can perform this action."

BOOKING_NOT_FOUND = "Booking not found."
RECEIPT_NOT_AVAILABLE = "No receipt is available for this booking yet."
RECEIPT_STRIPE_VERIFY_FAILED = "Unable to verify payment with Stripe. Please try again later."
STRIPE_NOT_CONFIGURED = "Stripe is not configured."

MISSING_BOOKING_ID = "00000000-0000-4000-8000-000000000000"
PACKAGE_DETAILS = "A full package covering setup, service and clearup on the day."
VENDOR_BUSINESS_NAME = "Harbour Catering"
CLIENT_PREFERRED_NAME = "Jordan Client"
EVENT_NAME = "Acceptance receipt wedding"
EVENT_DATE = "2099-06-01"
PAID_AT = "2030-06-01T12:00:00+00:00"
PAYOUT_RELEASED_AT = "2030-06-15T09:00:00+00:00"

# Frozen client receipt: these strings are stored and returned as-is.
FROZEN_RECEIPT_NUMBER = "EVT-RCPT0601"
FROZEN_TOTAL_LABEL = "GBP 157.50"
FROZEN_SUBTOTAL_LABEL = "GBP 150"
FROZEN_SERVICE_FEE_LABEL = "GBP 7.50"

# Vendor documents read vendor_amount_gbp / platform_fee_gbp off the row.
VENDOR_SHARE_GBP = 142.5
VENDOR_SHARE_LABEL = "GBP 142.50"
PLATFORM_FEE_GBP = 7.5
PLATFORM_FEE_LABEL = "GBP 7.50"
LINE_ITEM_LABEL = "GBP 150"
HELD_UNTIL_RELEASE_NOTE = (
    "Client payment received. Your share is held safely with Eventtz until the event "
    "is complete and both sides confirm, or until the automatic release date passes."
)
PAYOUT_SENT_NOTE = "Payout sent to your connected Stripe account. Bank arrival times depend on your bank."
FROZEN_STRIPE_ACCOUNT_ID = "acct_acceptancefrozen01"
CHARGE_ID = "ch_acceptancecharge12345678"
TRANSFER_ID = "tr_acceptance87654321"
PAYMENT_REFERENCE = "…12345678"
TRANSFER_REFERENCE = "…87654321"
REFUNDED_IN_FULL_NOTE = "This payment was refunded in full."
PARTIALLY_REFUNDED_NOTE = "This payment was partially refunded."


def _assert_error(response: httpx.Response, status: int, detail: str, api_code: str) -> None:
    """Status and exact detail. The baseline omits `code`; api/ sends one (ADR 0004)."""
    assert response.status_code == status
    body = response.json()
    assert body["detail"] == detail
    assert body["code"] == api_code


def _receipt_number(booking_id: str) -> str:
    """The baseline receipt number: `EVT-` plus the first eight hex characters of the id."""
    raw = booking_id.replace("-", "").upper()
    return f"EVT-{raw[:8]}"


def _seed_bookable_vendor(
    admin_db: LocalDatabase, label: str, *, stripe_account_id: str | None = None
) -> SeededAccount:
    """A vendor whose payload prices a fixed GBP 150 package.

    `businessName` is unique per row: the vendors table rejects a repeated normalised name.
    Client-receipt HTML asserts the name stored on the frozen snapshot, not this payload.
    """
    account = seed_account(admin_db, unique_email(label), "vendor")
    row: dict[str, object] = {
        "user_id": account.user_id,
        "status": "complete",
        "approval_status": "approved",
        "payload": {
            "businessName": f"Harbour Catering {uuid.uuid4().hex[:8]}",
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
    if stripe_account_id is not None:
        row["stripe_account_id"] = stripe_account_id
    admin_db.table("vendors").insert(row).execute()
    return account


def _seed_named_client(admin_db: LocalDatabase, label: str) -> SeededAccount:
    """A client with a stable display name, so vendor documents can assert it literally."""
    account = seed_account(admin_db, unique_email(label), "client")
    admin_db.table("users").update({"preferred_name": CLIENT_PREFERRED_NAME}).eq(
        "id", account.user_id
    ).execute()
    return account


def _seed_booking_row(
    admin_db: LocalDatabase,
    *,
    client_user_id: str,
    vendor_user_id: str,
    payment_status: str = "unpaid",
    extra_fields: dict[str, object] | None = None,
) -> str:
    """A `booking_requests` row priced like `_seed_bookable_vendor`'s one package."""
    row: dict[str, object] = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        "event_name": EVENT_NAME,
        "event_date": EVENT_DATE,
        "status": "accepted",
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
    if extra_fields:
        row.update(extra_fields)
    inserted = admin_db.table("booking_requests").insert(row).execute().data
    return str(inserted[0]["id"])


def _frozen_client_receipt(booking_id: str) -> dict[str, object]:
    """A snapshot shaped like `build_client_payment_receipt`, stored so the read skips Stripe."""
    return {
        "document_type": "client_payment_receipt",
        "receipt_number": FROZEN_RECEIPT_NUMBER,
        "booking_request_id": booking_id,
        "event_name": EVENT_NAME,
        "event_date": EVENT_DATE,
        "payment_status": "paid",
        "paid_at": PAID_AT,
        "payout_released_at": None,
        "counterparty_name": VENDOR_BUSINESS_NAME,
        "line_items": [{"label": "Classic Package", "amount_label": LINE_ITEM_LABEL}],
        "subtotal_label": FROZEN_SUBTOTAL_LABEL,
        "service_fee_label": FROZEN_SERVICE_FEE_LABEL,
        "service_fee_percent": 5.0,
        "total_label": FROZEN_TOTAL_LABEL,
        "vendor_share_label": None,
        "platform_fee_label": None,
        "payment_reference": PAYMENT_REFERENCE,
        "transfer_reference": None,
        "stripe_receipt_url": None,
        "status_note": None,
        "stripe_payment_intent_id": None,
        "payment_amount_gbp": 157.5,
    }


def _vendor_money_fields() -> dict[str, object]:
    """Amounts the vendor documents format into the labels asserted below."""
    return {
        "paid_at": PAID_AT,
        "vendor_amount_gbp": VENDOR_SHARE_GBP,
        "platform_fee_gbp": PLATFORM_FEE_GBP,
        "stripe_charge_id": CHARGE_ID,
    }


def _stripe_account_id(admin_db: LocalDatabase, vendor_user_id: str) -> str | None:
    """The Connect account id currently stored on the vendor row."""
    rows = admin_db.table("vendors").select("stripe_account_id").eq("user_id", vendor_user_id).execute().data
    return rows[0]["stripe_account_id"]


def _receipt_url(booking_id: str) -> str:
    """Client receipt JSON path for a booking."""
    return f"{API}/client/booking-requests/{booking_id}/receipt"


def _payment_record_url(booking_id: str) -> str:
    """Vendor payment record JSON path for a booking."""
    return f"{API}/vendor/booking-requests/{booking_id}/payment-record"


def _payout_statement_url(booking_id: str) -> str:
    """Vendor payout statement JSON path for a booking."""
    return f"{API}/vendor/booking-requests/{booking_id}/payout-statement"


def _restore_url(vendor_user_id: str) -> str:
    """Super-admin restore-Connect path for a vendor."""
    return f"{API}/admin/vendors/{vendor_user_id}/restore-stripe-connect"


# --- client receipt ----------------------------------------------------------------


def test_client_receipt_requires_sign_in() -> None:
    """GET .../receipt requires a session."""
    with new_browser() as browser:
        response = browser.get(_receipt_url(MISSING_BOOKING_ID))
    _assert_error(response, 401, SIGN_IN_REQUIRED, "unauthenticated")


def test_client_receipt_is_forbidden_for_a_vendor(admin_db: LocalDatabase) -> None:
    """A vendor account cannot read a client receipt."""
    vendor_account = _seed_bookable_vendor(admin_db, "rcpt-vendor-role")
    browser = sign_in(vendor_account)
    response = browser.get(_receipt_url(MISSING_BOOKING_ID))
    _assert_error(response, 403, CLIENT_PORTAL_FORBIDDEN, "wrong_portal")


def test_client_receipt_for_another_clients_booking_is_not_found(admin_db: LocalDatabase) -> None:
    """A client who does not own the booking gets the same 404 as a missing id."""
    owner = _seed_named_client(admin_db, "rcpt-owner")
    other = _seed_named_client(admin_db, "rcpt-other")
    vendor_account = _seed_bookable_vendor(admin_db, "rcpt-other-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=owner.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
    )
    browser = sign_in(other)
    response = browser.get(_receipt_url(booking_id))
    _assert_error(response, 404, BOOKING_NOT_FOUND, "booking_not_found")


def test_client_receipt_for_an_unknown_booking_is_not_found(admin_db: LocalDatabase) -> None:
    """An id that is not a booking is 404, not an empty receipt."""
    client_account = _seed_named_client(admin_db, "rcpt-missing")
    browser = sign_in(client_account)
    response = browser.get(_receipt_url(str(uuid.uuid4())))
    _assert_error(response, 404, BOOKING_NOT_FOUND, "booking_not_found")


def test_client_receipt_for_an_unpaid_booking_without_a_payment_intent_is_not_found(admin_db: LocalDatabase) -> None:
    """No frozen snapshot and no `pi_` id fails Stripe verification before the eligibility check.

    `verify_client_receipt_with_stripe` raises when the intent id is missing and the
    snapshot is not a frozen client receipt, so the message is the verify failure,
    not "No receipt is available for this booking yet."
    """
    client_account = _seed_named_client(admin_db, "rcpt-unpaid")
    vendor_account = _seed_bookable_vendor(admin_db, "rcpt-unpaid-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="unpaid",
    )
    browser = sign_in(client_account)
    response = browser.get(_receipt_url(booking_id))
    _assert_error(response, 404, RECEIPT_STRIPE_VERIFY_FAILED, "receipt_stripe_verify_failed")


def test_client_receipt_returns_the_frozen_snapshot(admin_db: LocalDatabase) -> None:
    """A paid booking with a frozen snapshot is returned as stored, with the live status overlaid."""
    client_account = _seed_named_client(admin_db, "rcpt-happy")
    vendor_account = _seed_bookable_vendor(admin_db, "rcpt-happy-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
    )
    admin_db.table("booking_requests").update(
        {"payment_receipt_snapshot": _frozen_client_receipt(booking_id)}
    ).eq("id", booking_id).execute()
    browser = sign_in(client_account)
    response = browser.get(_receipt_url(booking_id))
    assert response.status_code == 200
    receipt = response.json()["receipt"]
    assert receipt["document_type"] == "client_payment_receipt"
    assert receipt["receipt_number"] == FROZEN_RECEIPT_NUMBER
    assert receipt["booking_request_id"] == booking_id
    assert receipt["event_name"] == EVENT_NAME
    assert receipt["event_date"] == EVENT_DATE
    assert receipt["payment_status"] == "paid"
    assert receipt["paid_at"] == PAID_AT
    assert receipt["payout_released_at"] is None
    assert receipt["counterparty_name"] == VENDOR_BUSINESS_NAME
    assert receipt["total_label"] == FROZEN_TOTAL_LABEL
    assert receipt["subtotal_label"] == FROZEN_SUBTOTAL_LABEL
    assert receipt["service_fee_label"] == FROZEN_SERVICE_FEE_LABEL
    assert receipt["service_fee_percent"] == 5.0
    assert receipt["line_items"] == [{"label": "Classic Package", "amount_label": LINE_ITEM_LABEL}]
    assert receipt["payment_reference"] == PAYMENT_REFERENCE
    assert receipt["status_note"] is None


def test_client_receipt_html_is_an_attachment(admin_db: LocalDatabase) -> None:
    """The HTML download names the receipt and includes the number and vendor."""
    client_account = _seed_named_client(admin_db, "rcpt-html")
    vendor_account = _seed_bookable_vendor(admin_db, "rcpt-html-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
    )
    admin_db.table("booking_requests").update(
        {"payment_receipt_snapshot": _frozen_client_receipt(booking_id)}
    ).eq("id", booking_id).execute()
    browser = sign_in(client_account)
    response = browser.get(f"{_receipt_url(booking_id)}.html")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert response.headers["content-disposition"] == (
        f'attachment; filename="receipt-{FROZEN_RECEIPT_NUMBER}.html"'
    )
    assert FROZEN_RECEIPT_NUMBER in response.text
    assert VENDOR_BUSINESS_NAME in response.text


# --- vendor payment record ----------------------------------------------------------


def test_vendor_payment_record_is_forbidden_for_a_client(admin_db: LocalDatabase) -> None:
    """A client cannot read the vendor payment record, even for their own booking."""
    client_account = _seed_named_client(admin_db, "prec-client-role")
    vendor_account = _seed_bookable_vendor(admin_db, "prec-client-role-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
    )
    browser = sign_in(client_account)
    response = browser.get(_payment_record_url(booking_id))
    _assert_error(response, 403, VENDOR_PORTAL_FORBIDDEN, "wrong_portal")


def test_vendor_payment_record_for_another_vendors_booking_is_not_found(admin_db: LocalDatabase) -> None:
    """A vendor who is not on the booking gets 404."""
    client_account = _seed_named_client(admin_db, "prec-other-client")
    owner = _seed_bookable_vendor(admin_db, "prec-owner")
    stranger = _seed_bookable_vendor(admin_db, "prec-stranger")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=owner.user_id,
        payment_status="paid",
    )
    browser = sign_in(stranger)
    response = browser.get(_payment_record_url(booking_id))
    _assert_error(response, 404, BOOKING_NOT_FOUND, "booking_not_found")


def test_vendor_payment_record_for_an_unpaid_booking_is_not_found(admin_db: LocalDatabase) -> None:
    """`unpaid` is outside the payment-record statuses."""
    client_account = _seed_named_client(admin_db, "prec-unpaid-client")
    vendor_account = _seed_bookable_vendor(admin_db, "prec-unpaid")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="unpaid",
    )
    browser = sign_in(vendor_account)
    response = browser.get(_payment_record_url(booking_id))
    _assert_error(response, 404, RECEIPT_NOT_AVAILABLE, "receipt_not_available")


def test_vendor_payment_record_returns_the_vendor_share(admin_db: LocalDatabase) -> None:
    """A paid booking builds a payment record from the row, with no Stripe call."""
    client_account = _seed_named_client(admin_db, "prec-happy-client")
    vendor_account = _seed_bookable_vendor(admin_db, "prec-happy")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
        extra_fields=_vendor_money_fields(),
    )
    browser = sign_in(vendor_account)
    response = browser.get(_payment_record_url(booking_id))
    assert response.status_code == 200
    receipt = response.json()["receipt"]
    assert receipt["document_type"] == "vendor_payment_record"
    assert receipt["receipt_number"] == _receipt_number(booking_id)
    assert receipt["booking_request_id"] == booking_id
    assert receipt["event_name"] == EVENT_NAME
    assert receipt["event_date"] == EVENT_DATE
    assert receipt["payment_status"] == "paid"
    assert receipt["counterparty_name"] == CLIENT_PREFERRED_NAME
    assert receipt["total_label"] == VENDOR_SHARE_LABEL
    assert receipt["vendor_share_label"] == VENDOR_SHARE_LABEL
    assert receipt["platform_fee_label"] == PLATFORM_FEE_LABEL
    assert receipt["subtotal_label"] == LINE_ITEM_LABEL
    assert receipt["line_items"] == [{"label": "Classic Package", "amount_label": LINE_ITEM_LABEL}]
    assert receipt["payment_reference"] == PAYMENT_REFERENCE
    assert receipt["status_note"] == HELD_UNTIL_RELEASE_NOTE


def test_vendor_payment_record_for_a_full_refund_notes_the_refund(admin_db: LocalDatabase) -> None:
    """`refunded` is eligible and says the payment was refunded in full."""
    client_account = _seed_named_client(admin_db, "prec-refunded-client")
    vendor_account = _seed_bookable_vendor(admin_db, "prec-refunded")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="refunded",
        extra_fields=_vendor_money_fields(),
    )
    browser = sign_in(vendor_account)
    response = browser.get(_payment_record_url(booking_id))
    assert response.status_code == 200
    receipt = response.json()["receipt"]
    assert receipt["payment_status"] == "refunded"
    assert receipt["status_note"] == REFUNDED_IN_FULL_NOTE


def test_vendor_payment_record_for_a_partial_refund_notes_the_refund(admin_db: LocalDatabase) -> None:
    """`partially_refunded` is eligible and says the payment was partially refunded."""
    client_account = _seed_named_client(admin_db, "prec-partial-client")
    vendor_account = _seed_bookable_vendor(admin_db, "prec-partial")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="partially_refunded",
        extra_fields=_vendor_money_fields(),
    )
    browser = sign_in(vendor_account)
    response = browser.get(_payment_record_url(booking_id))
    assert response.status_code == 200
    receipt = response.json()["receipt"]
    assert receipt["payment_status"] == "partially_refunded"
    assert receipt["status_note"] == PARTIALLY_REFUNDED_NOTE


def test_vendor_payment_record_html_is_an_attachment(admin_db: LocalDatabase) -> None:
    """The HTML download is named `payment-record-{receipt_number}.html`."""
    client_account = _seed_named_client(admin_db, "prec-html-client")
    vendor_account = _seed_bookable_vendor(admin_db, "prec-html")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
        extra_fields=_vendor_money_fields(),
    )
    receipt_number = _receipt_number(booking_id)
    browser = sign_in(vendor_account)
    response = browser.get(f"{_payment_record_url(booking_id)}.html")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert response.headers["content-disposition"] == (
        f'attachment; filename="payment-record-{receipt_number}.html"'
    )
    assert receipt_number in response.text


# --- vendor payout statement --------------------------------------------------------


def test_vendor_payout_statement_before_release_is_not_found(admin_db: LocalDatabase) -> None:
    """`paid` is not yet a payout, so the statement is refused."""
    client_account = _seed_named_client(admin_db, "payout-paid-client")
    vendor_account = _seed_bookable_vendor(admin_db, "payout-paid")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
        extra_fields=_vendor_money_fields(),
    )
    browser = sign_in(vendor_account)
    response = browser.get(_payout_statement_url(booking_id))
    _assert_error(response, 404, RECEIPT_NOT_AVAILABLE, "receipt_not_available")


def test_vendor_payout_statement_returns_the_released_share(admin_db: LocalDatabase) -> None:
    """`payout_released` builds a statement from the vendor share and the transfer id."""
    client_account = _seed_named_client(admin_db, "payout-happy-client")
    vendor_account = _seed_bookable_vendor(admin_db, "payout-happy")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="payout_released",
        extra_fields={
            **_vendor_money_fields(),
            "payout_released_at": PAYOUT_RELEASED_AT,
            "stripe_transfer_id": TRANSFER_ID,
        },
    )
    browser = sign_in(vendor_account)
    response = browser.get(_payout_statement_url(booking_id))
    assert response.status_code == 200
    receipt = response.json()["receipt"]
    assert receipt["document_type"] == "vendor_payout_statement"
    assert receipt["receipt_number"] == _receipt_number(booking_id)
    assert receipt["booking_request_id"] == booking_id
    assert receipt["payment_status"] == "payout_released"
    assert receipt["counterparty_name"] == CLIENT_PREFERRED_NAME
    assert receipt["total_label"] == VENDOR_SHARE_LABEL
    assert receipt["vendor_share_label"] == VENDOR_SHARE_LABEL
    assert receipt["platform_fee_label"] is None
    assert receipt["line_items"] == [{"label": "Vendor share", "amount_label": VENDOR_SHARE_LABEL}]
    assert receipt["payment_reference"] == PAYMENT_REFERENCE
    assert receipt["transfer_reference"] == TRANSFER_REFERENCE
    assert receipt["payout_released_at"] == PAYOUT_RELEASED_AT
    assert receipt["status_note"] == PAYOUT_SENT_NOTE


def test_vendor_payout_statement_html_is_an_attachment(admin_db: LocalDatabase) -> None:
    """The HTML download is named `payout-statement-{receipt_number}.html`."""
    client_account = _seed_named_client(admin_db, "payout-html-client")
    vendor_account = _seed_bookable_vendor(admin_db, "payout-html")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="payout_released",
        extra_fields={
            **_vendor_money_fields(),
            "payout_released_at": PAYOUT_RELEASED_AT,
            "stripe_transfer_id": TRANSFER_ID,
        },
    )
    receipt_number = _receipt_number(booking_id)
    browser = sign_in(vendor_account)
    response = browser.get(f"{_payout_statement_url(booking_id)}.html")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert response.headers["content-disposition"] == (
        f'attachment; filename="payout-statement-{receipt_number}.html"'
    )
    assert receipt_number in response.text


# --- restore Stripe Connect ---------------------------------------------------------


def test_restore_stripe_connect_requires_sign_in() -> None:
    """POST .../restore-stripe-connect requires a session."""
    with new_browser() as browser:
        response = browser.post(_restore_url(str(uuid.uuid4())))
    _assert_error(response, 401, SIGN_IN_REQUIRED, "unauthenticated")


def test_restore_stripe_connect_is_forbidden_for_a_client(admin_db: LocalDatabase) -> None:
    """A client is refused by the admin gate, before the super-admin check, and the row stays as seeded."""
    client_account = _seed_named_client(admin_db, "restore-client")
    vendor_account = _seed_bookable_vendor(
        admin_db, "restore-client-vendor", stripe_account_id=FROZEN_STRIPE_ACCOUNT_ID
    )
    browser = sign_in(client_account)
    response = browser.post(_restore_url(vendor_account.user_id))
    _assert_error(response, 403, ADMIN_PORTAL_FORBIDDEN, "wrong_portal")
    assert _stripe_account_id(admin_db, vendor_account.user_id) == FROZEN_STRIPE_ACCOUNT_ID


def test_restore_stripe_connect_is_forbidden_for_a_plain_admin(
    admin_db: LocalDatabase, as_staff: httpx.Client
) -> None:
    """A plain admin is refused; only a super admin may restore Connect."""
    vendor_account = _seed_bookable_vendor(
        admin_db, "restore-staff-vendor", stripe_account_id=FROZEN_STRIPE_ACCOUNT_ID
    )
    response = as_staff.post(_restore_url(vendor_account.user_id))
    _assert_error(response, 403, SUPER_ADMIN_ONLY, "super_admin_only")
    assert _stripe_account_id(admin_db, vendor_account.user_id) == FROZEN_STRIPE_ACCOUNT_ID


def test_restore_stripe_connect_without_stripe_configured_is_rejected(
    admin_db: LocalDatabase, as_super_admin: httpx.Client
) -> None:
    """With no Stripe key the handler rejects before looking up a payout transfer."""
    vendor_account = _seed_bookable_vendor(
        admin_db, "restore-super-vendor", stripe_account_id=FROZEN_STRIPE_ACCOUNT_ID
    )
    response = as_super_admin.post(_restore_url(vendor_account.user_id))
    _assert_error(response, 400, STRIPE_NOT_CONFIGURED, "stripe_not_configured")
    assert _stripe_account_id(admin_db, vendor_account.user_id) == FROZEN_STRIPE_ACCOUNT_ID
