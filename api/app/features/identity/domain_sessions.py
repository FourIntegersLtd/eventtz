"""When a refresh token may be exchanged (copied from OSCE `identity/domain.py`). Pure.

A sign-in is a chain of refresh tokens: each exchange spends the presented
token and issues its successor. The rule lives here, apart from storage, so it
is tested without a database. Every issued token is kept, so "was this token
already spent?" is asked directly, where OSCE compares against a sentinel.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class RefreshChainState:
    """One sign-in as the rule sees it: when it ends, and whether it was revoked."""

    expires_at: datetime
    revoked_at: datetime | None


@dataclass(frozen=True)
class RefreshDecision:
    """Whether a presented refresh token may be exchanged, and why not.

    `revoke_chain` is set only for reuse: the chain must die even though this
    one request is refused, because a spent token presented again means someone
    else already holds a copy of it.
    """

    accepted: bool
    revoke_chain: bool = False
    reason: str | None = None


def use_refresh_token(
    chain: RefreshChainState, *, token_already_spent: bool, now: datetime
) -> RefreshDecision:
    """Decide whether the presented token may be exchanged for a new pair.

    Presenting a token that has already been rotated means two parties hold
    tokens from one chain, so the chain has leaked. Refusing just this request
    would leave the thief's freshly rotated token working, so the whole chain
    dies and the real user signs in again.
    """
    if chain.revoked_at is not None:
        return RefreshDecision(accepted=False, reason="revoked")
    if now >= chain.expires_at:
        return RefreshDecision(accepted=False, reason="expired")
    if token_already_spent:
        return RefreshDecision(accepted=False, revoke_chain=True, reason="reuse_detected")
    return RefreshDecision(accepted=True)
