"""The vendor's Stripe Connect columns, for the payments slice.

`vendors` owns the `stripe_account_id` / `stripe_*_enabled` columns; payments decides
what goes in them (it is the one talking to Stripe) and writes them only through here.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.vendors import repository
from app.features.vendors.domain_visibility import listing_override_of
from app.features.vendors.rows import VendorRow


async def vendor_for_payouts(session: AsyncSession, vendor_user_id: str) -> VendorRow | None:
    """The vendor's row (Stripe columns, listing override, profile payload), or None before onboarding."""
    return await repository.get_vendor(session, vendor_user_id)


def payout_gate_waived(vendor: VendorRow | None) -> bool:
    """True when a super admin forced the listing visible, which also waives the Stripe payout gate."""
    return vendor is not None and listing_override_of(vendor.listing_override) == "visible"


async def save_stripe_account(session: AsyncSession, vendor_user_id: str, account_id: str) -> None:
    """Remember the vendor's newly created Connect account."""
    await repository.update_vendor(session, vendor_user_id, {"stripe_account_id": account_id})


async def save_stripe_flags(
    session: AsyncSession, vendor_user_id: str, *, charges_enabled: bool, payouts_enabled: bool
) -> None:
    """Store what Stripe last said the vendor's account can do."""
    await repository.update_vendor(
        session,
        vendor_user_id,
        {"stripe_charges_enabled": charges_enabled, "stripe_payouts_enabled": payouts_enabled},
    )


async def clear_stripe_account(session: AsyncSession, vendor_user_id: str) -> None:
    """Forget a Connect account Stripe no longer knows, so the vendor can set up a fresh one."""
    await repository.update_vendor(
        session,
        vendor_user_id,
        {"stripe_account_id": None, "stripe_charges_enabled": False, "stripe_payouts_enabled": False},
    )


async def vendor_for_stripe_account(session: AsyncSession, account_id: str) -> str | None:
    """The vendor whose Connect account is `account_id` (for Stripe's `account.updated`), if any."""
    return await repository.vendor_id_for_stripe_account(session, account_id)
