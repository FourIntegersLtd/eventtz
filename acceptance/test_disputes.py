"""Freeze: booking disputes - client/vendor creation and listing, admin listing and resolution.

Covers `/api/v1/client/disputes*`, `/api/v1/client/booking-requests/{id}/disputes`,
the mirrored `/api/v1/vendor/...` routes, and `/api/v1/admin/disputes*`.

Stripe is switched off in this local environment. To freeze the admin money-moving
`resolution_action` paths without ever reaching Stripe, every booking below is seeded
without a `stripe_payment_intent_id` and without a `vendors` row for the vendor account,
which - per `_get_vendor_stripe_fields`/`_refund_paid_booking_row` - guarantees every
resolution path either fails a pre-Stripe validation check or hits a documented no-op
before any Stripe call would be attempted.
"""

from __future__ import annotations

from support.database import LocalDatabase

from conftest import API, new_browser, sign_in
from support.accounts import SeededAccount, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)

BOOKING_NOT_FOUND = "Booking not found."
INVALID_BOOKING_ID = "Invalid booking id."
INVALID_DISPUTE_ID = "Invalid dispute id."
CANNOT_OPEN_DISPUTE = "You cannot open a dispute for this booking."
DISPUTE_INVALID_STATUS = "Disputes cannot be opened for this booking in its current status."
DISPUTE_ALREADY_OPEN = "A dispute is already open or under review for this booking."
DISPUTE_NOT_FOUND = "Dispute not found"
DISPUTE_NOT_FOUND_DOT = "Dispute not found."
DISPUTE_STATUS_INVALID = "status must be all, open, under_review, resolved, or closed"
NO_FIELDS_TO_UPDATE = "No fields to update"
DISPUTE_FINANCIAL_RESOLUTION_SUPER_ADMIN_ONLY = (
    "Only super admins can resolve disputes with a financial outcome."
)
DISPUTE_REFUND_AMOUNT_SUPER_ADMIN_ONLY = "Only super admins can set refund amounts on disputes."
ONLY_PAID_PAYOUT_RELEASE = "Only paid bookings can have their payout released."
ONLY_PAID_CAN_REFUND = "Only paid bookings can be refunded."
NO_PAYMENT_ON_RECORD = "No payment on record for this booking."
REFUND_AMOUNT_REQUIRED_PARTIAL = "refund_amount_gbp is required for a partial refund."
ONLY_PAID_PARTIAL_REFUND = "Only paid bookings can be partially refunded."
ASSIGNEE_MUST_BE_ADMIN = "Assignee must be an admin account."

MISSING_BOOKING_ID = "00000000-0000-4000-8000-000000000000"
MISSING_DISPUTE_ID = "00000000-0000-4000-8000-000000000001"
MALFORMED_ID = "not-a-uuid"

CLIENT_DISPUTES_URL = f"{API}/client/disputes"
VENDOR_DISPUTES_URL = f"{API}/vendor/disputes"
ADMIN_DISPUTES_URL = f"{API}/admin/disputes"


def _partial_refund_range_detail(paid_pounds: int) -> str:
    """Mirrors `partial_refund_range_detail`: the exact out-of-range message for a paid amount."""
    return f"Partial refund must be between 0 and GBP {paid_pounds:.2f}."


def _seed_pair(admin_db: LocalDatabase, label: str) -> tuple[SeededAccount, SeededAccount]:
    """A fresh client and vendor account. No `vendors` row, so payout release stays a no-op."""
    client_account = seed_account(admin_db, unique_email(f"{label}-client"), "client")
    vendor_account = seed_account(admin_db, unique_email(f"{label}-vendor"), "vendor")
    return client_account, vendor_account


def _seed_booking(
    admin_db: LocalDatabase,
    *,
    client_user_id: str,
    vendor_user_id: str,
    status: str = "accepted",
    payment_status: str = "unpaid",
    total_label: str = "£100",
    event_date: str = "2099-01-01",
) -> str:
    """A minimal `booking_requests` row, never carrying a `stripe_payment_intent_id`."""
    inserted = (
        admin_db.table("booking_requests")
        .insert(
            {
                "client_user_id": client_user_id,
                "vendor_user_id": vendor_user_id,
                "event_name": "Acceptance dispute event",
                "event_date": event_date,
                "total_label": total_label,
                "status": status,
                "payment_status": payment_status,
            }
        )
        .execute()
        .data
    )
    return str(inserted[0]["id"])


def _seed_dispute(
    admin_db: LocalDatabase,
    *,
    booking_id: str,
    opened_by_user_id: str,
    status: str = "open",
    summary: str = "Seeded dispute for acceptance testing.",
) -> str:
    """A `dispute_cases` row inserted directly."""
    inserted = (
        admin_db.table("dispute_cases")
        .insert(
            {
                "booking_request_id": booking_id,
                "opened_by_user_id": opened_by_user_id,
                "status": status,
                "summary": summary,
            }
        )
        .execute()
        .data
    )
    return str(inserted[0]["id"])


def _latest_audit_row(admin_db: LocalDatabase, *, action: str, entity_id: str) -> dict[str, object]:
    """The newest `admin_audit_log` row for this action/entity, asserting one exists."""
    rows = (
        admin_db.table("admin_audit_log")
        .select("*")
        .eq("action", action)
        .eq("entity_id", entity_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
        .data
    )
    assert rows, f"expected an admin_audit_log row for action={action} entity_id={entity_id}"
    return rows[0]


# --- creation: POST client/vendor booking-requests/{id}/disputes -------------------------


def test_client_can_open_dispute_on_own_booking(admin_db: LocalDatabase) -> None:
    """A client can open a dispute on their own booking; it starts "open"."""
    client_account, vendor_account = _seed_pair(admin_db, "create-client")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests/{booking_id}/disputes",
        json={"summary": "The vendor did not turn up on the day of the event."},
    )
    assert response.status_code == 200
    dispute = response.json()["dispute"]
    assert dispute["status"] == "open"
    assert dispute["booking_request_id"] == booking_id
    stored = (
        admin_db.table("dispute_cases")
        .select("status, opened_by_user_id")
        .eq("id", dispute["id"])
        .execute()
        .data[0]
    )
    assert stored["status"] == "open"
    assert stored["opened_by_user_id"] == client_account.user_id


def test_vendor_can_open_dispute_on_own_booking(admin_db: LocalDatabase) -> None:
    """A vendor can open a dispute on their own booking."""
    client_account, vendor_account = _seed_pair(admin_db, "create-vendor")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(vendor_account)
    response = browser.post(
        f"{API}/vendor/booking-requests/{booking_id}/disputes",
        json={"summary": "The client's brief changed after we had already quoted."},
    )
    assert response.status_code == 200
    assert response.json()["dispute"]["status"] == "open"


def test_open_dispute_requires_sign_in() -> None:
    """Anonymous dispute creation is rejected."""
    browser = new_browser()
    response = browser.post(
        f"{API}/client/booking-requests/{MISSING_BOOKING_ID}/disputes",
        json={"summary": "Trying to open a dispute while signed out."},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_open_dispute_on_someone_elses_booking_leaks_existence_via_403(admin_db: LocalDatabase) -> None:
    """BASELINE QUIRK: opening a dispute on a real booking that isn't yours reveals the
    booking exists via 403, unlike listing/detail routes below which hide it behind an
    empty list or a 404.
    """
    client_account, vendor_account = _seed_pair(admin_db, "create-nonparty")
    other_client = seed_account(admin_db, unique_email("create-nonparty-other"), "client")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    other_browser = sign_in(other_client)
    response = other_browser.post(
        f"{API}/client/booking-requests/{booking_id}/disputes",
        json={"summary": "A non-party trying to open a dispute on this booking."},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == CANNOT_OPEN_DISPUTE


def test_open_dispute_on_missing_booking_is_404(admin_db: LocalDatabase) -> None:
    """A booking id that doesn't exist at all is a 404, not a 403."""
    client_account = seed_account(admin_db, unique_email("create-missing"), "client")
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests/{MISSING_BOOKING_ID}/disputes",
        json={"summary": "Opening a dispute on a booking that does not exist."},
    )
    assert response.status_code == 404
    assert response.json()["detail"] == BOOKING_NOT_FOUND


def test_open_dispute_on_malformed_booking_id_is_400(admin_db: LocalDatabase) -> None:
    """A booking id that isn't a UUID is rejected before any lookup."""
    client_account = seed_account(admin_db, unique_email("create-malformed"), "client")
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests/{MALFORMED_ID}/disputes",
        json={"summary": "Opening a dispute with a malformed booking id."},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_BOOKING_ID


def test_open_dispute_rejects_short_summary(admin_db: LocalDatabase) -> None:
    """A summary under 10 characters fails request validation."""
    client_account, vendor_account = _seed_pair(admin_db, "create-shortsummary")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests/{booking_id}/disputes", json={"summary": "too short"}
    )
    assert response.status_code == 422


def test_open_dispute_rejects_booking_in_disallowed_status(admin_db: LocalDatabase) -> None:
    """A cancelled booking cannot have a dispute opened on it."""
    client_account, vendor_account = _seed_pair(admin_db, "create-cancelled")
    booking_id = _seed_booking(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="cancelled",
    )
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests/{booking_id}/disputes",
        json={"summary": "Trying to dispute a cancelled booking."},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == DISPUTE_INVALID_STATUS


def test_open_dispute_rejects_duplicate_active_dispute(admin_db: LocalDatabase) -> None:
    """A second dispute cannot be opened while one is already open or under review."""
    client_account, vendor_account = _seed_pair(admin_db, "create-duplicate")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(client_account)
    first = browser.post(
        f"{API}/client/booking-requests/{booking_id}/disputes",
        json={"summary": "First dispute opened on this booking."},
    )
    assert first.status_code == 200
    second = browser.post(
        f"{API}/client/booking-requests/{booking_id}/disputes",
        json={"summary": "Second dispute attempted on the same booking."},
    )
    assert second.status_code == 409
    assert second.json()["detail"] == DISPUTE_ALREADY_OPEN


# --- listing: GET client/vendor booking-requests/{id}/disputes, /disputes, /disputes/{id} --


def test_list_disputes_on_own_booking(admin_db: LocalDatabase) -> None:
    """A party to the booking can list disputes on it."""
    client_account, vendor_account = _seed_pair(admin_db, "list-onbooking")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    browser = sign_in(client_account)
    response = browser.get(f"{API}/client/booking-requests/{booking_id}/disputes")
    assert response.status_code == 200
    disputes = response.json()["disputes"]
    assert [dispute["id"] for dispute in disputes] == [dispute_id]


def test_list_disputes_on_someone_elses_booking_is_an_empty_list(admin_db: LocalDatabase) -> None:
    """BASELINE QUIRK: unlike opening a dispute (403), listing disputes on a booking that
    isn't yours quietly returns an empty list rather than leaking that the booking exists.
    """
    client_account, vendor_account = _seed_pair(admin_db, "list-nonparty")
    other_client = seed_account(admin_db, unique_email("list-nonparty-other"), "client")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    other_browser = sign_in(other_client)
    response = other_browser.get(f"{API}/client/booking-requests/{booking_id}/disputes")
    assert response.status_code == 200
    assert response.json()["disputes"] == []


def test_list_own_disputes_requires_sign_in() -> None:
    """Anonymous listing is rejected."""
    browser = new_browser()
    response = browser.get(CLIENT_DISPUTES_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_list_own_disputes_for_client_and_vendor(admin_db: LocalDatabase) -> None:
    """Each side's `/disputes` list surfaces the same dispute they are a party to."""
    client_account, vendor_account = _seed_pair(admin_db, "list-own")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)

    client_browser = sign_in(client_account)
    client_response = client_browser.get(CLIENT_DISPUTES_URL)
    assert client_response.status_code == 200
    assert [dispute["id"] for dispute in client_response.json()["disputes"]] == [dispute_id]

    vendor_browser = sign_in(vendor_account)
    vendor_response = vendor_browser.get(VENDOR_DISPUTES_URL)
    assert vendor_response.status_code == 200
    assert [dispute["id"] for dispute in vendor_response.json()["disputes"]] == [dispute_id]


def test_get_dispute_detail_success(admin_db: LocalDatabase) -> None:
    """A party to the dispute can fetch its detail."""
    client_account, vendor_account = _seed_pair(admin_db, "detail-ok")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    browser = sign_in(client_account)
    response = browser.get(f"{CLIENT_DISPUTES_URL}/{dispute_id}")
    assert response.status_code == 200
    assert response.json()["dispute"]["id"] == dispute_id


def test_get_dispute_detail_malformed_id_is_400(admin_db: LocalDatabase) -> None:
    """A dispute id that isn't a UUID is rejected before any lookup."""
    client_account = seed_account(admin_db, unique_email("detail-malformed"), "client")
    browser = sign_in(client_account)
    response = browser.get(f"{CLIENT_DISPUTES_URL}/{MALFORMED_ID}")
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_DISPUTE_ID


def test_get_dispute_detail_for_non_party_hides_existence_via_404(admin_db: LocalDatabase) -> None:
    """A non-party fetching a real dispute's detail gets a plain 404, correctly hiding
    that the dispute exists (unlike dispute creation, which leaks existence via 403).
    """
    client_account, vendor_account = _seed_pair(admin_db, "detail-nonparty")
    other_client = seed_account(admin_db, unique_email("detail-nonparty-other"), "client")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    other_browser = sign_in(other_client)
    response = other_browser.get(f"{CLIENT_DISPUTES_URL}/{dispute_id}")
    assert response.status_code == 404
    # This participant-facing 404 uses the bookings-feature message (with a period),
    # distinct from the admin-facing DISPUTE_NOT_FOUND (no period) used elsewhere below.
    assert response.json()["detail"] == DISPUTE_NOT_FOUND_DOT


# --- admin: GET /admin/disputes, GET /admin/disputes/{id}, PATCH /admin/disputes/{id} -----


def test_admin_list_disputes_requires_sign_in() -> None:
    """Anonymous listing is rejected."""
    browser = new_browser()
    response = browser.get(ADMIN_DISPUTES_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_admin_list_disputes_forbidden_for_client_account(admin_db: LocalDatabase) -> None:
    """A client account cannot use the admin disputes route."""
    account = seed_account(admin_db, unique_email("admin-list-client"), "client")
    browser = sign_in(account)
    response = browser.get(ADMIN_DISPUTES_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_admin_list_disputes_status_open_includes_under_review(admin_db: LocalDatabase, as_staff) -> None:
    """The "open" status filter is a bucket that also includes "under_review" disputes."""
    client_account, vendor_account = _seed_pair(admin_db, "admin-status-open")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    open_id = _seed_dispute(
        admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id, status="open"
    )
    # A different event_date avoids the vendor's daily-capacity trigger, which blocks a
    # second booking for the same vendor on the same day.
    other_booking_id = _seed_booking(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        event_date="2099-01-02",
    )
    under_review_id = _seed_dispute(
        admin_db, booking_id=other_booking_id, opened_by_user_id=client_account.user_id, status="under_review"
    )
    response = as_staff.get(ADMIN_DISPUTES_URL, params={"status": "open"})
    assert response.status_code == 200
    ids = {dispute["id"] for dispute in response.json()["disputes"]}
    assert {open_id, under_review_id} <= ids


def test_admin_list_disputes_invalid_status_is_400(as_staff) -> None:
    """An unrecognised status filter value is rejected."""
    response = as_staff.get(ADMIN_DISPUTES_URL, params={"status": "not-a-status"})
    assert response.status_code == 400
    assert response.json()["detail"] == DISPUTE_STATUS_INVALID


def test_admin_patch_dispute_empty_body_is_400(admin_db: LocalDatabase, as_staff) -> None:
    """A patch with no fields set is rejected."""
    client_account, vendor_account = _seed_pair(admin_db, "admin-patch-empty")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    response = as_staff.patch(f"{ADMIN_DISPUTES_URL}/{dispute_id}", json={})
    assert response.status_code == 400
    assert response.json()["detail"] == NO_FIELDS_TO_UPDATE


def test_admin_patch_dispute_plain_field_missing_id_is_404(as_staff) -> None:
    """A plain-field patch (no `resolution_action`) on a missing dispute id is a 404."""
    response = as_staff.patch(
        f"{ADMIN_DISPUTES_URL}/{MISSING_DISPUTE_ID}", json={"internal_notes": "note on a missing dispute"}
    )
    assert response.status_code == 404
    assert response.json()["detail"] == DISPUTE_NOT_FOUND


def test_admin_patch_dispute_with_resolution_action_missing_id_is_400(as_super_admin) -> None:
    """BASELINE QUIRK: when the patch includes a money-moving `resolution_action`, a
    missing dispute id is instead a 400 with a message that (unlike the plain-field 404
    above) ends in a period - a second, differently-worded "not found" path from the
    early pre-Stripe safety lookup.
    """
    response = as_super_admin.patch(
        f"{ADMIN_DISPUTES_URL}/{MISSING_DISPUTE_ID}",
        json={"status": "resolved", "resolution_action": "release_to_vendor"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == DISPUTE_NOT_FOUND_DOT


def test_admin_patch_dispute_plain_status_transition_writes_audit_log(admin_db: LocalDatabase, as_staff) -> None:
    """A plain admin can move a dispute to "under_review"; this writes an audit row."""
    client_account, vendor_account = _seed_pair(admin_db, "admin-patch-status")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    response = as_staff.patch(f"{ADMIN_DISPUTES_URL}/{dispute_id}", json={"status": "under_review"})
    assert response.status_code == 200
    # Unlike the client/vendor participant routes, the admin patch response model is the
    # dispute itself, not wrapped in a `{"dispute": ...}` envelope.
    assert response.json()["status"] == "under_review"
    audit_row = _latest_audit_row(admin_db, action="dispute.patch", entity_id=dispute_id)
    assert audit_row["entity_type"] == "dispute_case"


def test_admin_patch_dispute_resolution_action_forbidden_for_plain_admin(admin_db: LocalDatabase, as_staff) -> None:
    """Only super admins may set a financial `resolution_action`."""
    client_account, vendor_account = _seed_pair(admin_db, "admin-patch-resolution-forbidden")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    response = as_staff.patch(
        f"{ADMIN_DISPUTES_URL}/{dispute_id}", json={"resolution_action": "release_to_vendor"}
    )
    assert response.status_code == 403
    assert response.json()["detail"] == DISPUTE_FINANCIAL_RESOLUTION_SUPER_ADMIN_ONLY


def test_admin_patch_dispute_refund_amount_forbidden_for_plain_admin(admin_db: LocalDatabase, as_staff) -> None:
    """Only super admins may set a refund amount, even without a `resolution_action`."""
    client_account, vendor_account = _seed_pair(admin_db, "admin-patch-refund-forbidden")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    response = as_staff.patch(f"{ADMIN_DISPUTES_URL}/{dispute_id}", json={"refund_amount_gbp": 10})
    assert response.status_code == 403
    assert response.json()["detail"] == DISPUTE_REFUND_AMOUNT_SUPER_ADMIN_ONLY


def test_admin_release_to_vendor_on_unpaid_booking_is_400(admin_db: LocalDatabase, as_super_admin) -> None:
    """A payout cannot be released for a booking that was never paid."""
    client_account, vendor_account = _seed_pair(admin_db, "release-unpaid")
    booking_id = _seed_booking(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="unpaid",
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    # The money-movement pre-check only runs when the patch also resolves the dispute.
    response = as_super_admin.patch(
        f"{ADMIN_DISPUTES_URL}/{dispute_id}",
        json={"status": "resolved", "resolution_action": "release_to_vendor"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_PAID_PAYOUT_RELEASE


def test_admin_release_to_vendor_on_paid_booking_is_a_stripe_off_noop(
    admin_db: LocalDatabase, as_super_admin
) -> None:
    """BASELINE QUIRK / Stripe-off no-op: with no vendor Stripe Connect setup, releasing a
    payout on a paid booking succeeds at the HTTP layer but leaves the booking row
    unchanged, since `release_vendor_payout_and_complete_booking` has nothing to transfer
    to and returns early (see `test_bookings_client.py`'s equivalent booking-lifecycle case).
    """
    client_account, vendor_account = _seed_pair(admin_db, "release-paid")
    booking_id = _seed_booking(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    response = as_super_admin.patch(
        f"{ADMIN_DISPUTES_URL}/{dispute_id}",
        json={"status": "resolved", "resolution_action": "release_to_vendor"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "resolved"
    stored = (
        admin_db.table("booking_requests").select("payment_status").eq("id", booking_id).execute().data[0]
    )
    assert stored["payment_status"] == "paid"


def test_admin_refund_client_on_unpaid_booking_is_400(admin_db: LocalDatabase, as_super_admin) -> None:
    """A refund cannot be issued for a booking that was never paid."""
    client_account, vendor_account = _seed_pair(admin_db, "refund-unpaid")
    booking_id = _seed_booking(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="unpaid",
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    response = as_super_admin.patch(
        f"{ADMIN_DISPUTES_URL}/{dispute_id}",
        json={"status": "resolved", "resolution_action": "refund_client"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_PAID_CAN_REFUND


def test_admin_refund_client_on_paid_booking_without_payment_intent_is_400(
    admin_db: LocalDatabase, as_super_admin
) -> None:
    """A paid booking with no `stripe_payment_intent_id` on record fails before any Stripe
    call is attempted - this is how the refund path is exercised safely with Stripe off.
    """
    client_account, vendor_account = _seed_pair(admin_db, "refund-nopaymentintent")
    booking_id = _seed_booking(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    response = as_super_admin.patch(
        f"{ADMIN_DISPUTES_URL}/{dispute_id}",
        json={"status": "resolved", "resolution_action": "refund_client"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == NO_PAYMENT_ON_RECORD


def test_admin_partial_refund_missing_amount_is_400(admin_db: LocalDatabase, as_super_admin) -> None:
    """A partial refund requires `refund_amount_gbp` to be set."""
    client_account, vendor_account = _seed_pair(admin_db, "partial-noamount")
    booking_id = _seed_booking(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    response = as_super_admin.patch(
        f"{ADMIN_DISPUTES_URL}/{dispute_id}",
        json={"status": "resolved", "resolution_action": "partial_refund"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == REFUND_AMOUNT_REQUIRED_PARTIAL


def test_admin_partial_refund_on_unpaid_booking_is_400(admin_db: LocalDatabase, as_super_admin) -> None:
    """A partial refund cannot be issued for a booking that was never paid."""
    client_account, vendor_account = _seed_pair(admin_db, "partial-unpaid")
    booking_id = _seed_booking(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="unpaid",
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    response = as_super_admin.patch(
        f"{ADMIN_DISPUTES_URL}/{dispute_id}",
        json={"status": "resolved", "resolution_action": "partial_refund", "refund_amount_gbp": 10},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == ONLY_PAID_PARTIAL_REFUND


def test_admin_partial_refund_amount_out_of_range_is_400(admin_db: LocalDatabase, as_super_admin) -> None:
    """A partial refund above the amount actually paid is rejected with the paid ceiling
    named in the message.
    """
    client_account, vendor_account = _seed_pair(admin_db, "partial-range")
    booking_id = _seed_booking(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        payment_status="paid",
        total_label="£100",
    )
    admin_db.table("booking_requests").update({"payment_amount_gbp": 100}).eq("id", booking_id).execute()
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    response = as_super_admin.patch(
        f"{ADMIN_DISPUTES_URL}/{dispute_id}",
        json={"status": "resolved", "resolution_action": "partial_refund", "refund_amount_gbp": 150},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == _partial_refund_range_detail(100)


def test_admin_patch_dispute_assignee_must_be_admin(admin_db: LocalDatabase, as_super_admin) -> None:
    """Assigning a dispute to a non-admin account is rejected."""
    client_account, vendor_account = _seed_pair(admin_db, "assignee-notadmin")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    dispute_id = _seed_dispute(admin_db, booking_id=booking_id, opened_by_user_id=client_account.user_id)
    response = as_super_admin.patch(
        f"{ADMIN_DISPUTES_URL}/{dispute_id}", json={"assigned_admin_id": client_account.user_id}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == ASSIGNEE_MUST_BE_ADMIN
