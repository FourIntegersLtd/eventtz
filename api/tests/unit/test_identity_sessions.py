"""`use_refresh_token`: when a refresh token may be exchanged, and when its whole chain must die."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.features.identity.domain_sessions import RefreshChainState, RefreshDecision, use_refresh_token
from app.features.identity.errors import refresh_expired

NOW = datetime(2026, 9, 26, 12, 0, tzinfo=UTC)
LIVE_CHAIN = RefreshChainState(expires_at=NOW + timedelta(days=30), revoked_at=None)


def test_an_unspent_token_on_a_live_chain_is_exchanged() -> None:
    assert use_refresh_token(LIVE_CHAIN, token_already_spent=False, now=NOW) == RefreshDecision(accepted=True)


def test_a_spent_token_presented_again_revokes_the_chain() -> None:
    """Two parties hold tokens from one chain, so it has leaked: the thief's successor must die too."""
    assert use_refresh_token(LIVE_CHAIN, token_already_spent=True, now=NOW) == RefreshDecision(
        accepted=False, revoke_chain=True, reason="reuse_detected"
    )


def test_an_expired_chain_is_refused_without_revoking() -> None:
    expired = RefreshChainState(expires_at=NOW, revoked_at=None)
    assert use_refresh_token(expired, token_already_spent=False, now=NOW) == RefreshDecision(
        accepted=False, reason="expired"
    )


def test_a_revoked_chain_is_refused_even_for_a_spent_token() -> None:
    """Already dead, so reuse needs no second revocation."""
    revoked = RefreshChainState(expires_at=NOW + timedelta(days=1), revoked_at=NOW - timedelta(minutes=5))
    assert use_refresh_token(revoked, token_already_spent=True, now=NOW) == RefreshDecision(
        accepted=False, reason="revoked"
    )


def test_refresh_expired_is_the_session_expired_code_with_the_refresh_wording() -> None:
    """The refresh exchange refuses with the shared `session_expired` code but its own message."""
    error = refresh_expired()
    assert error.code == "session_expired"
    assert error.message == "Your session has expired. Please sign in again."
