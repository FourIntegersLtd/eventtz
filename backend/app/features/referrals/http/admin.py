"""Admin referral partner routes."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.contracts.referrals import (
    CreateReferralPartnerRequest,
    ReferralPartnerListResponse,
    ReferralPartnerResponse,
    ReferralPartnerRow,
    ReferralSignupListResponse,
    ReferralVendorSignupRow,
    UpdateReferralPartnerRequest,
    UpdateReferralShoutoutRequest,
)
from app.features.auth.http.guards import require_admin
from app.features.referrals.admin_list import get_signup_row, list_partner_signups
from app.features.referrals.attribution import update_shoutout_completed
from app.features.referrals.partners import create_partner, get_partner_by_id, list_partners, update_partner

router = APIRouter(prefix="/admin/referrals", tags=["admin", "referrals"])


@router.get("/partners", response_model=ReferralPartnerListResponse)
def admin_list_referral_partners(request: Request, response: Response) -> ReferralPartnerListResponse:
    require_admin(request, response)
    partners = [ReferralPartnerRow.model_validate(p) for p in list_partners()]
    return ReferralPartnerListResponse(partners=partners)


@router.post("/partners", response_model=ReferralPartnerResponse)
def admin_create_referral_partner(
    body: CreateReferralPartnerRequest,
    request: Request,
    response: Response,
) -> ReferralPartnerResponse:
    actor = require_admin(request, response)
    try:
        row = create_partner(
            display_name=body.display_name,
            instagram_handle=body.instagram_handle,
            slug=body.slug,
            notes=body.notes,
            created_by_admin_id=str(actor.get("id") or "") or None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ReferralPartnerResponse(partner=ReferralPartnerRow.model_validate(row))


@router.patch("/partners/{partner_id}", response_model=ReferralPartnerResponse)
def admin_patch_referral_partner(
    partner_id: str,
    body: UpdateReferralPartnerRequest,
    request: Request,
    response: Response,
) -> ReferralPartnerResponse:
    require_admin(request, response)
    if not body.model_dump(exclude_unset=True):
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        row = update_partner(
            partner_id,
            display_name=body.display_name,
            instagram_handle=body.instagram_handle,
            notes=body.notes,
            is_active=body.is_active,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    if not row:
        raise HTTPException(status_code=404, detail="Referral partner not found")
    return ReferralPartnerResponse(partner=ReferralPartnerRow.model_validate(row))


@router.get("/partners/{partner_id}/signups", response_model=ReferralSignupListResponse)
def admin_list_referral_signups(
    partner_id: str,
    request: Request,
    response: Response,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    shoutout: Literal["all", "pending", "completed"] = Query("all"),
) -> ReferralSignupListResponse:
    require_admin(request, response)
    partner, signups, total = list_partner_signups(
        partner_id,
        offset=offset,
        limit=limit,
        shoutout=shoutout,
    )
    if not partner:
        raise HTTPException(status_code=404, detail="Referral partner not found")
    return ReferralSignupListResponse(
        partner=ReferralPartnerRow.model_validate(partner),
        signups=[ReferralVendorSignupRow.model_validate(s) for s in signups],
        total=total,
        offset=offset,
        limit=limit,
    )


@router.patch("/signups/{user_id}", response_model=ReferralVendorSignupRow)
def admin_patch_referral_signup_shoutout(
    user_id: str,
    body: UpdateReferralShoutoutRequest,
    request: Request,
    response: Response,
) -> ReferralVendorSignupRow:
    require_admin(request, response)
    updated = update_shoutout_completed(user_id=user_id, shoutout_completed=body.shoutout_completed)
    if not updated:
        raise HTTPException(status_code=404, detail="Referral signup not found")
    row = get_signup_row(user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Referral signup not found")
    return ReferralVendorSignupRow.model_validate(row)
