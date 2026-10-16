"""Freeze: signing in and out, `/auth/me`, and the account-state refusals.

Owned by the `identity` slice. Messages are asserted verbatim because the web
app shows them to users as-is.
"""

from __future__ import annotations

import httpx
from support.database import LocalDatabase

from conftest import API, assert_session_cookies_touched, new_browser, present_access_token
from support.accounts import SeededAccount, close_account, seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
# The baseline always returns its "re-registered" variant for a wrong password.
CREDENTIALS_MISMATCH = (
    "We couldn't sign you in with those details. If you recently registered again with this email, "
    "use the password from your first sign-up, or reset your password."
)
UNVERIFIED = (
    "Verify your email before signing in. Check your inbox for the link we sent, or request a new one."
)
# BASELINE BUG: suspended clients/vendors are shown the *admin* suspension copy at sign-in
# (the admin check runs first). Frozen as-is; fix deliberately in the identity slice.
SUSPENDED_AT_SIGNIN = "This account is suspended. Contact a super admin if you need access."
DELETED_SIGNIN = "This account has been deleted. You can create a new account with the same email."


def sign_in_response(account: SeededAccount, password: str | None = None) -> httpx.Response:
    """POST /auth/signin from a fresh browser and return the raw response."""
    with new_browser() as browser:
        return browser.post(
            f"{API}/auth/signin", json={"email": account.email, "password": password or account.password}
        )


def test_me_without_a_session_is_401(anonymous: httpx.Client) -> None:
    response = anonymous.get(f"{API}/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_me_with_a_garbage_cookie_is_401(anonymous: httpx.Client) -> None:
    present_access_token(anonymous, "not-a-jwt")
    response = anonymous.get(f"{API}/auth/me")
    assert response.status_code == 401


def test_signin_sets_both_session_cookies(admin_db: LocalDatabase) -> None:
    client_account = seed_account(admin_db, unique_email("cookies"), "client")
    response = sign_in_response(client_account)
    assert response.status_code == 200
    assert_session_cookies_touched(response)
    body = response.json()
    assert body["success"] is True
    assert body["user"]["email"] == client_account.email
    assert body["user"]["user_type"] == "client"


def test_signin_with_wrong_password_is_401(admin_db: LocalDatabase) -> None:
    client_account = seed_account(admin_db, unique_email("wrong-password"), "client")
    response = sign_in_response(client_account, password="definitely-wrong-1")
    assert response.status_code == 401
    assert response.json()["detail"] == CREDENTIALS_MISMATCH


def test_me_returns_the_signed_in_client(as_client: httpx.Client, client_account: SeededAccount) -> None:
    response = as_client.get(f"{API}/auth/me")
    assert response.status_code == 200
    user = response.json()["user"]
    assert user["id"] == client_account.user_id
    assert user["email"] == client_account.email
    assert user["user_type"] == "client"
    assert user["account_suspended"] is False
    assert user["email_verified"] is True


def test_me_returns_vendor_type(as_vendor: httpx.Client) -> None:
    assert as_vendor.get(f"{API}/auth/me").json()["user"]["user_type"] == "vendor"


def test_me_returns_admin_role_from_the_users_row(as_staff: httpx.Client) -> None:
    user = as_staff.get(f"{API}/auth/me").json()["user"]
    assert (user["user_type"], user["admin_role"]) == ("admin", "admin")


def test_super_admin_role_from_the_users_row(as_super_admin: httpx.Client) -> None:
    user = as_super_admin.get(f"{API}/auth/me").json()["user"]
    assert (user["user_type"], user["admin_role"]) == ("admin", "super_admin")


def test_super_admin_role_falls_back_to_the_email_list(admin_db: LocalDatabase) -> None:
    # Fixed address: scripts/serve.sh puts it in SUPER_ADMIN_EMAILS. The row has no admin_role.
    account = seed_account(admin_db, "acceptance-super-admin@example.com", "admin")
    with new_browser() as browser:
        browser.post(f"{API}/auth/signin", json={"email": account.email, "password": account.password})
        user = browser.get(f"{API}/auth/me").json()["user"]
    assert (user["user_type"], user["admin_role"]) == ("admin", "super_admin")


def test_unverified_client_cannot_sign_in(admin_db: LocalDatabase) -> None:
    account = seed_account(admin_db, unique_email("unverified"), "client", verified=False)
    response = sign_in_response(account)
    assert response.status_code == 403
    assert response.json()["detail"] == UNVERIFIED


def test_suspended_client_cannot_sign_in(admin_db: LocalDatabase) -> None:
    account = seed_account(admin_db, unique_email("suspended"), "client", suspended=True)
    response = sign_in_response(account)
    assert response.status_code == 403
    assert response.json()["detail"] == SUSPENDED_AT_SIGNIN


def test_deleted_account_cannot_sign_in(admin_db: LocalDatabase) -> None:
    account = seed_account(admin_db, unique_email("deleted"), "client", deleted=True)
    response = sign_in_response(account)
    assert response.status_code == 401
    assert response.json()["detail"] == DELETED_SIGNIN


def test_account_deleted_after_sign_in_gets_401(admin_db: LocalDatabase) -> None:
    account = seed_account(admin_db, unique_email("closing"), "client")
    with new_browser() as browser:
        signed_in = browser.post(
            f"{API}/auth/signin", json={"email": account.email, "password": account.password}
        )
        assert signed_in.status_code == 200
        close_account(admin_db, account.user_id)
        response = browser.get(f"{API}/auth/me")
    assert response.status_code == 401
    assert response.json()["detail"] == "This account has been deleted."
    # BASELINE BUG: the baseline clears cookies on the injected Response and then raises,
    # which discards that Response, so no Set-Cookie reaches the browser. Frozen as-is.
    assert "set-cookie" not in response.headers


def test_signout_clears_the_session(admin_db: LocalDatabase) -> None:
    client_account = seed_account(admin_db, unique_email("signout"), "client")
    with new_browser() as browser:
        browser.post(
            f"{API}/auth/signin", json={"email": client_account.email, "password": client_account.password}
        )
        response = browser.post(f"{API}/auth/signout")
        assert response.status_code == 200
        assert response.json() == {"success": True}
        assert browser.get(f"{API}/auth/me").status_code == 401
