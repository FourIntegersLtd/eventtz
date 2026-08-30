"""Resolve referral tier discount from a booking row snapshot."""

from __future__ import annotations

from typing import Any

from app.features.bookings.pricing import (
    build_pricing_breakdown,
    normalize_vendor_adjustments_stored,
    persisted_booking_total_label,
    resolve_booking_service_fee_percent,
    sum_line_items_gbp,
)
from app.features.vendor_referrals.validate import resolve_referral_pricing_inputs


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


def referral_discount_for_booking_row(row: dict[str, Any]) -> tuple[float, float | None]:
    """Return (referral_fee_discount_gbp, tier_min_spend_gbp) for pricing."""
    code = row.get("vendor_referral_code")
    if not code or not str(code).strip():
        return 0.0, None
    vendor_user_id = str(row.get("vendor_user_id") or "").strip()
    if not vendor_user_id:
        return 0.0, None

    vendor_portion = vendor_portion_gbp_from_row(row, include_adjustments=True)
    _, discount, tier_min = resolve_referral_pricing_inputs(
        vendor_user_id,
        str(code),
        vendor_portion,
        require_valid_when_provided=False,
    )
    return discount, tier_min


def build_pricing_breakdown_for_booking_row(row: dict[str, Any]) -> dict[str, Any]:
    """Pricing breakdown with referral tier discount when code is on the row."""
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
    discount = 0.0
    tier_min = None
    code = row.get("vendor_referral_code")
    vendor_user_id = str(row.get("vendor_user_id") or "").strip()
    if code and vendor_user_id:
        _, discount, tier_min = resolve_referral_pricing_inputs(
            vendor_user_id,
            str(code),
            vendor_portion,
            require_valid_when_provided=False,
        )
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
