"""Fixtures for the freeze suite.

`TARGET=baseline` (default) tests the baseline backend on :8000; `TARGET=api`
tests the rebuilt api/ on :8001. Start the server first with `make serve TARGET=…`.

Every test gets HTTP clients that each look like a different browser: separate
cookie jars and a unique `X-Forwarded-For`, so the baseline's per-IP sign-in
rate limit never trips across a long run. Seeded accounts get a fresh email per
run for the same reason: the baseline also limits sign-ins per email (10 per 15
minutes, in memory until the server restarts).
"""

from __future__ import annotations

import os
import secrets
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest
from supabase import Client, create_client

from support.accounts import SeededAccount, seed_account, unique_email

ACCEPTANCE_DIR = Path(__file__).resolve().parent
# Which server the suite talks to, and where it listens.
TARGET_URLS = {"baseline": "http://127.0.0.1:8000", "api": "http://127.0.0.1:8001"}
TARGET = os.environ.get("TARGET", "baseline")
BASE_URL = os.environ.get("BASE_URL", TARGET_URLS[TARGET])
API = "/api/v1"


def _local_env() -> dict[str, str]:
    """Key/value pairs from `.env.local` (written by `scripts/local_env.sh`)."""
    env_file = ACCEPTANCE_DIR / ".env.local"
    if not env_file.exists():
        pytest.exit("acceptance/.env.local missing: run `make env` after `npx supabase start`", returncode=2)
    pairs = (line.split("=", 1) for line in env_file.read_text().splitlines() if "=" in line)
    return {key.strip(): value.strip() for key, value in pairs}


@pytest.fixture(scope="session")
def admin_db() -> Client:
    """Service-role client for LOCAL Supabase, used only to seed and inspect test data."""
    env = _local_env()
    supabase_url = env["SUPABASE_URL"]
    assert supabase_url.startswith(("http://127.0.0.1", "http://localhost")), (
        "acceptance must use local Supabase"
    )
    return create_client(supabase_url, env["SUPABASE_SERVICE_ROLE_KEY"])


@pytest.fixture(scope="session", autouse=True)
def server_is_up() -> None:
    """Fail fast with a clear message if the target server is not running."""
    try:
        httpx.get(f"{BASE_URL}/health", timeout=5)
    except httpx.HTTPError:
        pytest.exit(f"{TARGET} is not running at {BASE_URL}: run `make serve TARGET={TARGET}`", returncode=2)


def new_browser() -> httpx.Client:
    """An HTTP client with its own cookie jar and client IP, like a separate browser."""
    fake_ip = "10." + ".".join(str(octet) for octet in secrets.token_bytes(3))
    return httpx.Client(base_url=BASE_URL, headers={"X-Forwarded-For": fake_ip}, timeout=30)


# The session cookies both servers read (same names in the baseline and api/).
ACCESS_COOKIE = "eventtz_access_token"
REFRESH_COOKIE = "eventtz_refresh_token"


def _sign_in_with_supabase(browser: httpx.Client, account: SeededAccount) -> None:
    """Get a session straight from local Supabase Auth and store it as the session cookies.

    Only for a target that does not serve `/auth/signin` yet (api/ until the
    identity slice is rebuilt). The route itself is frozen by `test_identity_session.py`.
    """
    env = _local_env()
    auth_only = create_client(env["SUPABASE_URL"], env["SUPABASE_SERVICE_ROLE_KEY"])
    credentials = {"email": account.email, "password": account.password}
    session = auth_only.auth.sign_in_with_password(credentials).session
    assert session is not None, f"local Supabase refused {account.email}"
    host = httpx.URL(BASE_URL).host
    browser.cookies.set(ACCESS_COOKIE, session.access_token, domain=host)
    browser.cookies.set(REFRESH_COOKIE, session.refresh_token, domain=host)


def sign_in(account: SeededAccount) -> httpx.Client:
    """A browser signed in as `account` (session cookies set by `/auth/signin`)."""
    browser = new_browser()
    response = browser.post(f"{API}/auth/signin", json={"email": account.email, "password": account.password})
    if response.status_code == 404 and TARGET == "api":
        _sign_in_with_supabase(browser, account)
        return browser
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
