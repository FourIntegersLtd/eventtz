"""Staff routes: manage creator partners and track the vendors they brought in."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.errors import error_responses
from app.features.referrals import service_partners
from app.features.referrals.errors import (
    DisplayNameEmpty,
    DisplayNameRequired,
    InvalidSlug,
    NoFieldsToUpdate,
    PartnerNotCreated,
    PartnerNotFound,
    SignupNotFound,
)
from app.features.referrals.schemas import (
    CreateReferralPartnerRequest,
    ReferralPartnerListResponse,
    ReferralPartnerResponse,
    ReferralSignupListResponse,
    ReferralVendorSignupRow,
    ShoutoutFilter,
    UpdateReferralPartnerRequest,
    UpdateReferralShoutoutRequest,
)

router = APIRouter(prefix="/admin/referrals", tags=["admin", "referrals"])

# The largest sign-up page staff can ask for.
MAX_SIGNUPS_PAGE = 200


@router.get("/partners", response_model=ReferralPartnerListResponse, responses=error_responses(*ROLE_ERRORS))
def list_partners(principal: CurrentStaff) -> ReferralPartnerListResponse:
    """Every partner, newest first, with the link each one shares."""
    return ReferralPartnerListResponse(partners=service_partners.list_partners())


@router.post(
    "/partners",
    response_model=ReferralPartnerResponse,
    responses=error_responses(*ROLE_ERRORS, DisplayNameRequired, InvalidSlug, PartnerNotCreated),
)
def create_partner(principal: CurrentStaff, body: CreateReferralPartnerRequest) -> ReferralPartnerResponse:
    """Add a partner; the slug comes from the chosen slug or the name, made unique with `-2`, `-3`, ..."""
    return ReferralPartnerResponse(partner=service_partners.create_partner(principal.id, body))


@router.patch(
    "/partners/{partner_id}",
    response_model=ReferralPartnerResponse,
    responses=error_responses(*ROLE_ERRORS, NoFieldsToUpdate, DisplayNameEmpty, PartnerNotFound),
)
def update_partner(
    principal: CurrentStaff, partner_id: str, body: UpdateReferralPartnerRequest
) -> ReferralPartnerResponse:
    """Edit a partner's name, handle, notes or on/off switch (the slug never changes)."""
    return ReferralPartnerResponse(partner=service_partners.update_partner(principal.id, partner_id, body))


@router.get(
    "/partners/{partner_id}/signups",
    response_model=ReferralSignupListResponse,
    responses=error_responses(*ROLE_ERRORS, PartnerNotFound),
)
def list_signups(
    principal: CurrentStaff,
    partner_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=MAX_SIGNUPS_PAGE),
    shoutout: ShoutoutFilter = "all",
) -> ReferralSignupListResponse:
    """One page of the vendors a partner brought in, newest first, optionally by shout-out state."""
    return service_partners.list_signups(partner_id, shoutout=shoutout, offset=offset, limit=limit)


@router.patch(
    "/signups/{user_id}",
    response_model=ReferralVendorSignupRow,
    responses=error_responses(*ROLE_ERRORS, SignupNotFound),
)
def set_shoutout(
    principal: CurrentStaff, user_id: str, body: UpdateReferralShoutoutRequest
) -> ReferralVendorSignupRow:
    """Mark the partner as thanked (or not) for bringing in this vendor."""
    return service_partners.set_shoutout(principal.id, user_id, completed=body.shoutout_completed)
