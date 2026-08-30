"""Public vendor client referral preview (browse / booking modal)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.contracts.vendor_referrals import VendorReferralPreviewResponse, ReferralFeeTier
from app.features.vendor_referrals.validate import preview_referral_discount_for_vendor

router = APIRouter(prefix="/vendors", tags=["vendor-referrals"])


@router.get(
    "/explore/vendor/{vendor_user_id}/referral-preview",
    response_model=VendorReferralPreviewResponse,
)
def get_vendor_referral_preview(
    vendor_user_id: str,
    code: str = "",
    vendor_portion_gbp: float = Query(0.0, ge=0.0, le=10_000_000.0),
) -> VendorReferralPreviewResponse:
    preview = preview_referral_discount_for_vendor(
        vendor_user_id,
        code or None,
        vendor_portion_gbp,
    )
    tiers = [ReferralFeeTier(**t) for t in preview.get("tiers") or []]
    return VendorReferralPreviewResponse(
        valid=bool(preview.get("valid")),
        code_valid=bool(preview.get("code_valid")),
        tiers=tiers,
        service_fee_percent=float(preview.get("service_fee_percent") or 5.0),
        qualified_discount_gbp=float(preview.get("qualified_discount_gbp") or 0),
        tier_min_spend_gbp=preview.get("tier_min_spend_gbp"),  # type: ignore[arg-type]
        service_fee_before_discount_gbp=float(preview.get("service_fee_before_discount_gbp") or 0),
        service_fee_gbp=float(preview.get("service_fee_gbp") or 0),
    )
