"""Whether a vendor is live on the marketplace. Pure.

Admin approval alone is not enough: a vendor whose Stripe Connect account cannot take
a charge or pay out would strand a client mid-checkout, so they stay hidden until
Stripe reports both. Admins can override that per vendor (`vendors.listing_override`):
`visible` waives the Stripe requirement, `hidden` takes a listing down without a ban.
Approval still wins over both: a banned or unreviewed vendor is never listed.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

ListingOverride = Literal["auto", "visible", "hidden"]
LISTING_OVERRIDES: tuple[ListingOverride, ...] = ("auto", "visible", "hidden")
APPROVAL_STATUSES = ("pending", "approved", "banned")


def listing_override_of(raw_override: str | None) -> ListingOverride:
    """The stored override, lower-cased; `auto` for anything missing or unknown."""
    cleaned = (raw_override or "auto").strip().lower()
    for override in LISTING_OVERRIDES:
        if cleaned == override:
            return override
    return "auto"


def is_suspended(approval_status: str | None) -> bool:
    """True for a vendor staff have banned (suspended)."""
    return approval_status == "banned"


def payouts_verified(*, stripe_account_id: str | None, charges_enabled: bool, payouts_enabled: bool) -> bool:
    """True when Stripe Connect can both charge and pay out for this vendor."""
    return bool(stripe_account_id) and charges_enabled and payouts_enabled


def is_paused(paused_until: datetime | None, *, now: datetime | None = None) -> bool:
    """True while a staff listing pause is still running; it lapses by time, with no job."""
    if paused_until is None:
        return False
    moment = now or datetime.now(UTC)
    return paused_until > moment


def is_publicly_listable(
    *,
    approval_status: str | None,
    listing_override: str | None,
    payouts_ready: bool,
    paused_until: datetime | None = None,
    now: datetime | None = None,
) -> bool:
    """Approved, not paused, not hidden, and either forced visible or Stripe-ready."""
    if approval_status != "approved":
        return False
    if is_paused(paused_until, now=now):
        return False
    override = listing_override_of(listing_override)
    if override == "hidden":
        return False
    return override == "visible" or payouts_ready
