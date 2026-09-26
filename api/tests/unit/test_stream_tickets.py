"""Stream tickets: a short-lived, self-contained JWT `EventSource` can carry as a query parameter."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.core.auth import (
    STREAM_TICKET_TYPE,
    decode_stream_ticket,
    issue_access_token,
    issue_stream_ticket,
)
from app.core.settings import Settings

SETTINGS = Settings(
    jwt_secret="unit-test-secret-at-least-32-bytes-long", jwt_issuer="eventtz", stream_ticket_ttl_seconds=60
)


def test_a_freshly_issued_ticket_decodes_to_its_user() -> None:
    ticket = issue_stream_ticket(user_id="user-1", settings=SETTINGS)
    claims = decode_stream_ticket(ticket, settings=SETTINGS)
    assert claims is not None
    assert claims.user_id == "user-1"


def test_the_ticket_type_claim_is_stream() -> None:
    import jwt as pyjwt  # noqa: PLC0415 - only this test needs the raw claims

    ticket = issue_stream_ticket(user_id="user-1", settings=SETTINGS)
    raw_claims = pyjwt.decode(ticket, SETTINGS.jwt_secret, algorithms=["HS256"], issuer="eventtz")
    assert raw_claims["typ"] == STREAM_TICKET_TYPE


def test_an_expired_ticket_is_refused() -> None:
    minted_in_the_past = datetime.now(UTC) - timedelta(seconds=SETTINGS.stream_ticket_ttl_seconds + 5)
    ticket = issue_stream_ticket(user_id="user-1", settings=SETTINGS, now=minted_in_the_past)
    assert decode_stream_ticket(ticket, settings=SETTINGS) is None


def test_an_access_token_is_not_accepted_as_a_stream_ticket() -> None:
    """A signed-in user's ordinary Bearer token must not double as a stream ticket: `typ` differs."""
    access_token = issue_access_token(user_id="user-1", email="ada@example.com", settings=SETTINGS)
    assert decode_stream_ticket(access_token, settings=SETTINGS) is None


def test_a_stream_ticket_is_not_accepted_by_a_wrong_secret() -> None:
    ticket = issue_stream_ticket(user_id="user-1", settings=SETTINGS)
    wrong_settings = Settings(jwt_secret="a-different-secret-also-32-bytes-long", jwt_issuer="eventtz")
    assert decode_stream_ticket(ticket, settings=wrong_settings) is None


def test_garbage_is_refused_without_raising() -> None:
    assert decode_stream_ticket("not-a-jwt-at-all", settings=SETTINGS) is None
