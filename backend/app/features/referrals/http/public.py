"""Public referral partner lookup (register page banner)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.contracts.referrals import ReferralPartnerPublicResponse
from app.features.referrals import messages as referral_messages
from app.features.referrals.partners import get_active_partner_by_slug

router = APIRouter(prefix="/referrals", tags=["referrals"])


@router.get("/partners/{slug}", response_model=ReferralPartnerPublicResponse)
def get_public_referral_partner(slug: str) -> ReferralPartnerPublicResponse:
    partner = get_active_partner_by_slug(slug)
    if not partner:
        raise HTTPException(status_code=404, detail=referral_messages.LINK_NOT_FOUND)
    return ReferralPartnerPublicResponse(
        slug=str(partner.get("slug") or slug),
        display_name=str(partner.get("display_name") or ""),
    )
