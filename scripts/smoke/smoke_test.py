#!/usr/bin/env python3
"""Post-deploy smoke test for the `api/` service.

Run this by hand (or from a deploy pipeline) right after a Railway deploy to
prove the new release is actually serving traffic, not just that it passed CI.
It makes four calls against a live base URL:

1. `GET /health` — liveness.
2. `GET /api/v1/vendors/explore` — one public, unauthenticated read, proving
   the database connection and a real query path both work.
3. `POST /api/v1/auth/signin` — signs in a pre-existing test account, proving
   the identity slice and its database round-trip work end to end. Credentials
   come from environment variables (`SMOKE_TEST_EMAIL` / `SMOKE_TEST_PASSWORD`)
   and are never hard-coded here or logged; if they are not set, this check is
   skipped rather than failed, since a smoke run against an environment with
   no seeded test account is still a useful partial signal.
4. `POST /api/v1/webhooks/stripe` with a deliberately wrong `Stripe-Signature`
   header — proving a forged webhook is rejected, not silently accepted. On
   `api/` this route does not exist yet (the payments slice is still being
   built; see `api/app/features/payments/README.md`), so a 404 here is treated
   as a skip with a clear message rather than a failure.

Only the Python standard library is used (`urllib`), so this script needs no
extra dependency in any environment it runs in — including a bare deploy box.

Exit code is 0 only if every check that ran either passed or was explicitly
skipped; any check that ran and failed makes the whole script exit non-zero.

Usage:
    python3 scripts/smoke/smoke_test.py --base-url http://127.0.0.1:8111
    BASE_URL=https://api.eventtz.com python3 scripts/smoke/smoke_test.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from urllib.parse import urljoin

API_PREFIX = "/api/v1"
REQUEST_TIMEOUT_SECONDS = 10


@dataclass
class CheckResult:
    """The outcome of one smoke check, for the summary printed at the end."""

    name: str
    passed: bool
    skipped: bool
    detail: str


def _request(
    method: str,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    body: bytes | None = None,
) -> tuple[int, bytes]:
    """Make one HTTP request and return (status_code, response_body).

    A non-2xx response raises `urllib.error.HTTPError` in the standard
    library, which still carries a `.code` and readable body, so both the
    success and failure paths return through here rather than needing two
    separate call sites.
    """
    request = urllib.request.Request(url, method=method, headers=headers or {}, data=body)
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def check_health(base_url: str) -> CheckResult:
    """`GET /health` must return 200. This is Railway's own liveness probe."""
    url = urljoin(base_url, "/health")
    try:
        status, _body = _request("GET", url)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return CheckResult("health", passed=False, skipped=False, detail=f"request failed: {error}")
    if status == 200:
        return CheckResult("health", passed=True, skipped=False, detail="200 OK")
    return CheckResult("health", passed=False, skipped=False, detail=f"expected 200, got {status}")


def check_public_explore(base_url: str) -> CheckResult:
    """`GET /vendors/explore` must return 200 with no auth: the public browse page."""
    url = urljoin(base_url, f"{API_PREFIX}/vendors/explore")
    try:
        status, body = _request("GET", url)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return CheckResult("public explore", passed=False, skipped=False, detail=f"request failed: {error}")
    if status != 200:
        return CheckResult(
            "public explore", passed=False, skipped=False, detail=f"expected 200, got {status}: {body[:200]!r}"
        )
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return CheckResult("public explore", passed=False, skipped=False, detail="200 but body was not JSON")
    if "vendors" not in payload:
        return CheckResult(
            "public explore", passed=False, skipped=False, detail=f"200 but no 'vendors' key: {list(payload)}"
        )
    return CheckResult("public explore", passed=True, skipped=False, detail=f"200, {len(payload['vendors'])} vendors")


def check_sign_in(base_url: str) -> CheckResult:
    """`POST /auth/signin` with a pre-seeded test account must return 200.

    Credentials are read from the environment so this script never carries a
    real (or even a fake-but-committed) password. Missing credentials skip
    the check instead of failing it, since not every environment this script
    runs against will have a seeded test account.
    """
    email = os.environ.get("SMOKE_TEST_EMAIL")
    password = os.environ.get("SMOKE_TEST_PASSWORD")
    if not email or not password:
        return CheckResult(
            "sign-in",
            passed=True,
            skipped=True,
            detail="SMOKE_TEST_EMAIL / SMOKE_TEST_PASSWORD not set; skipping",
        )
    url = urljoin(base_url, f"{API_PREFIX}/auth/signin")
    body = json.dumps({"email": email, "password": password}).encode("utf-8")
    try:
        status, response_body = _request(
            "POST", url, headers={"Content-Type": "application/json"}, body=body
        )
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return CheckResult("sign-in", passed=False, skipped=False, detail=f"request failed: {error}")
    if status != 200:
        # Never echo the response body here: on a 4xx it can contain the
        # caller-supplied email back in an error message, and this script's
        # own output is designed to be safe to paste into a deploy log or PR.
        return CheckResult("sign-in", passed=False, skipped=False, detail=f"expected 200, got {status}")
    return CheckResult("sign-in", passed=True, skipped=False, detail="200 OK")


def check_webhook_signature_rejected(base_url: str) -> CheckResult:
    """`POST /webhooks/stripe` with a wrong signature must be rejected, never accepted.

    The payments slice had not built this route yet as of this script's
    writing (`api/app/features/payments/` had no router; see its README's
    "Routes: Built in the next milestone."). A 404 here means the route
    genuinely is not deployed, which is a skip, not a failure of the check
    this smoke test is trying to make. Once the route exists, the baseline's
    behaviour (`backend/app/features/payments/http/webhooks.py`) is a 400 for
    a signature that does not verify, so that is the status this check
    requires once the route is live.
    """
    url = urljoin(base_url, f"{API_PREFIX}/webhooks/stripe")
    body = b'{"type": "checkout.session.completed", "data": {"object": {}}}'
    headers = {
        "Content-Type": "application/json",
        # Deliberately malformed: real Stripe signatures are HMAC-SHA256 over
        # "{timestamp}.{raw body}"; this one verifies against nothing.
        "Stripe-Signature": "t=1,v1=0000000000000000000000000000000000000000000000000000000000000000",
    }
    try:
        status, _body = _request("POST", url, headers=headers, body=body)
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        return CheckResult(
            "webhook signature rejection", passed=False, skipped=False, detail=f"request failed: {error}"
        )
    if status == 404:
        return CheckResult(
            "webhook signature rejection",
            passed=True,
            skipped=True,
            detail="route not deployed yet (404); skipping until payments webhooks land on api/",
        )
    if status == 400:
        return CheckResult("webhook signature rejection", passed=True, skipped=False, detail="400 rejected, as expected")
    return CheckResult(
        "webhook signature rejection",
        passed=False,
        skipped=False,
        detail=f"expected 400 (or 404 if not deployed), got {status} — a bad signature must never be accepted",
    )


def run_all_checks(base_url: str) -> list[CheckResult]:
    """Run every check in order and return all results (does not stop at the first failure)."""
    return [
        check_health(base_url),
        check_public_explore(base_url),
        check_sign_in(base_url),
        check_webhook_signature_rejected(base_url),
    ]


def main() -> int:
    """Parse arguments, run the checks, print a summary, and return the process exit code."""
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("BASE_URL"),
        help="Base URL of the running api/ service, e.g. http://127.0.0.1:8111 (env: BASE_URL)",
    )
    args = parser.parse_args()

    if not args.base_url:
        print("error: --base-url or BASE_URL is required", file=sys.stderr)
        return 2

    base_url = args.base_url if args.base_url.endswith("/") else f"{args.base_url}/"
    print(f"Smoke testing {base_url}")

    results = run_all_checks(base_url)

    print()
    all_ok = True
    for result in results:
        if result.skipped:
            marker = "SKIP"
        elif result.passed:
            marker = "PASS"
        else:
            marker = "FAIL"
            all_ok = False
        print(f"[{marker}] {result.name}: {result.detail}")

    print()
    print("smoke test: OK" if all_ok else "smoke test: FAILED")
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
