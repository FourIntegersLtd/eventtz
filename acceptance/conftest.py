"""Fixtures for the acceptance suite: black-box HTTP tests of api/ on :8001.

Start the server first with `make serve`. The tests were frozen against the old
backend before it was retired (2026-10-16), so they pin the behaviour users had.

Every test gets HTTP clients that each look like a different browser: separate
sessions and a unique `X-Forwarded-For`, so the per-IP sign-in rate limit never
trips across a long run. Seeded accounts get a fresh email per run for the same
reason: sign-ins are also limited per email (10 per 15 minutes).

`admin_db` is a `LocalDatabase` over api/'s local Postgres, used only to seed and
inspect test data. A browser's session is Bearer tokens (`support/bearer.py`).
"""

from __future__ import annotations

import os
import secrets
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest

from support.accounts import SeededAccount, seed_account, unique_email
from support.bearer import BearerSession
from support.database import LocalDatabase

ACCEPTANCE_DIR = Path(__file__).resolve().parent
# Where the api under test listens.
BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8001")
API = "/api/v1"
# api/'s Postgres from `api/docker-compose.yml` (`make db-up` in api/).
API_DATABASE_URL = os.environ.get(
    "ACCEPTANCE_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5434/eventtz"
)
LOCAL_HOSTS = ("postgresql://postgres:postgres@127.0.0.1:", "postgresql://postgres:postgres@localhost:")


@pytest.fixture(scope="session")
def admin_db() -> LocalDatabase:
    """api/'s LOCAL database, used only to seed and inspect test data."""
    assert API_DATABASE_URL.startswith(LOCAL_HOSTS), "acceptance must use a local database"
    return LocalDatabase(API_DATABASE_URL)


@pytest.fixture(scope="session", autouse=True)
def server_is_up() -> None:
    """Fail fast with a clear message if the target server is not running."""
    try:
        httpx.get(f"{BASE_URL}/health", timeout=5)
    except httpx.HTTPError:
        pytest.exit(f"api is not running at {BASE_URL}: run `make serve`", returncode=2)


def new_browser() -> httpx.Client:
    """An HTTP client with its own session and client IP, like a separate browser."""
    fake_ip = "10." + ".".join(str(octet) for octet in secrets.token_bytes(3))
    return httpx.Client(
        base_url=BASE_URL, headers={"X-Forwarded-For": fake_ip}, timeout=30, auth=BearerSession()
    )


def present_access_token(browser: httpx.Client, access_token: str) -> None:
    """Make `browser` present `access_token` as its Bearer token from now on."""
    assert isinstance(browser.auth, BearerSession)
    browser.auth.access_token = access_token


def assert_session_cookies_touched(response: httpx.Response) -> None:
    """Where the old backend set or cleared session cookies, api/ sets none.

    The web app owns the session cookies (ADR 0003), so the API's side of the
    contract is that no `Set-Cookie` reaches the browser at all.
    """
    assert response.headers.get_list("set-cookie") == []


def sign_in(account: SeededAccount) -> httpx.Client:
    """A browser signed in as `account` (the session `/auth/signin` hands out)."""
    browser = new_browser()
    response = browser.post(f"{API}/auth/signin", json={"email": account.email, "password": account.password})
    assert response.status_code == 200, (
        f"sign-in as {account.email} failed: {response.status_code} {response.text}"
    )
    return browser


@pytest.fixture
def anonymous() -> Iterator[httpx.Client]:
    """A browser with no session."""
    with new_browser() as browser:
        yield browser


@pytest.fixture(scope="session")
def client_account(admin_db: LocalDatabase) -> SeededAccount:
    """A verified client account."""
    return seed_account(admin_db, unique_email("client"), "client")


@pytest.fixture(scope="session")
def vendor_account(admin_db: LocalDatabase) -> SeededAccount:
    """A verified vendor account (no vendor profile row yet; vendor tests add one)."""
    return seed_account(admin_db, unique_email("vendor"), "vendor")


@pytest.fixture(scope="session")
def staff_account(admin_db: LocalDatabase) -> SeededAccount:
    """A staff account with the plain `admin` role."""
    return seed_account(admin_db, unique_email("admin"), "admin", admin_role="admin")


@pytest.fixture(scope="session")
def super_admin_account(admin_db: LocalDatabase) -> SeededAccount:
    """A super admin by `users.admin_role`."""
    return seed_account(admin_db, unique_email("super-admin"), "admin", admin_role="super_admin")


@pytest.fixture(scope="session")
def as_client(client_account: SeededAccount) -> Iterator[httpx.Client]:
    """A browser signed in as the client."""
    browser = sign_in(client_account)
    yield browser
    browser.close()


@pytest.fixture(scope="session")
def as_vendor(vendor_account: SeededAccount) -> Iterator[httpx.Client]:
    """A browser signed in as the vendor."""
    browser = sign_in(vendor_account)
    yield browser
    browser.close()


@pytest.fixture(scope="session")
def as_staff(staff_account: SeededAccount) -> Iterator[httpx.Client]:
    """A browser signed in as a plain admin."""
    browser = sign_in(staff_account)
    yield browser
    browser.close()


@pytest.fixture(scope="session")
def as_super_admin(super_admin_account: SeededAccount) -> Iterator[httpx.Client]:
    """A browser signed in as a super admin."""
    browser = sign_in(super_admin_account)
    yield browser
    browser.close()
