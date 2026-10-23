"""Staff routes: manage creator partners and track the vendors they brought in."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.pagination import PageDep, PageParams, page_params
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
async def list_partners(
    session: SessionDep,
    principal: CurrentStaff,
    page: PageDep,
) -> ReferralPartnerListResponse:
    """Every partner, newest first, with the link each one shares."""
    partners, total = await service_partners.list_partners_page(session, offset=page.offset, limit=page.limit)
    return ReferralPartnerListResponse(partners=partners, total=total, offset=page.offset, limit=page.limit)


@router.post(
    "/partners",
    response_model=ReferralPartnerResponse,
    responses=error_responses(*ROLE_ERRORS, DisplayNameRequired, InvalidSlug, PartnerNotCreated),
)
async def create_partner(
    session: SessionDep, principal: CurrentStaff, body: CreateReferralPartnerRequest
) -> ReferralPartnerResponse:
    """Add a partner; the slug comes from the chosen slug or the name, made unique with `-2`, `-3`, ..."""
    return ReferralPartnerResponse(partner=await service_partners.create_partner(session, principal.id, body))


@router.patch(
    "/partners/{partner_id}",
    response_model=ReferralPartnerResponse,
    responses=error_responses(*ROLE_ERRORS, NoFieldsToUpdate, DisplayNameEmpty, PartnerNotFound),
)
async def update_partner(
    session: SessionDep, principal: CurrentStaff, partner_id: str, body: UpdateReferralPartnerRequest
) -> ReferralPartnerResponse:
    """Edit a partner's name, handle, notes or on/off switch (the slug never changes)."""
    return ReferralPartnerResponse(
        partner=await service_partners.update_partner(session, principal.id, partner_id, body)
    )


@router.get(
    "/partners/{partner_id}/signups",
    response_model=ReferralSignupListResponse,
    responses=error_responses(*ROLE_ERRORS, PartnerNotFound),
)
async def list_signups(
    session: SessionDep,
    principal: CurrentStaff,
    partner_id: str,
    page: Annotated[PageParams, Depends(page_params(max_limit=MAX_SIGNUPS_PAGE))],
    shoutout: ShoutoutFilter = "all",
) -> ReferralSignupListResponse:
    """One page of the vendors a partner brought in, newest first, optionally by shout-out state."""
    return await service_partners.list_signups(
        session, partner_id, shoutout=shoutout, offset=page.offset, limit=page.limit
    )


@router.patch(
    "/signups/{user_id}",
    response_model=ReferralVendorSignupRow,
    responses=error_responses(*ROLE_ERRORS, SignupNotFound),
)
async def set_shoutout(
    session: SessionDep, principal: CurrentStaff, user_id: str, body: UpdateReferralShoutoutRequest
) -> ReferralVendorSignupRow:
    """Mark the partner as thanked (or not) for bringing in this vendor."""
    return await service_partners.set_shoutout(
        session, principal.id, user_id, completed=body.shoutout_completed
    )
