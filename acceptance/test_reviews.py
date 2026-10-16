"""Freeze: booking reviews - client submission, vendor's own reviews, admin moderation.

Covers `/api/v1/client/reviews` (list) and `/api/v1/client/booking-requests/{id}/review`
(submit), `/api/v1/vendor/reviews` (list), and `/api/v1/admin/reviews*` (list, detail,
visibility). The public `GET /api/v1/vendors/{id}/reviews` route is already frozen in
`test_marketplace_explore.py` and is not duplicated here.

A review needs a `booking_requests` row with `status="completed"` - `create_booking_review`
checks only that field, not `payment_status`, so every seeded booking below is completed
but left `payment_status="unpaid"` unless a test says otherwise. Rows are planted directly
with `admin_db` rather than driven through the full booking lifecycle, which is
`test_bookings_client.py`'s scope. No `vendors` row is needed: reviews are keyed off
`booking_requests`/`booking_reviews` alone, and the vendor-facing routes only check the
signed-in account's `user_type`.
"""

from __future__ import annotations

import re

from support.database import LocalDatabase

from conftest import API, new_browser, sign_in
from support.accounts import SeededAccount, seed_account, unique_email

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
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
REVIEW_AFTER_COMPLETE = "You can only review a booking after it is marked complete."
REVIEW_ALREADY_SUBMITTED = "You have already submitted a review for this booking."
REVIEW_MIN_LENGTH = "Review must be at least 10 characters."
BOOKING_NOT_FOUND = "Booking not found."
REVIEW_NOT_FOUND = "Review not found"

CLIENT_REVIEWS_URL = f"{API}/client/reviews"
VENDOR_REVIEWS_URL = f"{API}/vendor/reviews"
ADMIN_REVIEWS_URL = f"{API}/admin/reviews"

# A UUID no booking or review will ever have, for 404 checks.
MISSING_ID = "00000000-0000-4000-8000-000000000000"


def _seed_pair(admin_db: LocalDatabase, label: str) -> tuple[SeededAccount, SeededAccount]:
    """A fresh client and vendor account, with no `vendors` row (reviews don't need one)."""
    client_account = seed_account(admin_db, unique_email(f"{label}-client"), "client")
    vendor_account = seed_account(admin_db, unique_email(f"{label}-vendor"), "vendor")
    return client_account, vendor_account


def _seed_booking(
    admin_db: LocalDatabase,
    *,
    client_user_id: str,
    vendor_user_id: str,
    status: str = "completed",
    event_name: str = "Acceptance review event",
    total_label: str = "£150",
) -> str:
    """A minimal `booking_requests` row, in whatever status a review test needs."""
    inserted = (
        admin_db.table("booking_requests")
        .insert(
            {
                "client_user_id": client_user_id,
                "vendor_user_id": vendor_user_id,
                "event_name": event_name,
                "event_date": "2099-01-01",
                "total_label": total_label,
                "status": status,
            }
        )
        .execute()
        .data
    )
    return str(inserted[0]["id"])


def _seed_review(
    admin_db: LocalDatabase,
    *,
    booking_id: str,
    client_user_id: str,
    vendor_user_id: str,
    rating: int = 5,
    body: str = "A lovely vendor, would book again for sure.",
    hidden: bool = False,
) -> str:
    """A `booking_reviews` row inserted directly."""
    row: dict[str, object] = {
        "booking_request_id": booking_id,
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        "rating": rating,
        "body": body,
    }
    if hidden:
        row["hidden_at"] = "2099-01-01T00:00:00+00:00"
    inserted = admin_db.table("booking_reviews").insert(row).execute().data
    return str(inserted[0]["id"])


def _expected_reviewer_display(email: str) -> str:
    """Mirrors `_reviewer_display_from_email`: the email's local part, capitalised and clipped."""
    local = re.sub(r"[^a-zA-Z0-9._-]", "", email.split("@", 1)[0].strip())
    return local[:1].upper() + local[1:18] if len(local) > 1 else local.upper()


# --- POST /client/booking-requests/{id}/review ----------------------------------------


def test_post_booking_review_success_on_completed_unpaid_booking(admin_db: LocalDatabase) -> None:
    """A completed booking can be reviewed even when it was never paid through the platform.

    BASELINE QUIRK: `create_booking_review` only checks `booking_requests.status ==
    "completed"`; it never looks at `payment_status`.
    """
    client_account, vendor_account = _seed_pair(admin_db, "post-ok")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests/{booking_id}/review",
        json={"rating": 5, "body": "Fantastic service from start to finish, highly recommend."},
    )
    assert response.status_code == 200
    review = response.json()["review"]
    assert review["rating"] == 5
    assert review["body"] == "Fantastic service from start to finish, highly recommend."
    assert review["image_urls"] == []


def test_post_booking_review_rejects_not_completed_booking(admin_db: LocalDatabase) -> None:
    """A pending booking cannot be reviewed yet."""
    client_account, vendor_account = _seed_pair(admin_db, "post-pending")
    booking_id = _seed_booking(
        admin_db,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        status="pending",
    )
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests/{booking_id}/review",
        json={"rating": 4, "body": "Reviewing before it's finished."},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == REVIEW_AFTER_COMPLETE


def test_post_booking_review_rejects_duplicate_submission(admin_db: LocalDatabase) -> None:
    """A second review on the same booking is refused."""
    client_account, vendor_account = _seed_pair(admin_db, "post-dup")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(client_account)
    first = browser.post(
        f"{API}/client/booking-requests/{booking_id}/review",
        json={"rating": 5, "body": "First review of this booking, all good."},
    )
    assert first.status_code == 200
    second = browser.post(
        f"{API}/client/booking-requests/{booking_id}/review",
        json={"rating": 1, "body": "Trying to review the same booking again."},
    )
    assert second.status_code == 400
    assert second.json()["detail"] == REVIEW_ALREADY_SUBMITTED


def test_post_booking_review_rejects_whitespace_only_body_after_strip(admin_db: LocalDatabase) -> None:
    """BASELINE QUIRK: a body of 10 spaces passes Pydantic's `min_length=10` (it counts raw
    characters) but fails the service's own length check, which runs on the stripped text.
    """
    client_account, vendor_account = _seed_pair(admin_db, "post-whitespace")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests/{booking_id}/review",
        json={"rating": 3, "body": " " * 10},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == REVIEW_MIN_LENGTH


def test_post_booking_review_owned_by_another_client_is_a_400_not_a_404(admin_db: LocalDatabase) -> None:
    """BASELINE QUIRK: unlike the booking-status/cancel routes, a review on someone else's
    booking comes back as a 400 "Booking not found.", not a 404 - `create_booking_review`
    raises a plain `ValueError` that the route always maps to 400.
    """
    owner, vendor_account = _seed_pair(admin_db, "post-owner")
    other_client = seed_account(admin_db, unique_email("post-other-client"), "client")
    booking_id = _seed_booking(admin_db, client_user_id=owner.user_id, vendor_user_id=vendor_account.user_id)
    other_browser = sign_in(other_client)
    response = other_browser.post(
        f"{API}/client/booking-requests/{booking_id}/review",
        json={"rating": 2, "body": "Reviewing a booking that isn't mine."},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == BOOKING_NOT_FOUND


def test_post_booking_review_requires_sign_in(admin_db: LocalDatabase) -> None:
    """Anonymous review submission is rejected."""
    client_account, vendor_account = _seed_pair(admin_db, "post-anon")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = new_browser()
    response = browser.post(
        f"{API}/client/booking-requests/{booking_id}/review",
        json={"rating": 5, "body": "Anonymous attempt to leave a review."},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_post_booking_review_forbidden_for_vendor_account(admin_db: LocalDatabase) -> None:
    """A vendor account cannot use the client review route."""
    client_account, vendor_account = _seed_pair(admin_db, "post-vendor-role")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(vendor_account)
    response = browser.post(
        f"{API}/client/booking-requests/{booking_id}/review",
        json={"rating": 5, "body": "A vendor trying to review their own booking."},
    )
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_post_booking_review_rejects_too_many_photos(admin_db: LocalDatabase) -> None:
    """More than 5 image URLs fails request validation, not the service layer."""
    client_account, vendor_account = _seed_pair(admin_db, "post-photos")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests/{booking_id}/review",
        json={
            "rating": 5,
            "body": "Six photos attached to this lovely review of the event.",
            "image_urls": [f"https://example.com/photo-{photo_number}.png" for photo_number in range(6)],
        },
    )
    assert response.status_code == 422


def test_post_booking_review_silently_drops_non_http_image_urls(admin_db: LocalDatabase) -> None:
    """BASELINE QUIRK: a non-http(s) URL is dropped from `image_urls` without an error,
    rather than being rejected.
    """
    client_account, vendor_account = _seed_pair(admin_db, "post-nonhttp")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    browser = sign_in(client_account)
    response = browser.post(
        f"{API}/client/booking-requests/{booking_id}/review",
        json={
            "rating": 4,
            "body": "A review with one valid and one invalid photo URL.",
            "image_urls": ["ftp://example.com/not-allowed.png", "https://example.com/allowed.png"],
        },
    )
    assert response.status_code == 200
    assert response.json()["review"]["image_urls"] == ["https://example.com/allowed.png"]


# --- GET /client/reviews ----------------------------------------------------------------


def test_get_client_own_reviews_lists_a_submitted_review(admin_db: LocalDatabase) -> None:
    """A client's own reviews list includes the vendor id and event context."""
    client_account, vendor_account = _seed_pair(admin_db, "client-list")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    _seed_review(
        admin_db,
        booking_id=booking_id,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        rating=4,
        body="Great value, would use again for our next event.",
    )
    browser = sign_in(client_account)
    response = browser.get(CLIENT_REVIEWS_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["review_count"] == 1
    review = body["reviews"][0]
    assert review["rating"] == 4
    assert review["body"] == "Great value, would use again for our next event."
    assert review["booking_request_id"] == booking_id
    assert review["vendor_user_id"] == vendor_account.user_id
    # BASELINE QUIRK: with no `vendors` row for this account, the display name falls
    # back to the literal string "Vendor".
    assert review["vendor_display_name"] == "Vendor"
    assert review["event_name"] == "Acceptance review event"


def test_get_client_own_reviews_requires_sign_in() -> None:
    """Anonymous listing is rejected."""
    browser = new_browser()
    response = browser.get(CLIENT_REVIEWS_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_get_client_own_reviews_forbidden_for_vendor_account(admin_db: LocalDatabase) -> None:
    """A vendor account cannot use the client reviews route."""
    account = seed_account(admin_db, unique_email("client-list-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.get(CLIENT_REVIEWS_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


# --- GET /vendor/reviews -----------------------------------------------------------------


def test_get_vendor_own_reviews_lists_a_visible_review(admin_db: LocalDatabase) -> None:
    """The vendor's own reviews list matches their public profile: visible reviews only."""
    client_account, vendor_account = _seed_pair(admin_db, "vendor-list")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    review_body = "Reliable and friendly, exactly what we needed on the day."
    _seed_review(
        admin_db,
        booking_id=booking_id,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        rating=5,
        body=review_body,
    )
    browser = sign_in(vendor_account)
    response = browser.get(VENDOR_REVIEWS_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["review_count"] == 1
    assert body["average_rating"] == 5.0
    review = body["reviews"][0]
    assert review["booking_request_id"] == booking_id
    assert review["body"] == review_body
    assert review["reviewer_display"] == _expected_reviewer_display(client_account.email)


def test_get_vendor_own_reviews_excludes_a_hidden_review(admin_db: LocalDatabase) -> None:
    """A review an admin has hidden does not appear on the vendor's own list."""
    client_account, vendor_account = _seed_pair(admin_db, "vendor-hidden")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    _seed_review(
        admin_db,
        booking_id=booking_id,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        hidden=True,
    )
    browser = sign_in(vendor_account)
    response = browser.get(VENDOR_REVIEWS_URL)
    assert response.status_code == 200
    body = response.json()
    assert body["review_count"] == 0
    assert body["reviews"] == []


def test_get_vendor_own_reviews_requires_sign_in() -> None:
    """Anonymous listing is rejected."""
    browser = new_browser()
    response = browser.get(VENDOR_REVIEWS_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_get_vendor_own_reviews_forbidden_for_client_account(admin_db: LocalDatabase) -> None:
    """A client account cannot use the vendor reviews route."""
    account = seed_account(admin_db, unique_email("vendor-list-client"), "client")
    browser = sign_in(account)
    response = browser.get(VENDOR_REVIEWS_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == VENDOR_PORTAL_FORBIDDEN


# --- GET/PATCH /admin/reviews* -------------------------------------------------------------


def test_admin_list_reviews_requires_sign_in() -> None:
    """Anonymous listing is rejected."""
    browser = new_browser()
    response = browser.get(ADMIN_REVIEWS_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_admin_list_reviews_forbidden_for_client_account(admin_db: LocalDatabase) -> None:
    """A client account cannot use the admin reviews route."""
    account = seed_account(admin_db, unique_email("admin-list-client"), "client")
    browser = sign_in(account)
    response = browser.get(ADMIN_REVIEWS_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == ADMIN_PORTAL_FORBIDDEN


def test_admin_list_reviews_includes_hidden_reviews_and_filters_by_vendor(admin_db: LocalDatabase, as_staff) -> None:
    """Admins see hidden reviews too (unlike the public/vendor lists), and can filter by vendor."""
    client_account, vendor_account = _seed_pair(admin_db, "admin-list")
    other_client, other_vendor = _seed_pair(admin_db, "admin-list-other")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    other_booking_id = _seed_booking(
        admin_db, client_user_id=other_client.user_id, vendor_user_id=other_vendor.user_id
    )
    hidden_review_id = _seed_review(
        admin_db,
        booking_id=booking_id,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        hidden=True,
    )
    _seed_review(
        admin_db,
        booking_id=other_booking_id,
        client_user_id=other_client.user_id,
        vendor_user_id=other_vendor.user_id,
    )
    response = as_staff.get(ADMIN_REVIEWS_URL, params={"vendor_user_id": vendor_account.user_id})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert [review["id"] for review in body["reviews"]] == [hidden_review_id]
    assert body["reviews"][0]["hidden_at"] is not None


def test_admin_get_review_detail_includes_booking_context(admin_db: LocalDatabase, as_staff) -> None:
    """The admin review detail includes the booking's event name, date and status."""
    client_account, vendor_account = _seed_pair(admin_db, "admin-detail")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    review_id = _seed_review(
        admin_db,
        booking_id=booking_id,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
    )
    response = as_staff.get(f"{ADMIN_REVIEWS_URL}/{review_id}")
    assert response.status_code == 200
    review = response.json()["review"]
    assert review["booking_event_name"] == "Acceptance review event"
    assert review["booking_status"] == "completed"


def test_admin_get_review_detail_not_found(as_staff) -> None:
    """A missing review id is a 404."""
    response = as_staff.get(f"{ADMIN_REVIEWS_URL}/{MISSING_ID}")
    assert response.status_code == 404
    assert response.json()["detail"] == REVIEW_NOT_FOUND


def test_admin_review_visibility_hides_and_writes_audit_log(admin_db: LocalDatabase, as_staff) -> None:
    """Hiding a review sets `hidden_at` and writes an `admin_audit_log` row."""
    client_account, vendor_account = _seed_pair(admin_db, "admin-hide")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    review_id = _seed_review(
        admin_db,
        booking_id=booking_id,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
    )
    response = as_staff.patch(f"{ADMIN_REVIEWS_URL}/{review_id}/visibility", json={"hidden": True})
    assert response.status_code == 200
    assert response.json() == {"success": True}
    stored = admin_db.table("booking_reviews").select("hidden_at").eq("id", review_id).execute().data[0]
    assert stored["hidden_at"] is not None
    audit_rows = (
        admin_db.table("admin_audit_log")
        .select("action, entity_type, entity_id")
        .eq("action", "review.hide")
        .eq("entity_id", review_id)
        .execute()
        .data
    )
    assert audit_rows
    assert audit_rows[0]["entity_type"] == "booking_review"


def test_admin_review_visibility_unhides(admin_db: LocalDatabase, as_staff) -> None:
    """Setting `hidden: false` clears `hidden_at` and logs a `review.unhide` action."""
    client_account, vendor_account = _seed_pair(admin_db, "admin-unhide")
    booking_id = _seed_booking(
        admin_db, client_user_id=client_account.user_id, vendor_user_id=vendor_account.user_id
    )
    review_id = _seed_review(
        admin_db,
        booking_id=booking_id,
        client_user_id=client_account.user_id,
        vendor_user_id=vendor_account.user_id,
        hidden=True,
    )
    response = as_staff.patch(f"{ADMIN_REVIEWS_URL}/{review_id}/visibility", json={"hidden": False})
    assert response.status_code == 200
    stored = admin_db.table("booking_reviews").select("hidden_at").eq("id", review_id).execute().data[0]
    assert stored["hidden_at"] is None
    audit_rows = (
        admin_db.table("admin_audit_log")
        .select("action")
        .eq("action", "review.unhide")
        .eq("entity_id", review_id)
        .execute()
        .data
    )
    assert audit_rows


def test_admin_review_visibility_on_missing_review_still_returns_success(as_staff) -> None:
    """BASELINE QUIRK: `set_review_hidden` always returns `True` (an update matching zero
    rows is not an error to supabase-py), so hiding a review id that doesn't exist still
    responds 200 `{"success": true}` - the `COULD_NOT_UPDATE_REVIEW_VISIBILITY` message is
    dead code on this path.
    """
    response = as_staff.patch(f"{ADMIN_REVIEWS_URL}/{MISSING_ID}/visibility", json={"hidden": True})
    assert response.status_code == 200
    assert response.json() == {"success": True}


def test_admin_review_visibility_requires_sign_in() -> None:
    """Anonymous visibility changes are rejected."""
    browser = new_browser()
    response = browser.patch(f"{ADMIN_REVIEWS_URL}/{MISSING_ID}/visibility", json={"hidden": True})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED
