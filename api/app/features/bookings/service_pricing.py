"""Price a stored booking: its current breakdown, the original one, and the columns a price change writes.

A booking's referral code was checked when it was made; after that the stored code
earns its tier discount unless it now belongs to a different vendor.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.bookings.rows import BookingRow
from app.features.pricing import service as pricing
from app.features.referrals import service_client_codes as referral_codes


async def code_owners_for(session: AsyncSession, bookings: list[BookingRow]) -> dict[str, str]:
    """Who owns each referral code stored on these bookings today (one query for a whole list)."""
    codes = {booking.vendor_referral_code or "" for booking in bookings}
    return await referral_codes.code_owners(session, codes)


def breakdown_for(
    booking: BookingRow, owners: dict[str, str], *, vendor_adjustments: list[Any] | None = None
) -> pricing.PricingBreakdown:
    """The booking's price today: packages, the vendor's extras and discounts, and the fee.

    `vendor_adjustments` prices a proposed set of changes instead of the stored ones.
    """
    adjustments = booking.vendor_adjustments if vendor_adjustments is None else vendor_adjustments
    discount, tier_min = referral_codes.booking_code_discount(
        stored_code=booking.vendor_referral_code,
        booking_vendor_id=booking.vendor_user_id,
        owners=owners,
        vendor_portion_gbp=pricing.vendor_portion_gbp(booking.line_items, adjustments),
    )
    return pricing.build_pricing_breakdown(
        line_items=booking.line_items,
        vendor_adjustments=adjustments,
        service_fee_percent=pricing.service_fee_percent_or_default(booking.service_fee_percent),
        referral_fee_discount_gbp=discount,
        referral_tier_min_spend_gbp=tier_min,
    )


async def current_breakdown(session: AsyncSession, booking: BookingRow) -> pricing.PricingBreakdown:
    """One booking's price today (looks up its referral code's owner)."""
    return breakdown_for(booking, await code_owners_for(session, [booking]))


def client_total_label(breakdown: pricing.PricingBreakdown) -> str:
    """The total the client pays, as notification copy quotes it."""
    return breakdown.client_total_label or pricing.persisted_total_label(breakdown)


def initial_breakdown_for(booking: BookingRow, owners: dict[str, str]) -> pricing.PricingBreakdown:
    """The price before the vendor's changes: packages and fee, the referral tier judged on packages alone."""
    discount, tier_min = referral_codes.booking_code_discount(
        stored_code=booking.vendor_referral_code,
        booking_vendor_id=booking.vendor_user_id,
        owners=owners,
        vendor_portion_gbp=pricing.vendor_portion_gbp(booking.line_items, [], include_adjustments=False),
    )
    return pricing.build_pricing_breakdown(
        line_items=booking.line_items,
        vendor_adjustments=[],
        service_fee_percent=pricing.service_fee_percent_or_default(booking.service_fee_percent),
        referral_fee_discount_gbp=discount,
        referral_tier_min_spend_gbp=tier_min,
    )


def snapshot_columns(breakdown: pricing.PricingBreakdown) -> dict[str, Any]:
    """The columns stored whenever the price changes: the total label and the referral discount."""
    return {
        "total_label": pricing.persisted_total_label(breakdown),
        "referral_fee_discount_gbp": breakdown.referral_fee_discount_gbp or None,
    }


def pricing_view(breakdown: pricing.PricingBreakdown, booking: BookingRow) -> dict[str, Any]:
    """The breakdown as the booking screens read it, with the stored referral code."""
    return {**breakdown.to_dict(), "vendor_referral_code": booking.vendor_referral_code}


def adjustments_view(breakdown: pricing.PricingBreakdown) -> list[dict[str, Any]]:
    """The normalised extras and discounts, as stored and shown."""
    return [
        {
            "id": adjustment.id,
            "tag": adjustment.tag,
            "label": adjustment.label,
            "amount_gbp": adjustment.amount_gbp,
        }
        for adjustment in breakdown.vendor_adjustments
    ]
