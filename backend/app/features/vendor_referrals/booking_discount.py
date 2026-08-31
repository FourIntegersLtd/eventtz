"""
Bridge booking rows to referral-aware pricing.

Two-phase model:
- **Enquire / browse:** ``resolve_referral_pricing_inputs`` in ``validate.py`` (strict live validation).
- **Existing booking:** ``build_pricing_breakdown_for_booking_row`` only — honor stored
  ``vendor_referral_code`` and tier spend; skip discount only on proven cross-vendor mismatch.

Do not call ``build_pricing_breakdown`` directly for booking client totals outside this module.
"""

from __future__ import annotations

from typing import Any

from app.features.bookings.pricing import (
    build_pricing_breakdown,
    normalize_vendor_adjustments_stored,
    persisted_booking_total_label,
    resolve_booking_service_fee_percent,
    sum_line_items_gbp,
)
from app.features.vendor_referrals.codes import (
    get_vendor_referral_row_by_code,
    normalize_client_referral_code,
)
from app.features.vendor_referrals.tiers import (
    referral_fee_discount_for_spend,
    referral_tier_min_spend,
)


def _line_items_from_row(row: dict[str, Any]) -> list[dict[str, Any]]:
    line_items = row.get("line_items")
    return line_items if isinstance(line_items, list) else []


def vendor_portion_gbp_from_row(row: dict[str, Any], *, include_adjustments: bool = True) -> float:
    """Sum line items and optionally normalized vendor adjustments."""
    li_sum, _ = sum_line_items_gbp(_line_items_from_row(row))
    adj_sum = 0.0
    if include_adjustments:
        adj_list = normalize_vendor_adjustments_stored(row.get("vendor_adjustments"))
        adj_sum = sum(a["amount_gbp"] for a in adj_list)
    return round(li_sum + adj_sum, 2)


def stored_referral_discount_for_spend(
    row: dict[str, Any],
    vendor_portion_gbp: float,
) -> tuple[float, float | None]:
    """
    Apply the referral tier for a code already stored on the booking.

    New bookings still validate the code at create time. After that, the stored
    code is the source of truth so client/vendor/admin/receipt totals stay
    aligned if a projection omits ``vendor_user_id`` or the vendor later
    disables or rotates the live code.

    Skip only when the code is proven to belong to a different vendor.
    """
    code = normalize_client_referral_code(row.get("vendor_referral_code"))
    if not code:
        return 0.0, None

    vendor_user_id = str(row.get("vendor_user_id") or "").strip()
    ref = get_vendor_referral_row_by_code(code)
    if ref:
        owner = str(ref.get("user_id") or "").strip()
        if vendor_user_id and owner and owner != vendor_user_id:
            return 0.0, None

    discount = referral_fee_discount_for_spend(vendor_portion_gbp)
    tier_min = referral_tier_min_spend(vendor_portion_gbp) if discount > 0 else None
    return discount, tier_min


def referral_discount_for_booking_row(row: dict[str, Any]) -> tuple[float, float | None]:
    """Return (referral_fee_discount_gbp, tier_min_spend_gbp) for current pricing."""
    vendor_portion = vendor_portion_gbp_from_row(row, include_adjustments=True)
    return stored_referral_discount_for_spend(row, vendor_portion)


def build_pricing_breakdown_for_booking_row(row: dict[str, Any]) -> dict[str, Any]:
    """Pricing breakdown with referral tier discount when a code is on the row."""
    discount, tier_min = referral_discount_for_booking_row(row)
    pb = build_pricing_breakdown(
        line_items=_line_items_from_row(row),
        vendor_adjustments=row.get("vendor_adjustments"),
        service_fee_percent=resolve_booking_service_fee_percent(row),
        referral_fee_discount_gbp=discount,
        referral_tier_min_spend_gbp=tier_min,
    )
    pb["vendor_referral_code"] = row.get("vendor_referral_code")
    return pb


def build_initial_pricing_breakdown_for_booking_row(row: dict[str, Any]) -> dict[str, Any]:
    """
    Client-facing quote before vendor adjustments: line items + fee only.

    Referral tier is evaluated on the line-item subtotal (not post-adjustment spend).
    """
    line_items = _line_items_from_row(row)
    vendor_portion = vendor_portion_gbp_from_row(row, include_adjustments=False)
    discount, tier_min = stored_referral_discount_for_spend(row, vendor_portion)
    return build_pricing_breakdown(
        line_items=line_items,
        vendor_adjustments=[],
        service_fee_percent=resolve_booking_service_fee_percent(row),
        referral_fee_discount_gbp=discount,
        referral_tier_min_spend_gbp=tier_min,
    )


def initial_client_total_label_for_booking_row(row: dict[str, Any]) -> str:
    """Persisted-style label for the pre-adjustment client total."""
    return persisted_booking_total_label(build_initial_pricing_breakdown_for_booking_row(row))


def pricing_snapshot_fields(pb: dict[str, Any]) -> dict[str, Any]:
    """Columns persisted on booking_requests when pricing changes."""
    return {
        "total_label": persisted_booking_total_label(pb),
        "referral_fee_discount_gbp": float(pb.get("referral_fee_discount_gbp") or 0) or None,
    }
