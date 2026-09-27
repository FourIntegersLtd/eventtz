"""Fixtures for the freeze suite.

`TARGET=baseline` (default) tests the baseline backend on :8000; `TARGET=api`
tests the rebuilt api/ on :8001. Start the server first with `make serve TARGET=…`.

Every test gets HTTP clients that each look like a different browser: separate
sessions and a unique `X-Forwarded-For`, so the per-IP sign-in rate limit never
trips across a long run. Seeded accounts get a fresh email per run for the same
reason: sign-ins are also limited per email (10 per 15 minutes).

The two targets differ in two places, and only these fixtures know it:

- `admin_db` is local Supabase's service client on the baseline, and on api/ a
  `LocalDatabase` answering the same query-builder calls from api/'s Postgres.
- A browser's session is cookies on the baseline and Bearer tokens on api/
  (`support/bearer.py`), the one deliberate contract change of the rebuild.
"""

from __future__ import annotations

import fnmatch
import os
import secrets
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest
from supabase import Client, create_client

from support.accounts import SeededAccount, seed_account, unique_email
from support.bearer import BearerSession
from support.database import LocalDatabase

ACCEPTANCE_DIR = Path(__file__).resolve().parent
# Which server the suite talks to, and where it listens.
TARGET_URLS = {"baseline": "http://127.0.0.1:8000", "api": "http://127.0.0.1:8001"}
TARGET = os.environ.get("TARGET", "baseline")
BASE_URL = os.environ.get("BASE_URL", TARGET_URLS[TARGET])
API = "/api/v1"
# api/'s Postgres from `api/docker-compose.yml` (`make db-up` in api/).
API_DATABASE_URL = os.environ.get(
    "ACCEPTANCE_DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5434/eventtz"
)
# Frozen behaviour api/ has not rebuilt yet: expected to fail on `TARGET=api`, and
# strictly, so an entry whose tests start passing fails the run until it is removed.
NOT_YET_ON_API = {
    "test_identity_settings.py::test_account_deletion_*": (
        "account deletion arrives after bookings, disputes and messaging (identity README)"
    ),
    "test_receipts.py::test_restore_*": (
        "restore-Connect on admin recovery arrives in next20 piece 09"
    ),
}
LOCAL_HOSTS = ("http://127.0.0.1", "http://localhost", "postgresql://postgres:postgres@127.0.0.1:")


def _local_env() -> dict[str, str]:
    """Key/value pairs from `.env.local` (written by `scripts/local_env.sh`)."""
    env_file = ACCEPTANCE_DIR / ".env.local"
    if not env_file.exists():
        pytest.exit("acceptance/.env.local missing: run `make env` after `npx supabase start`", returncode=2)
    pairs = (line.split("=", 1) for line in env_file.read_text().splitlines() if "=" in line)
    return {key.strip(): value.strip() for key, value in pairs}


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    """On `TARGET=api`, mark the tests of not-yet-rebuilt behaviour as expected failures."""
    if TARGET != "api":
        return
    for item in items:
        for pattern, reason in NOT_YET_ON_API.items():
            if fnmatch.fnmatch(item.nodeid, pattern):
                item.add_marker(pytest.mark.xfail(reason=f"not yet on api: {reason}", strict=True))
                break


@pytest.fixture(scope="session")
def admin_db() -> Client | LocalDatabase:
    """The target's LOCAL database, used only to seed and inspect test data."""
    if TARGET == "api":
        assert API_DATABASE_URL.startswith(LOCAL_HOSTS), "acceptance must use a local database"
        return LocalDatabase(API_DATABASE_URL)
    env = _local_env()
    supabase_url = env["SUPABASE_URL"]
    assert supabase_url.startswith(LOCAL_HOSTS), "acceptance must use local Supabase"
    return create_client(supabase_url, env["SUPABASE_SERVICE_ROLE_KEY"])


@pytest.fixture(scope="session", autouse=True)
def server_is_up() -> None:
    """Fail fast with a clear message if the target server is not running."""
    try:
        httpx.get(f"{BASE_URL}/health", timeout=5)
    except httpx.HTTPError:
        pytest.exit(f"{TARGET} is not running at {BASE_URL}: run `make serve TARGET={TARGET}`", returncode=2)


def new_browser() -> httpx.Client:
    """An HTTP client with its own session and client IP, like a separate browser."""
    fake_ip = "10." + ".".join(str(octet) for octet in secrets.token_bytes(3))
    session = BearerSession() if TARGET == "api" else None
    return httpx.Client(base_url=BASE_URL, headers={"X-Forwarded-For": fake_ip}, timeout=30, auth=session)


def present_access_token(browser: httpx.Client, access_token: str) -> None:
    """Make `browser` present `access_token` from now on, as a cookie or a Bearer header."""
    if isinstance(browser.auth, BearerSession):
        browser.auth.access_token = access_token
    else:
        browser.cookies.set("eventtz_access_token", access_token)


def assert_session_cookies_touched(response: httpx.Response) -> None:
    """The baseline sets or clears both session cookies here; api/ never sets a cookie.

    On api/ the web app owns the refresh cookie (ADR 0003), so the API's side of
    the contract is that no `Set-Cookie` reaches the browser at all.
    """
    set_cookie_headers = response.headers.get_list("set-cookie")
    if TARGET == "api":
        assert set_cookie_headers == []
        return
    assert any(header.startswith("eventtz_access_token=") for header in set_cookie_headers)
    assert any(header.startswith("eventtz_refresh_token=") for header in set_cookie_headers)


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
def client_account(admin_db: Client) -> SeededAccount:
    """A verified client account."""
    return seed_account(admin_db, unique_email("client"), "client")


@pytest.fixture(scope="session")
def vendor_account(admin_db: Client) -> SeededAccount:
    """A verified vendor account (no vendor profile row yet; vendor tests add one)."""
    return seed_account(admin_db, unique_email("vendor"), "vendor")


@pytest.fixture(scope="session")
def staff_account(admin_db: Client) -> SeededAccount:
    """A staff account with the plain `admin` role."""
    return seed_account(admin_db, unique_email("admin"), "admin", admin_role="admin")


@pytest.fixture(scope="session")
def super_admin_account(admin_db: Client) -> SeededAccount:
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
