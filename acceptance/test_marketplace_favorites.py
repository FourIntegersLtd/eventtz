"""Freeze: client saved-vendor favorites (`client_saved_vendors`).

Owned by the `favorites` slice, mounted at `/api/v1/client`. Every route requires a
client session; the store itself does not care whether the target id is a real
vendor - `vendor_user_id` only foreign-keys to `users(id)`, so any known user id
(even a client's own) can be favorited, while an id with no `users` row is silently
rejected. Each test signs in a fresh client account so favorites lists never leak
between tests.
"""

from __future__ import annotations

import uuid

from supabase import Client

from conftest import API, new_browser, sign_in
from support.accounts import seed_account, unique_email

SIGN_IN_REQUIRED = "Please sign in to continue."
CLIENT_PORTAL_FORBIDDEN = (
    "Booking requests are for client accounts. "
    "Sign in with a client account, or create one from the homepage."
)

FAVORITES_URL = f"{API}/client/favorites"

# A syntactically valid UUID with no `users` row.
MISSING_USER_ID = "00000000-0000-4000-8000-000000000000"


def _fresh_client_browser(admin_db: Client, label: str):
    """A browser signed in as a brand-new client account."""
    account = seed_account(admin_db, unique_email(label), "client")
    return sign_in(account)


def _seed_vendor_user_id(admin_db: Client, label: str) -> str:
    """A user id that exists in `users` (a plain vendor account, no `vendors` row needed)."""
    account = seed_account(admin_db, unique_email(label), "vendor")
    return account.user_id


# --- auth matrix ------------------------------------------------------------------------------


def test_list_favorites_without_a_session_is_401() -> None:
    """GET /client/favorites requires sign-in."""
    with new_browser() as browser:
        response = browser.get(FAVORITES_URL)
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_list_favorites_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account gets the client-portal message, not a generic 403."""
    account = seed_account(admin_db, unique_email("fav-list-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.get(FAVORITES_URL)
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


def test_put_favorite_without_a_session_is_401() -> None:
    """PUT /client/favorites/{id} requires sign-in."""
    with new_browser() as browser:
        response = browser.put(f"{FAVORITES_URL}/{MISSING_USER_ID}")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_delete_favorite_without_a_session_is_401() -> None:
    """DELETE /client/favorites/{id} requires sign-in."""
    with new_browser() as browser:
        response = browser.delete(f"{FAVORITES_URL}/{MISSING_USER_ID}")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_merge_favorites_without_a_session_is_401() -> None:
    """POST /client/favorites/merge requires sign-in."""
    with new_browser() as browser:
        response = browser.post(f"{FAVORITES_URL}/merge", json={"vendor_user_ids": []})
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


def test_merge_favorites_is_forbidden_for_a_vendor(admin_db: Client) -> None:
    """A vendor account cannot call the client favorites-merge endpoint."""
    account = seed_account(admin_db, unique_email("fav-merge-vendor"), "vendor")
    browser = sign_in(account)
    response = browser.post(f"{FAVORITES_URL}/merge", json={"vendor_user_ids": []})
    assert response.status_code == 403
    assert response.json()["detail"] == CLIENT_PORTAL_FORBIDDEN


# --- happy path --------------------------------------------------------------------------------


def test_list_favorites_starts_empty_for_a_fresh_client(admin_db: Client) -> None:
    """A brand-new client has no saved vendors."""
    browser = _fresh_client_browser(admin_db, "fav-empty")
    response = browser.get(FAVORITES_URL)
    assert response.status_code == 200
    assert response.json() == {"success": True, "vendor_user_ids": []}


def test_put_favorite_adds_a_vendor_and_list_reflects_it(admin_db: Client) -> None:
    """PUT adds the vendor id; a subsequent GET returns it."""
    browser = _fresh_client_browser(admin_db, "fav-put")
    vendor_id = _seed_vendor_user_id(admin_db, "fav-put-vendor")

    put_response = browser.put(f"{FAVORITES_URL}/{vendor_id}")
    assert put_response.status_code == 200
    assert put_response.json() == {"success": True}

    list_response = browser.get(FAVORITES_URL)
    assert list_response.status_code == 200
    assert list_response.json()["vendor_user_ids"] == [vendor_id]


def test_put_favorite_is_idempotent(admin_db: Client) -> None:
    """Adding the same vendor twice does not duplicate it in the list."""
    browser = _fresh_client_browser(admin_db, "fav-idempotent")
    vendor_id = _seed_vendor_user_id(admin_db, "fav-idempotent-vendor")

    assert browser.put(f"{FAVORITES_URL}/{vendor_id}").status_code == 200
    assert browser.put(f"{FAVORITES_URL}/{vendor_id}").status_code == 200

    response = browser.get(FAVORITES_URL)
    assert response.json()["vendor_user_ids"] == [vendor_id]


def test_put_favorite_with_an_unknown_user_id_reports_failure(admin_db: Client) -> None:
    """A `vendor_user_id` with no matching `users` row fails the foreign key, so success is false.

    BASELINE QUIRK: this is a 200 with `{"success": false}`, not a 404 - the route never
    checks the id exists up front, it only reports whether the insert succeeded.
    """
    browser = _fresh_client_browser(admin_db, "fav-put-unknown")
    response = browser.put(f"{FAVORITES_URL}/{MISSING_USER_ID}")
    assert response.status_code == 200
    assert response.json() == {"success": False}


def test_delete_favorite_removes_it(admin_db: Client) -> None:
    """DELETE removes a saved vendor; the list no longer contains it."""
    browser = _fresh_client_browser(admin_db, "fav-delete")
    vendor_id = _seed_vendor_user_id(admin_db, "fav-delete-vendor")
    assert browser.put(f"{FAVORITES_URL}/{vendor_id}").status_code == 200

    delete_response = browser.delete(f"{FAVORITES_URL}/{vendor_id}")
    assert delete_response.status_code == 200
    assert delete_response.json() == {"success": True}

    response = browser.get(FAVORITES_URL)
    assert response.json()["vendor_user_ids"] == []


def test_delete_favorite_never_saved_is_still_success(admin_db: Client) -> None:
    """Deleting a vendor id that was never favorited is a no-op success (DELETE is idempotent)."""
    browser = _fresh_client_browser(admin_db, "fav-delete-noop")
    vendor_id = _seed_vendor_user_id(admin_db, "fav-delete-noop-vendor")
    response = browser.delete(f"{FAVORITES_URL}/{vendor_id}")
    assert response.status_code == 200
    assert response.json() == {"success": True}


def test_favorites_are_scoped_to_the_signed_in_client(admin_db: Client) -> None:
    """One client's favorites never appear in another client's list."""
    browser_one = _fresh_client_browser(admin_db, "fav-scope-a")
    browser_two = _fresh_client_browser(admin_db, "fav-scope-b")
    vendor_id = _seed_vendor_user_id(admin_db, "fav-scope-vendor")

    assert browser_one.put(f"{FAVORITES_URL}/{vendor_id}").status_code == 200

    assert browser_one.get(FAVORITES_URL).json()["vendor_user_ids"] == [vendor_id]
    assert browser_two.get(FAVORITES_URL).json()["vendor_user_ids"] == []


def test_merge_favorites_adds_every_given_vendor_and_counts_them(admin_db: Client) -> None:
    """Merge is used to fold locally-saved (pre-login) ids into the server list on sign-in."""
    browser = _fresh_client_browser(admin_db, "fav-merge")
    label = uuid.uuid4().hex[:8]
    vendor_one = _seed_vendor_user_id(admin_db, f"fav-merge-one-{label}")
    vendor_two = _seed_vendor_user_id(admin_db, f"fav-merge-two-{label}")

    response = browser.post(f"{FAVORITES_URL}/merge", json={"vendor_user_ids": [vendor_one, vendor_two]})
    assert response.status_code == 200
    assert response.json() == {"success": True, "merged": 2}

    ids = set(browser.get(FAVORITES_URL).json()["vendor_user_ids"])
    assert ids == {vendor_one, vendor_two}


def test_merge_favorites_with_an_empty_list_merges_nothing(admin_db: Client) -> None:
    """Merging an empty list is a no-op that still reports success."""
    browser = _fresh_client_browser(admin_db, "fav-merge-empty")
    response = browser.post(f"{FAVORITES_URL}/merge", json={"vendor_user_ids": []})
    assert response.status_code == 200
    assert response.json() == {"success": True, "merged": 0}


def test_merge_favorites_skips_an_unknown_vendor_id_but_still_adds_the_rest(admin_db: Client) -> None:
    """Merge reports how many actually saved - an unknown id in the batch does not count."""
    browser = _fresh_client_browser(admin_db, "fav-merge-partial")
    vendor_id = _seed_vendor_user_id(admin_db, "fav-merge-partial-vendor")

    response = browser.post(
        f"{FAVORITES_URL}/merge",
        json={"vendor_user_ids": [vendor_id, MISSING_USER_ID]},
    )
    assert response.status_code == 200
    assert response.json() == {"success": True, "merged": 1}

    assert browser.get(FAVORITES_URL).json()["vendor_user_ids"] == [vendor_id]


def test_merge_favorites_body_over_500_ids_is_a_validation_error(admin_db: Client) -> None:
    """`vendor_user_ids` is capped at 500 entries by the request model."""
    browser = _fresh_client_browser(admin_db, "fav-merge-toolong")
    response = browser.post(
        f"{FAVORITES_URL}/merge",
        json={"vendor_user_ids": [str(uuid.uuid4()) for _ in range(501)]},
    )
    assert response.status_code == 422
