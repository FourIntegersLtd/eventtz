"""Freeze: contact-sharing settings, client onboarding, and self-service account deletion.

Owned by the `settings` slice, mounted at `/api/v1/user` (contact settings, deletion) and
`/api/v1/client` (onboarding). Every account used here is seeded fresh with `seed_account`
so destructive tests (deletion) never touch the shared session fixtures.
"""

from __future__ import annotations

import contextlib
from collections.abc import Iterator

import httpx
from supabase import Client

from conftest import API, new_browser
from support.accounts import seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. "
    "Sign in with a client account, or create one from the homepage."
)
CURRENT_PASSWORD_INCORRECT = "Current password is incorrect."
ACCOUNT_DELETE_ADMIN = "Staff accounts cannot be deleted here. Ask a super admin to remove team access."
ACCOUNT_DELETED = "Your Eventtz account has been deleted."

CONTACT_SETTINGS_URL = f"{API}/user/contact-settings"
ACCOUNT_DELETION_URL = f"{API}/user/account/deletion"
ONBOARDING_URL = f"{API}/client/onboarding"


@contextlib.contextmanager
def _fresh_signed_in_browser(
    admin_db: Client, label: str, user_type: str = "client"
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


def test_get_contact_settings_defaults_for_a_new_account(admin_db: Client) -> None:
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


def test_put_contact_settings_updates_and_persists_for_a_client(admin_db: Client) -> None:
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


def test_put_contact_settings_ignores_phone_and_address_for_a_vendor(admin_db: Client) -> None:
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


def test_get_onboarding_forbidden_for_a_vendor(admin_db: Client) -> None:
    """Onboarding is client-only; a signed-in vendor is refused with the client-portal message."""
    with _fresh_signed_in_browser(admin_db, "onboarding-vendor", "vendor") as browser:
        response = browser.get(ONBOARDING_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_get_onboarding_defaults_for_a_new_client(admin_db: Client) -> None:
    """A brand-new client has not completed onboarding and has no preferred name yet."""
    with _fresh_signed_in_browser(admin_db, "onboarding-defaults") as browser:
        response = browser.get(ONBOARDING_URL)
    assert response.status_code == 200
    assert response.json()["onboarding"] == {"completed": False, "preferred_name": None}


def test_patch_onboarding_sets_preferred_name_and_marks_completed(admin_db: Client) -> None:
    """Patching preferred_name and mark_completed=true persists both, visible on a later GET."""
    with _fresh_signed_in_browser(admin_db, "onboarding-patch") as browser:
        patch_response = browser.patch(
            ONBOARDING_URL, json={"preferred_name": "Jordan", "mark_completed": True}
        )
        assert patch_response.status_code == 200
        assert patch_response.json()["onboarding"] == {"completed": True, "preferred_name": "Jordan"}

        get_response = browser.get(ONBOARDING_URL)
    assert get_response.json()["onboarding"] == {"completed": True, "preferred_name": "Jordan"}


def test_patch_onboarding_with_a_blank_preferred_name_clears_it(admin_db: Client) -> None:
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


def test_account_deletion_with_the_wrong_password_is_400(admin_db: Client) -> None:
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


def test_account_deletion_happy_path_tombstones_the_account(admin_db: Client) -> None:
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
