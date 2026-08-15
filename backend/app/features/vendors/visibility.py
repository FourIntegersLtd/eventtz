"""The single rule for whether a vendor is publicly listable on the marketplace.

Admin approval alone is not enough: a vendor whose Stripe Connect account cannot
take a charge or receive a payout would strand the client mid-checkout, so they
stay hidden from explore/search - and unbookable - until Stripe reports both
flags. The flags are kept in sync by the `account.updated` webhook, so a vendor
goes live automatically once Stripe verifies them.

Admins can override that automatic decision per vendor (`vendors.listing_override`):
`visible` waives the Stripe requirement for a vendor Eventtz has vetted another way,
`hidden` takes a listing down without the lock-out of a ban. Approval still wins over
both - a banned or unreviewed vendor is never listed.

Lives in its own module so both `profile` (vendor's own state) and `moderation`
(public queries, admin lists) can share it without importing each other.
"""

from __future__ import annotations

from typing import Any

PUBLIC_LISTING_STRIPE_COLS = (
    "stripe_account_id",
    "stripe_charges_enabled",
    "stripe_payouts_enabled",
)

LISTING_OVERRIDE_COLS = (
    "listing_override",
    "listing_override_reason",
)

LISTING_OVERRIDES = ("auto", "visible", "hidden")

# PostgREST spelling of "Stripe can charge and pay out", for the OR branch below.
_STRIPE_READY_FILTER = (
    "stripe_account_id.not.is.null,"
    "stripe_charges_enabled.is.true,"
    "stripe_payouts_enabled.is.true"
)


def apply_public_listing_filters(query: Any) -> Any:
    """Narrow a `vendors` query to rows that may appear publicly."""
    return (
        query.eq("approval_status", "approved")
        .neq("listing_override", "hidden")
        .or_(f"listing_override.eq.visible,and({_STRIPE_READY_FILTER})")
    )


def listing_override_of(row: dict[str, Any] | None) -> str:
    """The admin override on a vendor row, defaulting to `auto`."""
    if not isinstance(row, dict):
        return "auto"
    value = str(row.get("listing_override") or "auto").strip().lower()
    return value if value in LISTING_OVERRIDES else "auto"


def vendor_payouts_verified(row: dict[str, Any] | None) -> bool:
    """True when Stripe Connect can both charge and pay out for this vendor row."""
    if not isinstance(row, dict):
        return False
    return (
        bool(row.get("stripe_account_id"))
        and bool(row.get("stripe_charges_enabled"))
        and bool(row.get("stripe_payouts_enabled"))
    )


def payout_gate_waived(row: dict[str, Any] | None) -> bool:
    """True when an admin has waived the Stripe requirement for this vendor.

    A waived vendor can be found, accepted, and paid; the client's money is held in
    Eventtz's own balance either way, and the final payout Transfer still waits for a
    real Connect account - so the waiver never risks money we cannot deliver.
    """
    return listing_override_of(row) == "visible"


def row_is_publicly_listable(row: dict[str, Any] | None) -> bool:
    """Same rule as apply_public_listing_filters, for rows already in memory."""
    if not isinstance(row, dict):
        return False
    if row.get("approval_status") != "approved":
        return False
    override = listing_override_of(row)
    if override == "hidden":
        return False
    if override == "visible":
        return True
    return vendor_payouts_verified(row)


def is_missing_public_listing_column(error: Exception) -> bool:
    """True when the failure is a missing explore/Stripe column rather than a real error."""
    err = str(error).lower()
    known = (
        "min_list_price_gbp",
        "services_offered",
        "country_code",
        "42703",
        *PUBLIC_LISTING_STRIPE_COLS,
        *LISTING_OVERRIDE_COLS,
    )
    return any(name in err for name in known)
