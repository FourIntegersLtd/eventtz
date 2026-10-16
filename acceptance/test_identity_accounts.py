"""Freeze: signup, refresh, forgot/reset password, resend/verify email, change password.

Owned by the `identity` slice. Messages are asserted verbatim because the web app shows
them to users as-is. Real emails never leave this environment (`RESEND_API_KEY=""`), so
the one-click tokens for reset-password and verify-email are seeded straight into local
Supabase via `support.tokens`, standing in for the link a real email would carry.
"""

from __future__ import annotations

import contextlib
from collections.abc import Iterator

import httpx
from support.database import LocalDatabase

from conftest import API, assert_session_cookies_touched, new_browser
from support.accounts import SeededAccount, seed_account, unique_email
from support.tokens import seed_email_verification_token, seed_password_reset_token

SIGNUP_VERIFY_MESSAGE = "Account created."
SIGNUP_EMAIL_EXISTS = (
    "An account with this email already exists. "
    "Try signing in instead, or use Forgot password to set a new one."
)
REFRESH_SESSION_EXPIRED = "Your session has expired. Please sign in again."
GENERIC_FORGOT_MESSAGE = (
    "If an account exists for that email, we sent a link to reset your password. "
    "Check your inbox (and spam) for an email from Eventtz."
)
GENERIC_RESEND_MESSAGE = (
    "If an account exists for that email and still needs verification, "
    "we sent a new link. Check your inbox (and spam) for an email from Eventtz."
)
RESET_LINK_INVALID = "This reset link is invalid or has expired. Request a new one."
RESET_LINK_USED = "This reset link has already been used. Request a new one."
VERIFICATION_LINK_INVALID = "This verification link is invalid or has expired. Request a new one."
EMAIL_VERIFIED_SIGN_IN = "Email verified. You can sign in now."
CURRENT_PASSWORD_INCORRECT = "Current password is incorrect."
PASSWORD_MUST_DIFFER = "Choose a new password that is different from your current one."
PASSWORD_UPDATED_REAUTH = "Password updated. Sign in again with your new password."
SIGN_IN_REQUIRED = "Please sign in to continue."


def test_signup_creates_an_unverified_account_and_returns_the_verify_message(admin_db: LocalDatabase) -> None:
    """POST /auth/signup pins the 200 body shape and leaves the new user unverified in the DB."""
    email = unique_email("signup")
    with new_browser() as browser:
        response = browser.post(
            f"{API}/auth/signup",
            json={"email": email, "password": "correct-horse-1", "user_type": "client"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["message"] == SIGNUP_VERIFY_MESSAGE
    assert body["session"] is None
    assert body["user"]["email"] == email
    assert body["user"]["user_type"] == "client"

    rows = admin_db.table("users").select("email_verified_at,user_type").eq("email", email).execute().data
    assert len(rows) == 1
    assert rows[0]["email_verified_at"] is None
    assert rows[0]["user_type"] == "client"


def test_signup_can_register_a_vendor(admin_db: LocalDatabase) -> None:
    """POST /auth/signup with user_type=vendor stores a vendor-typed profile row."""
    email = unique_email("signup-vendor")
    with new_browser() as browser:
        response = browser.post(
            f"{API}/auth/signup",
            json={"email": email, "password": "correct-horse-1", "user_type": "vendor"},
        )
    assert response.status_code == 200
    assert response.json()["user"]["user_type"] == "vendor"
    row = admin_db.table("users").select("user_type").eq("email", email).execute().data[0]
    assert row["user_type"] == "vendor"


def test_signup_with_an_already_registered_email_is_400(admin_db: LocalDatabase) -> None:
    """A second signup with the same email is refused with the enumeration-revealing message."""
    email = unique_email("signup-dup")
    seed_account(admin_db, email, "client")
    with new_browser() as browser:
        response = browser.post(
            f"{API}/auth/signup",
            json={"email": email, "password": "correct-horse-1", "user_type": "client"},
        )
    assert response.status_code == 400
    assert response.json()["detail"] == SIGNUP_EMAIL_EXISTS


def test_signup_with_a_short_password_is_a_422_validation_error() -> None:
    """Pydantic enforces the 6-character password minimum before any auth call is made."""
    with new_browser() as browser:
        response = browser.post(
            f"{API}/auth/signup",
            json={"email": unique_email("signup-short"), "password": "abc", "user_type": "client"},
        )
    assert response.status_code == 422


def test_refresh_without_any_token_is_401() -> None:
    """POST /auth/refresh with no body and no refresh cookie is refused."""
    with new_browser() as browser:
        response = browser.post(f"{API}/auth/refresh", json={})
    assert response.status_code == 401
    assert response.json()["detail"] == REFRESH_SESSION_EXPIRED


def test_refresh_with_a_garbage_token_is_401() -> None:
    """POST /auth/refresh with a refresh_token that Supabase does not recognise is refused."""
    with new_browser() as browser:
        response = browser.post(f"{API}/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert response.status_code == 401


def test_refresh_with_the_session_cookie_issues_a_new_session(admin_db: LocalDatabase) -> None:
    """The refresh cookie set by sign-in is enough to mint a fresh access/refresh pair."""
    account = seed_account(admin_db, unique_email("refresh"), "client")
    with new_browser() as browser:
        signed_in = browser.post(
            f"{API}/auth/signin", json={"email": account.email, "password": account.password}
        )
        assert signed_in.status_code == 200
        response = browser.post(f"{API}/auth/refresh", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["user"]["email"] == account.email
    assert body["session"]["access_token"]
    assert body["session"]["refresh_token"]


def test_forgot_password_returns_the_same_generic_message_for_a_real_or_unknown_email(
    admin_db: LocalDatabase,
) -> None:
    """Enumeration-safe: an existing account and a made-up address get identical responses."""
    account = seed_account(admin_db, unique_email("forgot"), "client")
    with new_browser() as browser:
        known = browser.post(f"{API}/auth/forgot-password", json={"email": account.email})
        unknown = browser.post(f"{API}/auth/forgot-password", json={"email": unique_email("no-such-user")})
    assert known.status_code == 200
    assert unknown.status_code == 200
    assert known.json()["message"] == GENERIC_FORGOT_MESSAGE
    assert unknown.json()["message"] == GENERIC_FORGOT_MESSAGE


def test_reset_password_with_a_seeded_token_signs_the_user_in_with_the_new_password(
    admin_db: LocalDatabase,
) -> None:
    """Happy path built from a token seeded straight into `password_reset_tokens` (no email is sent
    in this environment, so the raw token from the link can only be recreated, not observed over HTTP).
    """
    account = seed_account(admin_db, unique_email("reset-happy"), "client")
    raw_token = seed_password_reset_token(admin_db, account.user_id)
    with new_browser() as browser:
        response = browser.post(
            f"{API}/auth/reset-password",
            json={"token": raw_token, "password": "brand-new-pass-1"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["user"]["email"] == account.email
    assert body["session"]["access_token"]
    assert_session_cookies_touched(response)

    token_row = (
        admin_db.table("password_reset_tokens")
        .select("used_at")
        .eq("user_id", account.user_id)
        .execute()
        .data[0]
    )
    assert token_row["used_at"] is not None

    with new_browser() as browser:
        signed_in = browser.post(
            f"{API}/auth/signin", json={"email": account.email, "password": "brand-new-pass-1"}
        )
    assert signed_in.status_code == 200


def test_reset_password_with_an_unknown_token_is_400() -> None:
    """A token that was never issued is refused with the generic invalid-link message."""
    with new_browser() as browser:
        response = browser.post(
            f"{API}/auth/reset-password",
            json={"token": "x" * 32, "password": "brand-new-pass-1"},
        )
    assert response.status_code == 400
    assert response.json()["detail"] == RESET_LINK_INVALID


def test_reset_password_with_an_already_used_token_is_400(admin_db: LocalDatabase) -> None:
    """A token marked used_at is refused with the distinct already-used message."""
    account = seed_account(admin_db, unique_email("reset-used"), "client")
    raw_token = seed_password_reset_token(admin_db, account.user_id, used=True)
    with new_browser() as browser:
        response = browser.post(
            f"{API}/auth/reset-password",
            json={"token": raw_token, "password": "brand-new-pass-1"},
        )
    assert response.status_code == 400
    assert response.json()["detail"] == RESET_LINK_USED


def test_reset_password_with_an_expired_token_is_400(admin_db: LocalDatabase) -> None:
    """A token past its expiry falls back to the generic invalid-link message, not "used"."""
    account = seed_account(admin_db, unique_email("reset-expired"), "client")
    raw_token = seed_password_reset_token(admin_db, account.user_id, expires_in_minutes=-5)
    with new_browser() as browser:
        response = browser.post(
            f"{API}/auth/reset-password",
            json={"token": raw_token, "password": "brand-new-pass-1"},
        )
    assert response.status_code == 400
    assert response.json()["detail"] == RESET_LINK_INVALID


def test_reset_password_with_a_password_under_the_pydantic_minimum_is_422(admin_db: LocalDatabase) -> None:
    """`ResetPasswordRequest.password` has `min_length=6`, the same floor as the domain password
    policy, so a too-short password never reaches `validate_password_for_user` - FastAPI's request
    validation rejects it first with a 422, before the token is even looked up.
    """
    account = seed_account(admin_db, unique_email("reset-weak"), "client")
    raw_token = seed_password_reset_token(admin_db, account.user_id)
    with new_browser() as browser:
        response = browser.post(f"{API}/auth/reset-password", json={"token": raw_token, "password": "abc12"})
    assert response.status_code == 422


def test_resend_verification_returns_the_same_generic_message_for_verified_and_unknown_emails(
    admin_db: LocalDatabase,
) -> None:
    """Enumeration-safe: already-verified and unknown addresses both get the generic copy."""
    verified_account = seed_account(admin_db, unique_email("resend-verified"), "client")
    with new_browser() as browser:
        for email in (verified_account.email, unique_email("resend-unknown")):
            response = browser.post(f"{API}/auth/resend-verification", json={"email": email})
            assert response.status_code == 200
            assert response.json()["message"] == GENERIC_RESEND_MESSAGE


def test_verify_email_with_a_seeded_token_marks_the_account_verified(admin_db: LocalDatabase) -> None:
    """Happy path built from a seeded `email_verification_tokens` row (see reset-password docstring
    for why the raw token cannot come from an actual email in this environment).

    BASELINE BUG: `verify_email_with_token` always returns `session=None`, so the route always
    takes its "not signed in" branch (`EMAIL_VERIFIED_SIGN_IN`, cookies cleared) even though the
    docstring on the route says the one-click link signs the user in. Frozen as-is.
    """
    account = seed_account(admin_db, unique_email("verify-happy"), "client", verified=False)
    raw_token = seed_email_verification_token(admin_db, account.user_id)
    with new_browser() as browser:
        response = browser.post(f"{API}/auth/verify-email", json={"token": raw_token})
    assert response.status_code == 200
    body = response.json()
    assert body["message"] == EMAIL_VERIFIED_SIGN_IN
    assert body["session"] is None
    assert body["user"]["email"] == account.email
    # No session was set, so the route explicitly clears any (nonexistent) session cookies.
    assert_session_cookies_touched(response)

    row = admin_db.table("users").select("email_verified_at").eq("id", account.user_id).execute().data[0]
    assert row["email_verified_at"] is not None


def test_verify_email_with_an_already_consumed_token_is_idempotent_once_verified(
    admin_db: LocalDatabase,
) -> None:
    """Replaying the same verify link after success still succeeds, because the account is
    already verified (the route treats a used token as a retry, not an error, in that case).
    """
    account = seed_account(admin_db, unique_email("verify-idempotent"), "client", verified=False)
    raw_token = seed_email_verification_token(admin_db, account.user_id)
    with new_browser() as browser:
        first = browser.post(f"{API}/auth/verify-email", json={"token": raw_token})
        second = browser.post(f"{API}/auth/verify-email", json={"token": raw_token})
    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["message"] == EMAIL_VERIFIED_SIGN_IN


def test_verify_email_with_an_unknown_token_is_400() -> None:
    """A token that was never issued is refused with the generic invalid-link message."""
    with new_browser() as browser:
        response = browser.post(f"{API}/auth/verify-email", json={"token": "y" * 32})
    assert response.status_code == 400
    assert response.json()["detail"] == VERIFICATION_LINK_INVALID


def test_verify_email_with_an_expired_token_is_400(admin_db: LocalDatabase) -> None:
    """A token past its expiry is refused with the generic invalid-link message."""
    account = seed_account(admin_db, unique_email("verify-expired"), "client", verified=False)
    raw_token = seed_email_verification_token(admin_db, account.user_id, expires_in_minutes=-5)
    with new_browser() as browser:
        response = browser.post(f"{API}/auth/verify-email", json={"token": raw_token})
    assert response.status_code == 400
    assert response.json()["detail"] == VERIFICATION_LINK_INVALID


def test_change_password_without_a_session_is_401() -> None:
    """POST /auth/change-password requires a signed-in caller."""
    with new_browser() as browser:
        response = browser.post(
            f"{API}/auth/change-password",
            json={"current_password": "whatever-1", "new_password": "new-password-1"},
        )
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


@contextlib.contextmanager
def _fresh_signed_in_browser(admin_db: LocalDatabase, label: str) -> Iterator[tuple[httpx.Client, SeededAccount]]:
    """A brand-new client account, signed in on its own browser, closed on exit.

    Yields rather than being used as an `httpx.Client` context manager itself, because
    signing in already sends a request (which marks the client "opened"); entering it
    again with `with browser:` would raise.
    """
    account = seed_account(admin_db, unique_email(label), "client")
    browser = new_browser()
    try:
        signed_in = browser.post(
            f"{API}/auth/signin", json={"email": account.email, "password": account.password}
        )
        assert signed_in.status_code == 200
        yield browser, account
    finally:
        browser.close()


def test_change_password_happy_path_requires_sign_in_again(admin_db: LocalDatabase) -> None:
    """Changing to a new password clears cookies and the old session can no longer sign in with
    the old password, but can with the new one.
    """
    with _fresh_signed_in_browser(admin_db, "change-happy") as (browser, account):
        response = browser.post(
            f"{API}/auth/change-password",
            json={"current_password": account.password, "new_password": "second-password-1"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["message"] == PASSWORD_UPDATED_REAUTH
        assert body["requires_sign_in"] is True
        assert browser.get(f"{API}/auth/me").status_code == 401

    with new_browser() as fresh:
        old_password = fresh.post(
            f"{API}/auth/signin", json={"email": account.email, "password": account.password}
        )
        assert old_password.status_code == 401
    with new_browser() as fresh:
        new_password = fresh.post(
            f"{API}/auth/signin", json={"email": account.email, "password": "second-password-1"}
        )
        assert new_password.status_code == 200


def test_change_password_with_wrong_current_password_is_400(admin_db: LocalDatabase) -> None:
    """The current password is checked with a real sign-in attempt before anything is changed."""
    with _fresh_signed_in_browser(admin_db, "change-wrong-current") as (browser, _account):
        response = browser.post(
            f"{API}/auth/change-password",
            json={"current_password": "totally-wrong-1", "new_password": "second-password-1"},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == CURRENT_PASSWORD_INCORRECT


def test_change_password_to_the_same_password_is_400(admin_db: LocalDatabase) -> None:
    """The new password must differ from the current one."""
    with _fresh_signed_in_browser(admin_db, "change-same") as (browser, account):
        response = browser.post(
            f"{API}/auth/change-password",
            json={"current_password": account.password, "new_password": account.password},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == PASSWORD_MUST_DIFFER


def test_change_password_with_a_new_password_under_the_pydantic_minimum_is_422(admin_db: LocalDatabase) -> None:
    """`ChangePasswordRequest.new_password` also has `min_length=6`, so (as with reset-password)
    a too-short password is rejected by FastAPI's request validation before the handler runs,
    and the wrong current_password given here is never even checked.
    """
    with _fresh_signed_in_browser(admin_db, "change-weak") as (browser, _account):
        response = browser.post(
            f"{API}/auth/change-password",
            json={"current_password": "irrelevant-1", "new_password": "abc12"},
        )
        assert response.status_code == 422
