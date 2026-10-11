"""The visitor's address that sign-in, reset and verification limits count by.

On Railway every request arrives from the edge proxy, so the socket peer is the same
for everyone; the edge's ``X-Real-IP`` names the visitor. Off Railway those headers are
ignored, so a forged header never buys a fresh allowance.
"""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from starlette.requests import Request

from app.core.config import get_settings
from app.core.http import client_ip
from app.features.auth import messages as auth_messages
from app.features.auth.rate_limit import assert_sign_in_rate

# assert_sign_in_rate allows 40 attempts per address per 15 minutes (10 per email).
SIGN_IN_ATTEMPTS_PER_ADDRESS = 40


@pytest.fixture
def on_railway(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Run as Railway does: it sets ``RAILWAY_ENVIRONMENT`` on every deployed service."""
    monkeypatch.setenv("RAILWAY_ENVIRONMENT", "production")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def off_railway(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Run as a laptop or any host without Railway's edge in front."""
    monkeypatch.delenv("RAILWAY_ENVIRONMENT", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def http_request(peer: str | None = "10.0.0.1", **headers: str) -> Request:
    """A real Starlette request from ``peer``; header names use underscores (``x_real_ip``)."""
    return Request(
        {
            "type": "http",
            "headers": [(name.replace("_", "-").encode(), value.encode()) for name, value in headers.items()],
            "client": (peer, 40000) if peer else None,
        }
    )


def sign_in_attempts(requests: list[Request]) -> list[bool]:
    """Try one sign-in per request, each with a fresh email; True where the limit refused it."""
    refused = []
    for attempt, request in enumerate(requests):
        try:
            assert_sign_in_rate(f"visitor-{id(requests)}-{attempt}@example.com", client_ip(request))
        except ValueError as error:
            assert str(error) == auth_messages.SIGN_IN_RATE_LIMIT
            refused.append(True)
        else:
            refused.append(False)
    return refused


@pytest.mark.usefixtures("on_railway")
def test_on_railway_the_visitor_is_the_edges_x_real_ip():
    request = http_request(x_real_ip="203.0.113.9", x_forwarded_for="198.51.100.5")
    assert client_ip(request) == "203.0.113.9"


@pytest.mark.usefixtures("on_railway")
def test_on_railway_without_x_real_ip_the_visitor_is_the_first_forwarded_entry():
    assert client_ip(http_request(x_forwarded_for="198.51.100.5, 10.0.0.2")) == "198.51.100.5"


@pytest.mark.usefixtures("on_railway")
def test_on_railway_a_malformed_header_is_skipped():
    assert client_ip(http_request(x_real_ip="not-an-ip", x_forwarded_for="2001:db8::1")) == "2001:db8::1"
    assert client_ip(http_request(x_real_ip="", x_forwarded_for="garbage")) == "10.0.0.1"


@pytest.mark.usefixtures("on_railway")
def test_on_railway_with_no_headers_the_visitor_is_the_peer():
    assert client_ip(http_request(peer="10.0.0.1")) == "10.0.0.1"


@pytest.mark.usefixtures("off_railway")
def test_off_railway_the_headers_are_ignored():
    request = http_request(peer="192.0.2.10", x_real_ip="203.0.113.9", x_forwarded_for="198.51.100.5")
    assert client_ip(request) == "192.0.2.10"


@pytest.mark.usefixtures("off_railway")
def test_a_caller_with_no_address_still_gets_a_bucket():
    assert client_ip(http_request(peer=None)) == "unknown"


@pytest.mark.usefixtures("on_railway")
def test_two_visitors_behind_the_edge_get_separate_limits():
    """Both arrive from the same edge peer; one visitor's spent limit must not lock the other out."""
    noisy = [http_request(peer="10.0.0.1", x_real_ip="203.0.113.41")] * (SIGN_IN_ATTEMPTS_PER_ADDRESS + 1)
    assert sign_in_attempts(noisy) == [False] * SIGN_IN_ATTEMPTS_PER_ADDRESS + [True]
    assert sign_in_attempts([http_request(peer="10.0.0.1", x_real_ip="203.0.113.42")]) == [False]


@pytest.mark.usefixtures("off_railway")
def test_a_forged_header_does_not_dodge_a_limit_off_railway():
    forged = [
        http_request(
            peer="192.0.2.43", x_real_ip=f"203.0.113.{attempt}", x_forwarded_for=f"198.51.100.{attempt}"
        )
        for attempt in range(SIGN_IN_ATTEMPTS_PER_ADDRESS + 1)
    ]
    assert sign_in_attempts(forged) == [False] * SIGN_IN_ATTEMPTS_PER_ADDRESS + [True]
