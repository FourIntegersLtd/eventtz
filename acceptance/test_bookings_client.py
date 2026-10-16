"""Freeze: the client side of the booking-request lifecycle.

Covers `/api/v1/client/booking-requests` (list, create), `/{booking_id}` (detail),
`/{booking_id}/cancel`, `/{booking_id}/status` (accept/decline a vendor-initiated
quote), `/{booking_id}/venue` and `/{booking_id}/confirm-completion`. Payments,
receipts, disputes and reviews live on the same rows but are other slices' scope.

Every test seeds a fresh client and vendor pair with `seed_account`/`unique_email` and
plants `vendors`/`booking_requests` rows directly with `admin_db`, so runs stay
independent of each other. Vendors are seeded `approval_status="approved"` with
`listing_override="visible"` so they are bookable without real Stripe Connect
(`docs/domain-rules.md`), and always with a non-empty `payload` — see the BASELINE
QUIRK on `_seed_bookable_vendor` below.
"""

from __future__ import annotations

import uuid

from support.database import LocalDatabase

from conftest import API, new_browser, sign_in
from support.accounts import SeededAccount, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. Sign in with a client account, or create one from the "
    "homepage."
)
ACCOUNT_SUSPENDED_MID_SESSION = (
    "Your account has been suspended. Contact support if you think this is a mistake."
)

INVALID_BOOKING_ID = "Invalid booking id."
INVALID_VENDOR_ID = "Invalid vendor id."
BOOKING_NOT_FOUND = "Booking not found."
GROUP_QUERY_PARAM = "Query parameter group must be active, completed, closed, or all."
CANNOT_BOOK_OWN_VENDOR = "Cannot book your own account as vendor."
VENDOR_NOT_AVAILABLE_FULL = (
    "This vendor is not available for booking right now. They may be unlisted, not yet approved, "
    "or still setting up payouts."
)
EVENT_DATE_PAST = "Event date cannot be in the past."
VENUE_ACCEPTED_ONLY = "Venue can only be updated on accepted bookings."
CANCEL_COMPLETE_INSTEAD = (
    "This booking is already complete, so it can't be cancelled. If something went wrong, report a "
    "problem instead."
)
ONLY_PENDING_OR_ACCEPTED_CANCEL = "Only pending or accepted bookings can be cancelled."
ONLY_PENDING_OR_REJECTED_CAN_ACCEPT = "Only a pending or declined booking can be accepted."
STATUS_CLIENT_MUST_BE = "status must be accepted or declined."

# A package with details long enough to pass the vendor payload's 40-character minimum.
PACKAGE_DETAILS = "A full package covering setup, service and clearup on the day."
# A UUID no booking will ever have, for 404 checks.
MISSING_BOOKING_ID = "00000000-0000-4000-8000-000000000000"


def _seed_bookable_vendor(admin_db: LocalDatabase, label: str, *, max_bookings_per_day: str = "20") -> SeededAccount:
    """A vendor that passes the public-listing and calendar gates, with one fixed £150 package.

    BASELINE QUIRK: `_enforce_vendor_calendar` treats an empty `payload` dict as "not
    available" (`if not payload:`), even when `approval_status`/`listing_override` say
    the vendor is fully bookable. So every vendor used in a creation-flow test needs a
    non-empty payload, not just the approval fields.
    """
    account = seed_account(admin_db, unique_email(label), "vendor")
    admin_db.table("vendors").insert(
        {
            "user_id": account.user_id,
            "status": "complete",
            "approval_status": "approved",
            "listing_override": "visible",
            "listing_override_reason": "acceptance suite: bookable vendor",
            "payload": {
                "maxBookingsPerDay": max_bookings_per_day,
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
    extra_fields: dict[str, object] | None = None,
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
        "selected_option_ids": ["pkg-1"],
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
    if extra_fields:
        row.update(extra_fields)
    inserted = admin_db.table("booking_requests").insert(row).execute().data
    return str(inserted[0]["id"])


def test_create_booking_request_success_returns_pending_booking(admin_db: LocalDatabase) -> None:
    """A valid create returns 200 with the new pending booking's id and status."""
    client_account = seed_account(admin_db, unique_email("create-ok-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "create-ok-vendor")
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": vendor_account.user_id,
            "event_name": "Birthday party",
            "event_date": "2099-06-01",
            "selected_option_ids": ["pkg-1"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["booking_status"] == "pending"
    assert uuid.UUID(body["booking_request_id"])


def test_create_booking_request_rejects_own_vendor_account(admin_db: LocalDatabase) -> None:
    """A client who is also the target vendor account cannot book themselves."""
    account = seed_account(admin_db, unique_email("self-book"), "client")
    browser = sign_in(account)
    response = browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": account.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "selected_option_ids": ["pkg-1"],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == CANNOT_BOOK_OWN_VENDOR


def test_create_booking_request_rejects_malformed_vendor_id(admin_db: LocalDatabase) -> None:
    """A non-UUID vendor id is rejected before any vendor lookup happens."""
    account = seed_account(admin_db, unique_email("bad-vendor-id"), "client")
    browser = sign_in(account)
    response = browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": "not-a-uuid",
            "event_name": "x",
            "event_date": "2099-06-01",
            "selected_option_ids": ["pkg-1"],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_VENDOR_ID


def test_create_booking_request_rejects_unlisted_vendor(admin_db: LocalDatabase) -> None:
    """A vendor still pending moderation is not bookable."""
    client_account = seed_account(admin_db, unique_email("unlisted-client"), "client")
    vendor_account = seed_account(admin_db, unique_email("unlisted-vendor"), "vendor")
    admin_db.table("vendors").insert(
        {"user_id": vendor_account.user_id, "status": "draft", "approval_status": "pending", "payload": {}}
    ).execute()
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": vendor_account.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "selected_option_ids": ["pkg-1"],
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"] == VENDOR_NOT_AVAILABLE_FULL


def test_create_booking_request_rejects_past_event_date(admin_db: LocalDatabase) -> None:
    """`event_date` in the past fails Pydantic validation, not the service layer."""
    client_account = seed_account(admin_db, unique_email("past-date-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "past-date-vendor")
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": vendor_account.user_id,
            "event_name": "x",
            "event_date": "2020-01-01",
            "selected_option_ids": ["pkg-1"],
        },
    )
    assert response.status_code == 422
    messages = [error["msg"] for error in response.json()["detail"]]
    assert any(EVENT_DATE_PAST in message for message in messages)


def test_create_booking_request_enforces_daily_capacity(admin_db: LocalDatabase) -> None:
    """A vendor with `maxBookingsPerDay=1` refuses a second client on the same date.

    Both an application pre-check and a Postgres trigger (migration 033) enforce this;
    they share the same friendly message.
    """
    vendor_account = _seed_bookable_vendor(admin_db, "capacity-vendor", max_bookings_per_day="1")
    first_client = seed_account(admin_db, unique_email("capacity-client-1"), "client")
    second_client = seed_account(admin_db, unique_email("capacity-client-2"), "client")
    shared_date = "2099-07-01"
    first_browser = sign_in(first_client)
    first_response = first_browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": vendor_account.user_id,
            "event_name": "First booking",
            "event_date": shared_date,
            "selected_option_ids": ["pkg-1"],
        },
    )
    assert first_response.status_code == 200
    second_browser = sign_in(second_client)
    second_response = second_browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": vendor_account.user_id,
            "event_name": "Second booking",
            "event_date": shared_date,
            "selected_option_ids": ["pkg-1"],
        },
    )
    assert second_response.status_code == 400
    assert second_response.json()["detail"] == (
        f"This vendor already has the maximum number of bookings (1) on {shared_date}. "
        "Choose another date or contact the vendor."
    )


def test_create_booking_request_requires_sign_in(admin_db: LocalDatabase) -> None:
    """Anonymous create is rejected before touching the vendor."""
    vendor_account = _seed_bookable_vendor(admin_db, "anon-create-vendor")
    browser = new_browser()
    response = browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": vendor_account.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "selected_option_ids": ["pkg-1"],
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_create_booking_request_forbidden_for_vendor_accounts(admin_db: LocalDatabase) -> None:
    """A vendor account cannot use the client create route."""
    other_vendor = _seed_bookable_vendor(admin_db, "wrong-role-vendor")
    acting_vendor = seed_account(admin_db, unique_email("acting-vendor"), "vendor")
    browser = sign_in(acting_vendor)
    response = browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": other_vendor.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "selected_option_ids": ["pkg-1"],
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_list_booking_requests_returns_own_active_bookings(admin_db: LocalDatabase) -> None:
    """The active group lists a client's own pending/accepted bookings."""
    client_account = seed_account(admin_db, unique_email("list-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "list-vendor")
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(client_account)
    response = browser.get(f"{API}/client/booking-requests", params={"group": "active"})
    assert response.status_code == 200
    booking_ids = [booking["booking_request_id"] for booking in response.json()["bookings"]]
    assert booking_id in booking_ids


def test_list_booking_requests_rejects_unknown_group(admin_db: LocalDatabase) -> None:
    """An invalid `group` query parameter is rejected with the allowed values listed."""
    client_account = seed_account(admin_db, unique_email("bad-group-client"), "client")
    browser = sign_in(client_account)
    response = browser.get(f"{API}/client/booking-requests", params={"group": "bogus"})
    assert response.status_code == 400
    assert response.json()["detail"] == GROUP_QUERY_PARAM


def test_list_booking_requests_requires_sign_in() -> None:
    """Anonymous listing is rejected."""
    browser = new_browser()
    response = browser.get(f"{API}/client/booking-requests")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_get_booking_request_detail_includes_pricing_breakdown(admin_db: LocalDatabase) -> None:
    """Detail includes the literal pence/pounds figures for a known £150 fixed package."""
    client_account = seed_account(admin_db, unique_email("detail-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "detail-vendor")
    browser = sign_in(client_account)
    created = browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": vendor_account.user_id,
            "event_name": "Detail test",
            "event_date": "2099-06-01",
            "selected_option_ids": ["pkg-1"],
        },
    ).json()
    booking_id = created["booking_request_id"]
    response = browser.get(f"{API}/client/booking-requests/{booking_id}")
    assert response.status_code == 200
    pricing = response.json()["booking"]["pricing"]
    assert pricing["vendor_portion_gbp"] == 150.0
    assert pricing["service_fee_gbp"] == 7.5
    assert pricing["client_total_gbp"] == 157.5
    assert pricing["client_total_label"] == "GBP 157.50"
    assert pricing["vendor_portion_label"] == "GBP 150"
    assert pricing["line_items_subtotal_label"] == "GBP 150"


def test_get_booking_request_detail_not_found_for_missing_id(admin_db: LocalDatabase) -> None:
    """A booking id that does not exist is a 404, not a 403, for a signed-in client."""
    client_account = seed_account(admin_db, unique_email("detail-404-client"), "client")
    browser = sign_in(client_account)
    response = browser.get(f"{API}/client/booking-requests/{MISSING_BOOKING_ID}")
    assert response.status_code == 404
    assert response.json()["detail"] == BOOKING_NOT_FOUND


def test_get_booking_request_detail_rejects_malformed_id(admin_db: LocalDatabase) -> None:
    """A non-UUID path segment is a 400, not a 404."""
    client_account = seed_account(admin_db, unique_email("detail-badid-client"), "client")
    browser = sign_in(client_account)
    response = browser.get(f"{API}/client/booking-requests/not-a-uuid")
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_BOOKING_ID


def test_get_booking_request_detail_hidden_from_non_owner_client(admin_db: LocalDatabase) -> None:
    """Another client cannot see this booking: it is a 404, not a 403.

    BASELINE QUIRK: ownership is enforced by scoping the lookup query to
    `client_user_id = <caller>`, so a real booking owned by someone else looks
    identical to a missing one.
    """
    owner = seed_account(admin_db, unique_email("owner-client"), "client")
    other_client = seed_account(admin_db, unique_email("other-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "owner-check-vendor")
    booking_id = _seed_booking_row(
        admin_db, client_user_id=owner.user_id, vendor_user_id=vendor_account.user_id
    )
    other_browser = sign_in(other_client)
    response = other_browser.get(f"{API}/client/booking-requests/{booking_id}")
    assert response.status_code == 404
    assert response.json()["detail"] == BOOKING_NOT_FOUND


def test_cancel_pending_booking_succeeds(admin_db: LocalDatabase) -> None:
    """A client can cancel their own pending booking."""
    client_account = seed_account(admin_db, unique_email("cancel-pending-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "cancel-pending-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/cancel")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["booking_status"] == "cancelled"


def test_cancel_already_cancelled_booking_fails(admin_db: LocalDatabase) -> None:
    """Cancelling a booking twice fails: only pending/accepted bookings can be cancelled."""
    client_account = seed_account(admin_db, unique_email("cancel-twice-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "cancel-twice-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="cancelled",
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/cancel")
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_PENDING_OR_ACCEPTED_CANCEL


def test_cancel_completed_booking_directs_to_completion_flow(admin_db: LocalDatabase) -> None:
    """A completed booking cannot be cancelled; the message points at the other flow."""
    client_account = seed_account(admin_db, unique_email("cancel-completed-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "cancel-completed-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="completed",
        payment_status="payout_released",
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/cancel")
    assert response.status_code == 400
    assert response.json()["detail"] == CANCEL_COMPLETE_INSTEAD


def test_cancel_booking_owned_by_another_client_is_not_found(admin_db: LocalDatabase) -> None:
    """A client cannot cancel a booking that belongs to someone else."""
    owner = seed_account(admin_db, unique_email("cancel-owner-client"), "client")
    other_client = seed_account(admin_db, unique_email("cancel-other-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "cancel-owner-vendor")
    booking_id = _seed_booking_row(
        admin_db, client_user_id=owner.user_id, vendor_user_id=vendor_account.user_id
    )
    other_browser = sign_in(other_client)
    response = other_browser.post(f"{API}/client/booking-requests/{booking_id}/cancel")
    assert response.status_code == 404
    assert response.json()["detail"] == BOOKING_NOT_FOUND


def test_cancel_booking_requires_sign_in(admin_db: LocalDatabase) -> None:
    """Anonymous cancel is rejected."""
    client_account = seed_account(admin_db, unique_email("cancel-anon-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "cancel-anon-vendor")
    booking_id = _seed_booking_row(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = new_browser()
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/cancel")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_accept_vendor_initiated_quote_succeeds(admin_db: LocalDatabase) -> None:
    """A client can accept a pending vendor-initiated quote."""
    client_account = seed_account(admin_db, unique_email("accept-quote-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "accept-quote-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
        initiator="vendor",
    )
    browser = sign_in(client_account)
    response = browser.patch(
        f"{API}/client/booking-requests/{booking_id}/status", json={"status": "accepted"}
    )
    assert response.status_code == 200
    assert response.json()["booking_status"] == "accepted"


def test_decline_vendor_initiated_quote_succeeds(admin_db: LocalDatabase) -> None:
    """A client can decline a pending vendor-initiated quote."""
    client_account = seed_account(admin_db, unique_email("decline-quote-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "decline-quote-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
        initiator="vendor",
    )
    browser = sign_in(client_account)
    response = browser.patch(
        f"{API}/client/booking-requests/{booking_id}/status", json={"status": "declined"}
    )
    assert response.status_code == 200
    assert response.json()["booking_status"] == "declined"


def test_status_update_rejects_unsupported_value(admin_db: LocalDatabase) -> None:
    """`status` values other than accepted/declined are rejected by the request schema.

    `ClientBookingStatusBody.booking_status` is a `Literal["accepted", "declined"]`, so
    `STATUS_CLIENT_MUST_BE` in the service layer is unreachable through HTTP: Pydantic's
    422 always fires first.
    """
    client_account = seed_account(admin_db, unique_email("status-bad-value-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "status-bad-value-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
        initiator="vendor",
    )
    browser = sign_in(client_account)
    response = browser.patch(
        f"{API}/client/booking-requests/{booking_id}/status", json={"status": "cancelled"}
    )
    assert response.status_code == 422


def test_client_declining_vendor_price_adjustment_reverts_booking_to_pending(admin_db: LocalDatabase) -> None:
    """Declining a client-initiated booking that carries a vendor price adjustment un-declines it.

    BASELINE QUIRK: this is not a plain decline. `cancel_booking_request_for_client`'s
    "decline updated price" path sets `status` back to `"pending"` (not `"declined"`),
    clears `vendor_adjustments` to `[]`, and rebuilds the pricing snapshot off the
    original line items - the client is asking to go back to the original quote, not
    to end the booking.
    """
    client_account = seed_account(admin_db, unique_email("decline-price-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "decline-price-vendor")
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
    browser = sign_in(client_account)
    response = browser.patch(
        f"{API}/client/booking-requests/{booking_id}/status", json={"status": "declined"}
    )
    assert response.status_code == 200
    assert response.json()["booking_status"] == "pending"
    stored = (
        admin_db.table("booking_requests")
        .select("status, vendor_adjustments")
        .eq("id", booking_id)
        .execute()
        .data[0]
    )
    assert stored["status"] == "pending"
    assert stored["vendor_adjustments"] == []


def test_status_update_owned_by_another_client_is_not_found(admin_db: LocalDatabase) -> None:
    """A client cannot accept or decline someone else's booking."""
    owner = seed_account(admin_db, unique_email("status-owner-client"), "client")
    other_client = seed_account(admin_db, unique_email("status-other-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "status-owner-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=owner.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
        initiator="vendor",
    )
    other_browser = sign_in(other_client)
    response = other_browser.patch(
        f"{API}/client/booking-requests/{booking_id}/status", json={"status": "accepted"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == BOOKING_NOT_FOUND


def test_update_venue_requires_accepted_booking(admin_db: LocalDatabase) -> None:
    """Setting the venue address on a pending booking is refused."""
    client_account = seed_account(admin_db, unique_email("venue-pending-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "venue-pending-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
    )
    browser = sign_in(client_account)
    response = browser.patch(
        f"{API}/client/booking-requests/{booking_id}/venue", json={"event_address": "123 Test Street"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == VENUE_ACCEPTED_ONLY


def test_update_venue_succeeds_on_accepted_booking(admin_db: LocalDatabase) -> None:
    """The venue address and postcode are stored and echoed back on an accepted booking."""
    client_account = seed_account(admin_db, unique_email("venue-accepted-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "venue-accepted-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
    )
    browser = sign_in(client_account)
    response = browser.patch(
        f"{API}/client/booking-requests/{booking_id}/venue",
        json={"event_address": "123 Test Street", "event_postcode": "SW1A 1AA"},
    )
    assert response.status_code == 200
    booking = response.json()["booking"]
    assert booking["event_address"] == "123 Test Street"
    assert booking["event_postcode"] == "SW1A 1AA"


def test_update_venue_rejects_short_address(admin_db: LocalDatabase) -> None:
    """An address under 3 characters fails request validation before the service runs.

    `UpdateBookingVenueBody.event_address` enforces `min_length=3` itself, so the
    service layer's own `ENTER_VENUE_ADDRESS` check is unreachable through HTTP.
    """
    client_account = seed_account(admin_db, unique_email("venue-short-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "venue-short-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
    )
    browser = sign_in(client_account)
    response = browser.patch(
        f"{API}/client/booking-requests/{booking_id}/venue", json={"event_address": "AB"}
    )
    assert response.status_code == 422


def test_confirm_completion_requires_accepted_and_paid_booking(admin_db: LocalDatabase) -> None:
    """Confirming completion on an unpaid booking is refused even once accepted."""
    client_account = seed_account(admin_db, unique_email("confirm-unpaid-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "confirm-unpaid-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
        payment_status="unpaid",
        event_date="2020-01-01",
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/confirm-completion")
    assert response.status_code == 400


def test_confirm_completion_before_event_day_is_refused(admin_db: LocalDatabase) -> None:
    """A client cannot confirm completion before the event's day is over."""
    client_account = seed_account(admin_db, unique_email("confirm-early-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "confirm-early-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
        payment_status="paid",
        event_date="2099-06-01",
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/confirm-completion")
    assert response.status_code == 400


def test_confirm_completion_first_party_awaits_the_other(admin_db: LocalDatabase) -> None:
    """A client confirming first is told the vendor still needs to confirm."""
    client_account = seed_account(admin_db, unique_email("confirm-first-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "confirm-first-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
        payment_status="paid",
        event_date="2020-01-01",
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/booking-requests/{booking_id}/confirm-completion")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["status"] == "accepted"
    assert body["payment_status"] == "paid"
    assert body["awaiting_other_party"] is True


def test_confirm_completion_second_party_stays_awaiting_without_stripe(admin_db: LocalDatabase) -> None:
    """BASELINE QUIRK: with Stripe switched off, both parties confirming never finishes.

    `release_vendor_payout_and_complete_booking` is a no-op when the vendor has no
    `stripe_account_id`/`stripe_payouts_enabled` (it just dispatches a
    `payout_held_connect_incomplete` notification and returns). The booking stays
    `status="accepted"`, `payment_status="paid"`, and `awaiting_other_party` is
    computed as `status != "completed" and (client_confirmed or vendor_confirmed)`,
    which is still true after both parties have confirmed - it never flips to `False`
    on this server.
    """
    client_account = seed_account(admin_db, unique_email("confirm-both-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "confirm-both-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
        payment_status="paid",
        event_date="2020-01-01",
    )
    client_browser = sign_in(client_account)
    vendor_browser = sign_in(vendor_account)
    client_browser.post(f"{API}/client/booking-requests/{booking_id}/confirm-completion")
    vendor_response = vendor_browser.post(f"{API}/vendor/booking-requests/{booking_id}/confirm-completion")
    assert vendor_response.status_code == 200
    body = vendor_response.json()
    assert body["status"] == "accepted"
    assert body["payment_status"] == "paid"
    assert body["awaiting_other_party"] is True


def test_confirm_completion_owned_by_another_client_is_not_found(admin_db: LocalDatabase) -> None:
    """A client cannot confirm completion on someone else's booking."""
    owner = seed_account(admin_db, unique_email("confirm-owner-client"), "client")
    other_client = seed_account(admin_db, unique_email("confirm-other-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "confirm-owner-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=owner.user_id,
        vendor_user_id=vendor_account.user_id,
        status="accepted",
        payment_status="paid",
        event_date="2020-01-01",
    )
    other_browser = sign_in(other_client)
    response = other_browser.post(f"{API}/client/booking-requests/{booking_id}/confirm-completion")
    assert response.status_code == 404
    assert response.json()["detail"] == BOOKING_NOT_FOUND


def test_suspending_mid_session_blocks_the_next_create(admin_db: LocalDatabase) -> None:
    """A client suspended after signing in is rejected on their very next request.

    `require_user` checks `account_suspended` on every request, using different wording
    from the sign-in-time check (frozen in test_identity_session.py).
    """
    vendor_account = _seed_bookable_vendor(admin_db, "suspend-mid-vendor")
    account = seed_account(admin_db, unique_email("suspend-mid-client"), "client")
    browser = sign_in(account)
    admin_db.table("users").update({"account_suspended": True}).eq("id", account.user_id).execute()
    response = browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": vendor_account.user_id,
            "event_name": "x",
            "event_date": "2099-06-01",
            "selected_option_ids": ["pkg-1"],
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == ACCOUNT_SUSPENDED_MID_SESSION


def test_create_booking_request_notifies_vendor_and_client(admin_db: LocalDatabase) -> None:
    """Creating a booking writes a notification row for each side (side effect check)."""
    client_account = seed_account(admin_db, unique_email("notify-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "notify-vendor")
    browser = sign_in(client_account)
    created = browser.post(
        f"{API}/client/booking-requests",
        json={
            "vendor_user_id": vendor_account.user_id,
            "event_name": "Notification check",
            "event_date": "2099-06-01",
            "selected_option_ids": ["pkg-1"],
        },
    ).json()
    booking_id = created["booking_request_id"]
    notifications = {
        (row["user_id"], row["kind"])
        for row in admin_db.table("booking_notifications")
        .select("user_id, kind")
        .eq("booking_id", booking_id)
        .execute()
        .data
    }
    assert (vendor_account.user_id, "booking_request_received") in notifications
    assert (client_account.user_id, "booking_request_sent") in notifications


def test_vendor_declining_client_booking_notifies_the_client(admin_db: LocalDatabase) -> None:
    """A vendor declining a client's booking writes a `booking_declined_by_vendor` row."""
    client_account = seed_account(admin_db, unique_email("decline-notify-client"), "client")
    vendor_account = _seed_bookable_vendor(admin_db, "decline-notify-vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
    )
    vendor_browser = sign_in(vendor_account)
    response = vendor_browser.patch(
        f"{API}/vendor/booking-requests/{booking_id}/status", json={"status": "declined"}
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
    assert (client_account.user_id, "booking_declined_by_vendor") in notifications
