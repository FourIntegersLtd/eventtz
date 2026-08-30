"""Validate vendor client referral codes and resolve tier discounts."""

from __future__ import annotations

from app.core.constants import BOOKING_SERVICE_FEE_PERCENT
from app.features.bookings.pricing import build_pricing_breakdown
from app.features.vendor_referrals.codes import (
    get_vendor_referral_row_by_code,
    normalize_client_referral_code,
)
from app.features.vendor_referrals.tiers import (
    referral_fee_discount_for_spend,
    referral_tier_min_spend,
    referral_tiers_for_display,
)


def _reject_invalid_code(*, required: bool) -> None:
    if not required:
        return
    from app.features.vendor_referrals import messages as referral_messages

    raise ValueError(referral_messages.REFERRAL_CODE_INVALID)


def validate_vendor_referral_code(
    vendor_user_id: str,
    referral_code: str | None,
    *,
    require_valid_when_provided: bool = True,
) -> str | None:
    """Return normalized code when valid for this vendor, else None or raise."""
    normalized = normalize_client_referral_code(referral_code)
    if not normalized:
        if referral_code and str(referral_code).strip():
            _reject_invalid_code(required=require_valid_when_provided)
        return None

    row = get_vendor_referral_row_by_code(normalized)
    if not row:
        _reject_invalid_code(required=require_valid_when_provided)
        return None

    if str(row.get("user_id") or "") != str(vendor_user_id or "").strip():
        _reject_invalid_code(required=require_valid_when_provided)
        return None

    if not bool(row.get("client_referral_enabled", True)):
        _reject_invalid_code(required=require_valid_when_provided)
        return None

    if str(row.get("approval_status") or "") != "approved":
        _reject_invalid_code(required=require_valid_when_provided)
        return None

    return normalized


def resolve_referral_pricing_inputs(
    vendor_user_id: str,
    referral_code: str | None,
    vendor_portion_gbp: float,
    *,
    require_valid_when_provided: bool = True,
) -> tuple[str | None, float, float | None]:
    """
    Return (normalized_code, referral_fee_discount_gbp, tier_min_spend_gbp).

    Discount is tier amount capped later in build_pricing_breakdown.
    """
    normalized = validate_vendor_referral_code(
        vendor_user_id,
        referral_code,
        require_valid_when_provided=require_valid_when_provided,
    )
    if not normalized:
        return None, 0.0, None
    discount = referral_fee_discount_for_spend(vendor_portion_gbp)
    tier_min = referral_tier_min_spend(vendor_portion_gbp) if discount > 0 else None
    return normalized, discount, tier_min


def preview_referral_discount_for_vendor(
    vendor_user_id: str,
    referral_code: str | None,
    vendor_portion_gbp: float,
) -> dict[str, object]:
    """Public browse preview: valid flag, tiers, and projected fee with discount."""
    normalized, discount, tier_min = resolve_referral_pricing_inputs(
        vendor_user_id,
        referral_code,
        vendor_portion_gbp,
        require_valid_when_provided=False,
    )
    code_valid = bool(normalized)
    discount_applies = code_valid and discount > 0
    pb = build_pricing_breakdown(
        line_items=[{"unit_price_gbp": max(0.0, vendor_portion_gbp)}],
        vendor_adjustments=[],
        referral_fee_discount_gbp=discount if code_valid else 0.0,
    )
    return {
        "valid": discount_applies,
        "code_valid": code_valid,
        "tiers": referral_tiers_for_display(),
        "service_fee_percent": float(BOOKING_SERVICE_FEE_PERCENT),
        "qualified_discount_gbp": discount if code_valid else 0.0,
        "tier_min_spend_gbp": tier_min,
        "service_fee_before_discount_gbp": float(pb.get("service_fee_before_discount_gbp") or 0),
        "service_fee_gbp": float(pb.get("service_fee_gbp") or 0),
        "normalized_code": normalized,
    }
