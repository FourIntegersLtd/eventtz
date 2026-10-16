"""Freeze: contact-sharing settings, client onboarding, and self-service account deletion.

Owned by the `settings` slice, mounted at `/api/v1/user` (contact settings, deletion) and
`/api/v1/client` (onboarding). Every account used here is seeded fresh with `seed_account`
so destructive tests (deletion) never touch the shared session fixtures.
"""

from __future__ import annotations

import contextlib
import uuid
from collections.abc import Iterator

import httpx
from support.database import LocalDatabase

from conftest import API, new_browser, sign_in
from support.accounts import SeededAccount, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. "
    "Sign in with a client account, or create one from the homepage."
)
CURRENT_PASSWORD_INCORRECT = "Current password is incorrect."
ACCOUNT_DELETE_ADMIN = "Staff accounts cannot be deleted here. Ask a super admin to remove team access."
ACCOUNT_DELETED = "Your Eventtz account has been deleted."
ACCOUNT_DELETE_MONEY = (
    "You have a booking with payment still in progress. "
    "Finish payout or wait for a refund, then try again."
)
ACCOUNT_DELETE_ACTIVE = (
    "You have an accepted booking that has not happened yet. "
    "Complete or cancel it first, then try again."
)
ACCOUNT_DELETE_DISPUTE = "You have an open problem report. Wait until it is resolved, then try again."
REDACTED_MESSAGE_BODY = "[Deleted]"

CONTACT_SETTINGS_URL = f"{API}/user/contact-settings"
ACCOUNT_DELETION_URL = f"{API}/user/account/deletion"
ONBOARDING_URL = f"{API}/client/onboarding"


@contextlib.contextmanager
def _fresh_signed_in_browser(
    admin_db: LocalDatabase, label: str, user_type: str = "client"
) -> Iterator[httpx.Client]:
    """A brand-new account of `user_type`, signed in on its own browser, closed on exit.

    Yields the browser rather than opening it as an `httpx.Client` context manager itself,
    because signing in already sends a request (which marks the client "opened"); entering
    it again with `with browser:` would raise.
    """
    account = seed_account(admin_db, unique_email(label), user_type)
    browser = new_browser()
    try:
        signed_in = browser.post(
            f"{API}/auth/signin", json={"email": account.email, "password": account.password}
        )
        assert signed_in.status_code == 200
        yield browser
    finally:
        browser.close()


def test_get_contact_settings_without_a_session_is_401() -> None:
    """GET /user/contact-settings requires sign-in."""
    with new_browser() as browser:
        response = browser.get(CONTACT_SETTINGS_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_get_contact_settings_defaults_for_a_new_account(admin_db: LocalDatabase) -> None:
    """A brand-new account has never set contact preferences, so all three shares default true."""
    with _fresh_signed_in_browser(admin_db, "contact-defaults") as browser:
        response = browser.get(CONTACT_SETTINGS_URL)
    assert response.status_code == 200
    settings = response.json()["settings"]
    assert settings == {
        "contact_phone": None,
        "share_email": True,
        "share_phone": True,
        "share_address": True,
    }


def test_put_contact_settings_updates_and_persists_for_a_client(admin_db: LocalDatabase) -> None:
    """A client can set their contact phone and toggle sharing; a later GET reflects it."""
    with _fresh_signed_in_browser(admin_db, "contact-put-client") as browser:
        put_response = browser.put(
            CONTACT_SETTINGS_URL,
            json={
                "contact_phone": "07700 900123",
                "share_email": False,
                "share_phone": True,
                "share_address": False,
            },
        )
        assert put_response.status_code == 200
        settings = put_response.json()["settings"]
        assert settings["contact_phone"] == "07700 900123"
        assert settings["share_email"] is False
        assert settings["share_address"] is False

        get_response = browser.get(CONTACT_SETTINGS_URL)
    assert get_response.json()["settings"] == settings


def test_put_contact_settings_ignores_phone_and_address_for_a_vendor(admin_db: LocalDatabase) -> None:
    """Vendors take their phone/address from `vendors.payload`, so the settings PUT silently
    drops `contact_phone` and `share_address` for a vendor caller (only `share_email`/`share_phone`
    are writable), per `update_contact_settings`'s `is_vendor` guard.
    """
    with _fresh_signed_in_browser(admin_db, "contact-put-vendor", "vendor") as browser:
        response = browser.put(
            CONTACT_SETTINGS_URL,
            json={"contact_phone": "07700 900999", "share_phone": False, "share_address": False},
        )
    assert response.status_code == 200
    settings = response.json()["settings"]
    assert settings["contact_phone"] is None
    assert settings["share_phone"] is False
    assert settings["share_address"] is True


def test_put_contact_settings_without_a_session_is_401() -> None:
    """PUT /user/contact-settings requires sign-in."""
    with new_browser() as browser:
        response = browser.put(CONTACT_SETTINGS_URL, json={"share_email": False})
    assert response.status_code == 401


def test_get_onboarding_without_a_session_is_401() -> None:
    """GET /client/onboarding requires sign-in."""
    with new_browser() as browser:
        response = browser.get(ONBOARDING_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_get_onboarding_forbidden_for_a_vendor(admin_db: LocalDatabase) -> None:
    """Onboarding is client-only; a signed-in vendor is refused with the client-portal message."""
    with _fresh_signed_in_browser(admin_db, "onboarding-vendor", "vendor") as browser:
        response = browser.get(ONBOARDING_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_get_onboarding_defaults_for_a_new_client(admin_db: LocalDatabase) -> None:
    """A brand-new client has not completed onboarding and has no preferred name yet."""
    with _fresh_signed_in_browser(admin_db, "onboarding-defaults") as browser:
        response = browser.get(ONBOARDING_URL)
    assert response.status_code == 200
    assert response.json()["onboarding"] == {"completed": False, "preferred_name": None}


def test_patch_onboarding_sets_preferred_name_and_marks_completed(admin_db: LocalDatabase) -> None:
    """Patching preferred_name and mark_completed=true persists both, visible on a later GET."""
    with _fresh_signed_in_browser(admin_db, "onboarding-patch") as browser:
        patch_response = browser.patch(
            ONBOARDING_URL, json={"preferred_name": "Jordan", "mark_completed": True}
        )
        assert patch_response.status_code == 200
        assert patch_response.json()["onboarding"] == {"completed": True, "preferred_name": "Jordan"}

        get_response = browser.get(ONBOARDING_URL)
    assert get_response.json()["onboarding"] == {"completed": True, "preferred_name": "Jordan"}


def test_patch_onboarding_with_a_blank_preferred_name_clears_it(admin_db: LocalDatabase) -> None:
    """A whitespace-only preferred_name is stripped down to nothing and stored as null."""
    with _fresh_signed_in_browser(admin_db, "onboarding-blank") as browser:
        browser.patch(ONBOARDING_URL, json={"preferred_name": "Alex"})
        response = browser.patch(ONBOARDING_URL, json={"preferred_name": "   "})
    assert response.status_code == 200
    assert response.json()["onboarding"]["preferred_name"] is None


def test_account_deletion_without_a_session_is_401() -> None:
    """POST /user/account/deletion requires sign-in."""
    with new_browser() as browser:
        response = browser.post(ACCOUNT_DELETION_URL, json={"password": "whatever-1"})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_account_deletion_with_the_wrong_password_is_400(admin_db: LocalDatabase) -> None:
    """Deletion is gated on re-entering the current password; a wrong one refuses the request
    and leaves the account untouched.
    """
    with _fresh_signed_in_browser(admin_db, "delete-wrong-password") as browser:
        response = browser.post(ACCOUNT_DELETION_URL, json={"password": "definitely-wrong-1"})
    assert response.status_code == 400
    assert response.json()["detail"] == CURRENT_PASSWORD_INCORRECT


def test_account_deletion_is_forbidden_for_an_admin_account(as_staff: httpx.Client) -> None:
    """Staff accounts cannot self-delete here, refused before any password check - safe to run
    against the shared `as_staff` session because the refusal happens first and nothing is deleted.
    """
    response = as_staff.post(ACCOUNT_DELETION_URL, json={"password": "irrelevant-1"})
    assert response.status_code == 403
    assert response.json()["detail"] == ACCOUNT_DELETE_ADMIN


def test_account_deletion_happy_path_tombstones_the_account(admin_db: LocalDatabase) -> None:
    """A fresh client account with no bookings can delete itself: cookies are cleared, the
    session stops working, and `public.users` is tombstoned (deleted_at set, email wiped).
    """
    account = seed_account(admin_db, unique_email("delete-happy"), "client")
    browser = new_browser()
    try:
        signed_in = browser.post(
            f"{API}/auth/signin", json={"email": account.email, "password": account.password}
        )
        assert signed_in.status_code == 200
        response = browser.post(ACCOUNT_DELETION_URL, json={"password": account.password})
        assert response.status_code == 200
        assert response.json()["message"] == ACCOUNT_DELETED
        assert browser.get(f"{API}/auth/me").status_code == 401
    finally:
        browser.close()

    row = admin_db.table("users").select("deleted_at,email").eq("id", account.user_id).execute().data[0]
    assert row["deleted_at"] is not None
    assert row["email"] is None


# --- deletion gates and erasure ---------------------------------------------------------------


def _seed_booking(
    admin_db: LocalDatabase,
    *,
    client_user_id: str,
    vendor_user_id: str,
    status: str = "pending",
    payment_status: str = "unpaid",
    event_date: str = "2099-06-01",
    notes: str | None = None,
) -> str:
    """A bare `booking_requests` row between two seeded accounts."""
    row: dict[str, object] = {
        "client_user_id": client_user_id,
        "vendor_user_id": vendor_user_id,
        "event_name": "Acceptance deletion test",
        "event_date": event_date,
        "status": status,
        "payment_status": payment_status,
        "total_label": "GBP 150",
    }
    if notes is not None:
        row["notes"] = notes
    return str(admin_db.table("booking_requests").insert(row).execute().data[0]["id"])


def _seed_pair(admin_db: LocalDatabase, label: str) -> tuple[SeededAccount, SeededAccount]:
    """A fresh client and vendor account."""
    return (
        seed_account(admin_db, unique_email(f"{label}-client"), "client"),
        seed_account(admin_db, unique_email(f"{label}-vendor"), "vendor"),
    )


def _delete(account: SeededAccount) -> httpx.Response:
    """Sign in as `account` and ask to delete it with its real password."""
    browser = sign_in(account)
    try:
        return browser.post(ACCOUNT_DELETION_URL, json={"password": account.password})
    finally:
        browser.close()


def _assert_refused(response: httpx.Response, *, code: str, detail: str) -> None:
    """A 409 gate refusal with a stable `code` and the exact copy."""
    assert response.status_code == 409
    body = response.json()
    assert body["detail"] == detail
    assert body["code"] == code


def _assert_account_untouched(admin_db: LocalDatabase, account: SeededAccount) -> None:
    """The `users` row is not tombstoned."""
    row = admin_db.table("users").select("deleted_at,email").eq("id", account.user_id).execute().data[0]
    assert row["deleted_at"] is None
    assert row["email"] == account.email


def test_account_deletion_is_blocked_while_money_is_in_flight(admin_db: LocalDatabase) -> None:
    """A paid booking (payout not yet made) refuses deletion and leaves the account intact."""
    client, vendor = _seed_pair(admin_db, "delete-money")
    _seed_booking(
        admin_db, client_user_id=client.user_id, vendor_user_id=vendor.user_id,
        status="accepted", payment_status="paid",
    )
    _assert_refused(_delete(client), code="money_in_flight", detail=ACCOUNT_DELETE_MONEY)
    _assert_account_untouched(admin_db, client)


def test_account_deletion_is_blocked_by_an_accepted_booking_before_the_event(admin_db: LocalDatabase) -> None:
    """An accepted, unpaid booking whose event day has not passed refuses deletion."""
    client, vendor = _seed_pair(admin_db, "delete-active")
    _seed_booking(
        admin_db, client_user_id=client.user_id, vendor_user_id=vendor.user_id, status="accepted",
    )
    _assert_refused(_delete(client), code="active_booking", detail=ACCOUNT_DELETE_ACTIVE)
    _assert_account_untouched(admin_db, client)


def test_account_deletion_is_blocked_by_an_open_dispute(admin_db: LocalDatabase) -> None:
    """An open dispute on a finished booking refuses deletion."""
    client, vendor = _seed_pair(admin_db, "delete-dispute")
    booking_id = _seed_booking(
        admin_db, client_user_id=client.user_id, vendor_user_id=vendor.user_id,
        status="accepted", event_date="2020-01-01",
    )
    admin_db.table("dispute_cases").insert(
        {
            "booking_request_id": booking_id,
            "opened_by_user_id": client.user_id,
            "status": "open",
            "summary": "Seeded for the deletion gate.",
        }
    ).execute()
    _assert_refused(_delete(client), code="open_dispute", detail=ACCOUNT_DELETE_DISPUTE)
    _assert_account_untouched(admin_db, client)


def test_account_deletion_gates_apply_to_vendors_too(admin_db: LocalDatabase) -> None:
    """The vendor side of a paid booking is blocked with the same money gate."""
    client, vendor = _seed_pair(admin_db, "delete-vendor-gate")
    _seed_booking(
        admin_db, client_user_id=client.user_id, vendor_user_id=vendor.user_id,
        status="accepted", payment_status="paid",
    )
    _assert_refused(_delete(vendor), code="money_in_flight", detail=ACCOUNT_DELETE_MONEY)
    _assert_account_untouched(admin_db, vendor)


def test_account_deletion_cancels_pending_unpaid_bookings(admin_db: LocalDatabase) -> None:
    """A pending unpaid booking does not block deletion; it is cancelled by the client."""
    client, vendor = _seed_pair(admin_db, "delete-cancel")
    booking_id = _seed_booking(admin_db, client_user_id=client.user_id, vendor_user_id=vendor.user_id)
    response = _delete(client)
    assert response.status_code == 200
    assert response.json()["message"] == ACCOUNT_DELETED
    row = (
        admin_db.table("booking_requests").select("status,cancelled_by,cancelled_at")
        .eq("id", booking_id).execute().data[0]
    )
    assert row["status"] == "cancelled"
    assert row["cancelled_by"] == "client"
    assert row["cancelled_at"] is not None


def test_account_deletion_erases_personal_rows(admin_db: LocalDatabase) -> None:
    """Messages are redacted; saved vendors, notifications and contact submissions are removed;
    the booking row stays with its notes cleared.
    """
    client, vendor = _seed_pair(admin_db, "delete-erase")
    booking_id = _seed_booking(
        admin_db, client_user_id=client.user_id, vendor_user_id=vendor.user_id,
        status="declined", notes="private client note",
    )
    conversation_id = admin_db.table("conversations").insert(
        {"kind": "dm", "client_user_id": client.user_id, "vendor_user_id": vendor.user_id}
    ).execute().data[0]["id"]
    message_id = admin_db.table("messages").insert(
        {"conversation_id": conversation_id, "sender_user_id": client.user_id, "body": "my phone is 0123"}
    ).execute().data[0]["id"]
    admin_db.table("client_saved_vendors").insert(
        {"client_user_id": client.user_id, "vendor_user_id": vendor.user_id}
    ).execute()
    admin_db.table("booking_notifications").insert(
        {"user_id": client.user_id, "booking_id": booking_id, "kind": "booking_declined_by_vendor", "body": "x"}
    ).execute()
    admin_db.table("contact_submissions").insert(
        {"user_id": client.user_id, "portal": "client", "subject": "Hi", "message": "erase me"}
    ).execute()

    assert _delete(client).status_code == 200

    message = admin_db.table("messages").select("body").eq("id", message_id).execute().data[0]
    assert message["body"] == REDACTED_MESSAGE_BODY
    for table, column in (
        ("client_saved_vendors", "client_user_id"),
        ("booking_notifications", "user_id"),
        ("contact_submissions", "user_id"),
    ):
        assert admin_db.table(table).select("id").eq(column, client.user_id).execute().data == []
    booking = admin_db.table("booking_requests").select("notes").eq("id", booking_id).execute().data
    assert booking == [{"notes": None}]


def test_account_deletion_tombstone_is_not_restored_by_signup(admin_db: LocalDatabase) -> None:
    """Signing up again with a deleted account's email makes a new user; the tombstone stays."""
    account = seed_account(admin_db, unique_email("delete-resignup"), "client")
    assert _delete(account).status_code == 200
    with new_browser() as browser:
        signup = browser.post(
            f"{API}/auth/signup",
            json={"email": account.email, "password": "correct-horse-1", "user_type": "client"},
        )
    assert signup.status_code == 200
    new_user_id = signup.json()["user"]["id"]
    assert new_user_id != account.user_id
    old_row = admin_db.table("users").select("deleted_at,email").eq("id", account.user_id).execute().data[0]
    assert old_row["deleted_at"] is not None
    assert old_row["email"] is None
    new_row = admin_db.table("users").select("deleted_at").eq("id", new_user_id).execute().data[0]
    assert new_row["deleted_at"] is None


def test_account_deletion_suspended_account_is_refused(admin_db: LocalDatabase) -> None:
    """# BASELINE QUIRK: a suspended account that is already signed in cannot self-delete; the
    session check refuses every request first (403), so suspension traps the account.
    """
    account = seed_account(admin_db, unique_email("delete-suspended"), "client")
    browser = sign_in(account)
    admin_db.table("users").update({"account_suspended": True}).eq("id", account.user_id).execute()
    try:
        response = browser.post(ACCOUNT_DELETION_URL, json={"password": account.password})
    finally:
        browser.close()
    assert response.status_code == 403
    assert response.json()["detail"] == (
        "Your account has been suspended. Contact support if you think this is a mistake."
    )
    row = admin_db.table("users").select("deleted_at").eq("id", account.user_id).execute().data[0]
    assert row["deleted_at"] is None


def test_account_deletion_vendor_listing_is_wiped(admin_db: LocalDatabase) -> None:
    """A deleted vendor's row is blanked, hidden and Stripe-detached, and leaves public explore."""
    vendor = seed_account(admin_db, unique_email("delete-wipe"), "vendor")
    business_name = f"Acceptance Wipe {uuid.uuid4().hex[:8]}"
    admin_db.table("vendors").insert(
        {
            "user_id": vendor.user_id,
            "status": "complete",
            "approval_status": "approved",
            "payload": {"businessName": business_name, "baseCity": "London", "servicesOffered": ["catering"]},
            "country_code": "GB",
            "base_city_normalized": "london",
            "services_offered": ["catering"],
            "min_list_price_gbp": 100,
            "stripe_account_id": "acct_fake_deletion",
            "stripe_charges_enabled": True,
            "stripe_payouts_enabled": True,
        }
    ).execute()

    def listed_names() -> list[str]:
        """Business names currently shown on the public explore page."""
        with new_browser() as browser:
            vendors = browser.get(f"{API}/vendors/explore").json()["vendors"]
        return [
            row["profile_form_data"].get("businessName")
            for row in vendors
            if isinstance(row.get("profile_form_data"), dict)
        ]

    assert business_name in listed_names()
    assert _delete(vendor).status_code == 200
    row = (
        admin_db.table("vendors")
        .select("payload,stripe_account_id,stripe_charges_enabled,stripe_payouts_enabled,"
                "listing_override,listing_override_reason,listing_override_by")
        .eq("user_id", vendor.user_id).execute().data[0]
    )
    assert row == {
        "payload": {},
        "stripe_account_id": None,
        "stripe_charges_enabled": False,
        "stripe_payouts_enabled": False,
        "listing_override": "hidden",
        "listing_override_reason": "Account deleted",
        "listing_override_by": None,
    }
    assert business_name not in listed_names()
