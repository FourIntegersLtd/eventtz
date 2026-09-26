"""The pricing slice's public surface: what other slices import to price a booking.

Pricing has no database or routes, so this module only re-exports the pure rules
from `domain.py`; slices may import another slice's `service` but never its `domain`.
"""

from __future__ import annotations

from app.features.pricing.domain import (
    BOOKING_SERVICE_FEE_PERCENT,
    PricingBreakdown,
    VendorAdjustment,
    build_pricing_breakdown,
    format_gbp,
    normalise_vendor_adjustments,
    persisted_total_label,
    resolve_service_fee_percent,
    service_fee_percent_or_default,
    vendor_portion_gbp,
)

__all__ = [
    "BOOKING_SERVICE_FEE_PERCENT",
    "PricingBreakdown",
    "VendorAdjustment",
    "build_pricing_breakdown",
    "format_gbp",
    "normalise_vendor_adjustments",
    "persisted_total_label",
    "resolve_service_fee_percent",
    "service_fee_percent_or_default",
    "vendor_portion_gbp",
]
