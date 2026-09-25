"""Freeze: the signed-in contact forms (client, vendor, and the admin bug report).

Owned by the `content` slice. Each submission is checked in `contact_submissions`
by its unique message text, so assertions never depend on other rows.
"""

from __future__ import annotations

import secrets
from collections.abc import Iterator
from typing import Any

import httpx
import pytest
from supabase import Client

from conftest import API, sign_in
from support.accounts import SeededAccount, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
MESSAGE_TOO_SHORT = "Please enter at least 10 characters."
INVALID_BOOKING_REFERENCE = "That booking reference doesn't look right."
BOOKING_NOT_FOUND = "Booking not found."
BOOKING_NOT_ON_ACCOUNT = "That booking is not on your account."
ADMIN_PORTAL_FORBIDDEN = (
    "This area is for admin accounts only. If you're a vendor or client, use the matching sign-in page."
)
VENDOR_PORTAL_FORBIDDEN = (
    "This page is for vendor accounts. "
    "If you offer services on Eventtz, create a vendor account or sign out and sign in again "
    "so we can refresh your account type. "
    "If you're planning an event, use client sign-in instead."
)
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. "
    "Sign in with a client account, or create one from the homepage."
)
# A syntactically valid UUID that no booking will ever have.
MISSING_BOOKING_ID = "00000000-0000-4000-8000-000000000000"


def unique_message(label: str) -> str:
    """A message long enough to pass validation and unique to this run."""
    return f"Acceptance {label} message {secrets.token_hex(6)}"


def stored_submission(admin_db: Client, message: str) -> dict[str, Any]:
    """The one `contact_submissions` row holding `message`."""
    result = admin_db.table("contact_submissions").select("*").eq("message", message).execute()
    assert len(result.data) == 1, f"expected one submission for {message!r}, found {len(result.data)}"
    return dict(result.data[0])


@pytest.fixture(scope="module")
def booking_id(
    admin_db: Client, client_account: SeededAccount, vendor_account: SeededAccount
) -> Iterator[str]:
    """A pending booking between the session client and vendor, removed afterwards."""
    inserted = (
        admin_db.table("booking_requests")
        .insert(
            {
                "client_user_id": client_account.user_id,
                "vendor_user_id": vendor_account.user_id,
                "event_name": "Acceptance contact booking",
                "event_date": "2099-01-01",
                "total_label": "£100",
            }
        )
        .execute()
    )
    new_booking_id = str(inserted.data[0]["id"])
    yield new_booking_id
    admin_db.table("contact_submissions").delete().eq("booking_id", new_booking_id).execute()
    admin_db.table("booking_requests").delete().eq("id", new_booking_id).execute()


# --- who may submit ------------------------------------------------------------------------


@pytest.mark.parametrize("portal", ["client", "vendor", "admin"])
def test_contact_needs_a_session(anonymous: httpx.Client, portal: str) -> None:
    response = anonymous.post(f"{API}/{portal}/contact", json={"message": unique_message("anon")})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


@pytest.mark.parametrize(
    ("portal_fixture", "path", "refusal"),
    [
        ("as_client", "/vendor/contact", VENDOR_PORTAL_FORBIDDEN),
        ("as_client", "/admin/contact", ADMIN_PORTAL_FORBIDDEN),
        ("as_vendor", "/client/contact", CLIENT_PORTAL_FORBIDDEN),
        ("as_staff", "/client/contact", CLIENT_PORTAL_FORBIDDEN),
    ],
    ids=["client-on-vendor", "client-on-admin", "vendor-on-client", "staff-on-client"],
)
def test_each_form_is_for_its_own_portal(
    portal_fixture: str, path: str, refusal: str, request: pytest.FixtureRequest
) -> None:
    browser: httpx.Client = request.getfixturevalue(portal_fixture)
    response = browser.post(f"{API}{path}", json={"message": unique_message("wrong portal")})
    assert response.status_code == 403
    assert response.json()["detail"] == refusal


# --- validation ------------------------------------------------------------------------------


def test_fewer_than_ten_characters_fails_validation(as_client: httpx.Client) -> None:
    assert as_client.post(f"{API}/client/contact", json={"message": "too short"}).status_code == 422


def test_padding_does_not_count_towards_the_minimum(as_client: httpx.Client) -> None:
    response = as_client.post(f"{API}/client/contact", json={"message": "   hi      "})
    assert response.status_code == 400
    assert response.json()["detail"] == MESSAGE_TOO_SHORT


def test_more_than_5000_characters_fails_validation(as_client: httpx.Client) -> None:
    assert as_client.post(f"{API}/client/contact", json={"message": "x" * 5001}).status_code == 422


# --- successful submissions ------------------------------------------------------------------------


@pytest.mark.parametrize("portal", ["client", "vendor"])
def test_portal_submission_is_stored_under_other(
    portal: str,
    request: pytest.FixtureRequest,
    admin_db: Client,
) -> None:
    browser: httpx.Client = request.getfixturevalue(f"as_{portal}")
    account: SeededAccount = request.getfixturevalue(f"{portal}_account")
    message = unique_message(portal)
    response = browser.post(
        f"{API}/{portal}/contact", json={"message": f"  {message}  ", "booking_id": "   "}
    )
    assert response.status_code == 200
    assert response.json() == {"success": True}
    row = stored_submission(admin_db, message)
    assert row["user_id"] == account.user_id
    assert row["portal"] == portal
    # With no language model configured the classifier falls back to "other".
    assert row["subject"] == "Other"
    assert row["booking_id"] is None


def test_admin_bug_report_is_always_a_bug_report(
    as_staff: httpx.Client, staff_account: SeededAccount, admin_db: Client
) -> None:
    message = unique_message("admin bug")
    response = as_staff.post(
        f"{API}/admin/contact", json={"message": message, "booking_id": MISSING_BOOKING_ID}
    )
    assert response.status_code == 200
    assert response.json() == {"success": True}
    row = stored_submission(admin_db, message)
    assert row["user_id"] == staff_account.user_id
    assert row["portal"] == "admin"
    assert row["subject"] == "Bug report"
    # The admin form has no booking field; an extra one is ignored.
    assert row["booking_id"] is None


# --- booking references -----------------------------------------------------------------------------


def test_a_malformed_booking_reference_is_rejected(as_client: httpx.Client) -> None:
    response = as_client.post(
        f"{API}/client/contact", json={"message": unique_message("bad ref"), "booking_id": "BK-123"}
    )
    assert response.status_code == 400
    assert response.json()["detail"] == INVALID_BOOKING_REFERENCE


def test_an_unknown_booking_is_rejected(as_client: httpx.Client) -> None:
    response = as_client.post(
        f"{API}/client/contact",
        json={"message": unique_message("unknown ref"), "booking_id": MISSING_BOOKING_ID},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == BOOKING_NOT_FOUND


@pytest.mark.parametrize("portal", ["client", "vendor"])
def test_a_party_to_the_booking_may_reference_it(
    portal: str, booking_id: str, request: pytest.FixtureRequest, admin_db: Client
) -> None:
    browser: httpx.Client = request.getfixturevalue(f"as_{portal}")
    message = unique_message(f"{portal} booking")
    response = browser.post(
        f"{API}/{portal}/contact", json={"message": message, "booking_id": f" {booking_id} "}
    )
    assert response.status_code == 200
    assert stored_submission(admin_db, message)["booking_id"] == booking_id


def test_someone_elses_booking_is_rejected(booking_id: str, admin_db: Client) -> None:
    stranger = seed_account(admin_db, unique_email("contact-stranger"), "client")
    browser = sign_in(stranger)
    try:
        response = browser.post(
            f"{API}/client/contact", json={"message": unique_message("stranger"), "booking_id": booking_id}
        )
    finally:
        browser.close()
    assert response.status_code == 400
    assert response.json()["detail"] == BOOKING_NOT_ON_ACCOUNT
