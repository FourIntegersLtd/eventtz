"""Freeze: in-app booking notifications for clients and vendors.

Covers `/api/v1/client/notifications/*` and `/api/v1/vendor/notifications/*`:
unread-count, mark-all-read, mark-one-read, and the combined `feed` (booking
updates only here; the dispute/chat items the feed also folds in belong to the
disputes and messaging slices).

`booking_notifications` rows are the side effect the bookings slice writes on
every status change (see `test_bookings_client.py`); this module seeds them
directly with `admin_db` rather than driving a full booking lifecycle, since
the notification routes only read and mutate that table.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from supabase import Client

from conftest import API, new_browser, sign_in
from support.accounts import seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. Sign in with a client account, or create one from the "
    "homepage."
)
VENDOR_PORTAL_FORBIDDEN = (
    "This page is for vendor accounts. If you offer services on Eventtz, create a vendor account or "
    "sign out and sign in again so we can refresh your account type. If you're planning an event, use "
    "client sign-in instead."
)

# The fallback copy shown for a `booking_request_received` notification: this kind is not in
# `_USE_STORED_BODY`, so the stored body is always ignored in favour of this fixed text.
BOOKING_REQUEST_RECEIVED_VENDOR_BODY = (
    "A client has sent you a new booking request on Eventtz.\n\n"
    "Please take a moment to review the date, service and any notes they shared, "
    "then accept or decline when you can. They will hear from us as soon as you respond."
)


def _seed_booking_row(admin_db: Client, *, client_user_id: str, vendor_user_id: str, event_name: str) -> str:
    """A minimal `booking_requests` row, just enough for the feed's event-name lookup."""
    row = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        "event_name": event_name,
        "event_date": "2099-06-01",
        "status": "pending",
        "payment_status": "unpaid",
        "initiator": "client",
        "total_label": "GBP 150",
        "selected_option_ids": [],
        "line_items": [],
        "vendor_adjustments": [],
    }
    inserted = admin_db.table("booking_requests").insert(row).execute().data
    return str(inserted[0]["id"])


def _seed_notification(
    admin_db: Client,
    *,
    user_id: str,
    booking_id: str,
    kind: str,
    body: str | None = None,
    read: bool = False,
) -> str:
    """A `booking_notifications` row in whatever read state a test needs."""
    row: dict[str, object] = {"user_id": user_id, "booking_id": booking_id, "kind": kind, "body": body}
    if read:
        row["read_at"] = datetime.now(UTC).isoformat()
    inserted = admin_db.table("booking_notifications").insert(row).execute().data
    return str(inserted[0]["id"])


def _seed_client_and_vendor(admin_db: Client, label: str):
    """A fresh client/vendor account pair and the booking id linking them."""
    client_account = seed_account(admin_db, unique_email(f"{label}-client"), "client")
    vendor_account = seed_account(admin_db, unique_email(f"{label}-vendor"), "vendor")
    booking_id = _seed_booking_row(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        event_name=f"Notify test {uuid.uuid4().hex[:8]}",
    )
    return client_account, vendor_account, booking_id


def test_client_unread_count_requires_sign_in() -> None:
    """GET /client/notifications/bookings/unread-count requires sign-in."""
    with new_browser() as browser:
        response = browser.get(f"{API}/client/notifications/bookings/unread-count")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_vendor_unread_count_is_forbidden_for_a_client(admin_db: Client) -> None:
    """A client account cannot use the vendor notifications routes."""
    client_account = seed_account(admin_db, unique_email("notif-wrong-role"), "client")
    browser = sign_in(client_account)
    response = browser.get(f"{API}/vendor/notifications/bookings/unread-count")
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


def test_client_notifications_feed_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account cannot use the client notifications routes."""
    vendor_account = seed_account(admin_db, unique_email("notif-wrong-role-2"), "vendor")
    browser = sign_in(vendor_account)
    response = browser.get(f"{API}/client/notifications/feed")
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_client_unread_count_counts_only_unread_rows_for_that_user(admin_db: Client) -> None:
    """The unread count is a per-user count of `booking_notifications` rows with no `read_at`."""
    client_account, vendor_account, booking_id = _seed_client_and_vendor(admin_db, "unread-count")
    _seed_notification(
        admin_db, user_id=client_account.user_id, booking_id=booking_id, kind="booking_request_sent"
    )
    _seed_notification(
        admin_db, user_id=client_account.user_id, booking_id=booking_id, kind="booking_accepted"
    )
    _seed_notification(
        admin_db, user_id=client_account.user_id, booking_id=booking_id, kind="booking_completed", read=True
    )
    browser = sign_in(client_account)
    response = browser.get(f"{API}/client/notifications/bookings/unread-count")
    assert response.status_code == 200
    assert response.json() == {"success": True, "unread_count": 2}


def test_vendor_unread_count_does_not_see_the_clients_notifications(admin_db: Client) -> None:
    """Counts are scoped to the caller: the vendor's unread count ignores the client's rows."""
    client_account, vendor_account, booking_id = _seed_client_and_vendor(admin_db, "unread-scope")
    _seed_notification(
        admin_db, user_id=client_account.user_id, booking_id=booking_id, kind="booking_request_sent"
    )
    browser = sign_in(vendor_account)
    response = browser.get(f"{API}/vendor/notifications/bookings/unread-count")
    assert response.status_code == 200
    assert response.json() == {"success": True, "unread_count": 0}


def test_client_mark_all_read_clears_the_unread_count(admin_db: Client) -> None:
    """Marking all read sets `read_at` on every unread row for that user."""
    client_account, vendor_account, booking_id = _seed_client_and_vendor(admin_db, "mark-all")
    _seed_notification(
        admin_db, user_id=client_account.user_id, booking_id=booking_id, kind="booking_request_sent"
    )
    _seed_notification(
        admin_db, user_id=client_account.user_id, booking_id=booking_id, kind="booking_accepted"
    )
    browser = sign_in(client_account)
    response = browser.post(f"{API}/client/notifications/bookings/mark-all-read")
    assert response.status_code == 200
    assert response.json() == {"success": True}

    unread_after = browser.get(f"{API}/client/notifications/bookings/unread-count")
    assert unread_after.json()["unread_count"] == 0

    rows = (
        admin_db.table("booking_notifications")
        .select("read_at")
        .eq("booking_id", booking_id)
        .eq("user_id", client_account.user_id)
        .execute()
        .data
    )
    assert all(row["read_at"] is not None for row in rows)


def test_vendor_mark_single_notification_read_only_affects_that_row(admin_db: Client) -> None:
    """Marking one notification read leaves the other unread for that user."""
    client_account, vendor_account, booking_id = _seed_client_and_vendor(admin_db, "mark-one")
    marked_id = _seed_notification(
        admin_db, user_id=vendor_account.user_id, booking_id=booking_id, kind="booking_request_received"
    )
    _seed_notification(
        admin_db, user_id=vendor_account.user_id, booking_id=booking_id, kind="vendor_quote_accepted"
    )
    browser = sign_in(vendor_account)
    response = browser.post(f"{API}/vendor/notifications/bookings/{marked_id}/mark-read")
    assert response.status_code == 200
    assert response.json() == {"success": True}

    unread_after = browser.get(f"{API}/vendor/notifications/bookings/unread-count")
    assert unread_after.json()["unread_count"] == 1


def test_mark_notification_read_for_someone_elses_row_reports_failure(admin_db: Client) -> None:
    """Marking a notification id that belongs to another user reports `success: False`, not 404.

    BASELINE QUIRK: the route always answers 200; ownership is enforced only inside the
    update's `.eq("user_id", ...)` filter, so a mismatch just updates zero rows and the
    caller sees `{"success": false}` rather than an error status.
    """
    client_account, vendor_account, booking_id = _seed_client_and_vendor(admin_db, "mark-wrong-owner")
    other_clients_notification_id = _seed_notification(
        admin_db, user_id=client_account.user_id, booking_id=booking_id, kind="booking_request_sent"
    )
    intruder = seed_account(admin_db, unique_email("mark-wrong-owner-intruder"), "client")
    browser = sign_in(intruder)
    response = browser.post(f"{API}/client/notifications/bookings/{other_clients_notification_id}/mark-read")
    assert response.status_code == 200
    assert response.json() == {"success": False}


def test_mark_notification_read_for_unknown_id_reports_failure(admin_db: Client) -> None:
    """Marking a notification id that does not exist at all also reports `success: False`."""
    client_account = seed_account(admin_db, unique_email("mark-unknown-id"), "client")
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/notifications/bookings/00000000-0000-4000-8000-000000000000/mark-read"
    )
    assert response.status_code == 200
    assert response.json() == {"success": False}


def test_feed_titles_the_booking_update_with_the_events_name_not_the_generic_copy(admin_db: Client) -> None:
    """A feed item's title is the booking's own event name whenever one is on file.

    BASELINE QUIRK: `format_booking_notification` only falls back to a generic title
    like "New booking request" when `event_name` is blank - so in practice, every
    booking-linked notification is titled after the event, and the per-kind titles in
    `notifications/copy.py` are effectively dead for any booking with a name.
    """
    client_account, vendor_account, booking_id = _seed_client_and_vendor(admin_db, "feed-title")
    event_name = (
        admin_db.table("booking_requests")
        .select("event_name")
        .eq("id", booking_id)
        .execute()
        .data[0]["event_name"]
    )
    _seed_notification(
        admin_db, user_id=vendor_account.user_id, booking_id=booking_id, kind="booking_request_received"
    )
    browser = sign_in(vendor_account)
    response = browser.get(f"{API}/vendor/notifications/feed")
    assert response.status_code == 200
    items = [item for item in response.json()["items"] if item["booking_id"] == booking_id]
    assert len(items) == 1
    assert items[0]["title"] == event_name
    assert items[0]["kind"] == "booking_update"
    assert items[0]["body"] == BOOKING_REQUEST_RECEIVED_VENDOR_BODY
    assert items[0]["unread"] is True
    assert items[0]["href"] == f"/vendor/bookings/{booking_id}"


def test_feed_uses_the_stored_body_for_kinds_that_carry_booking_specific_text(admin_db: Client) -> None:
    """For kinds in `_USE_STORED_BODY` (e.g. a payment notice), the stored body wins over the fallback."""
    client_account, vendor_account, booking_id = _seed_client_and_vendor(admin_db, "feed-stored-body")
    custom_body = "Acceptance test: your custom payment notice."
    _seed_notification(
        admin_db,
        user_id=client_account.user_id,
        booking_id=booking_id,
        kind="payment_received",
        body=custom_body,
    )
    browser = sign_in(client_account)
    response = browser.get(f"{API}/client/notifications/feed")
    assert response.status_code == 200
    items = [item for item in response.json()["items"] if item["booking_id"] == booking_id]
    assert len(items) == 1
    assert items[0]["body"] == custom_body


def test_feed_marks_read_rows_as_not_unread(admin_db: Client) -> None:
    """A read `booking_notifications` row surfaces in the feed with `unread: false`."""
    client_account, vendor_account, booking_id = _seed_client_and_vendor(admin_db, "feed-read")
    _seed_notification(
        admin_db,
        user_id=client_account.user_id,
        booking_id=booking_id,
        kind="booking_accepted",
        read=True,
    )
    browser = sign_in(client_account)
    response = browser.get(f"{API}/client/notifications/feed")
    assert response.status_code == 200
    items = [item for item in response.json()["items"] if item["booking_id"] == booking_id]
    assert len(items) == 1
    assert items[0]["unread"] is False
