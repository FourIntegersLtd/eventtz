"""The vendor's own profile routes: load, save, submit, and check a business name."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.auth import AUTH_ERRORS, ROLE_ERRORS, CurrentUser, CurrentVendor
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import MailerDependency, StorageDependency
from app.features.vendors import service_profile
from app.features.vendors.errors import BusinessNameTaken, ProfileInvalid
from app.features.vendors.schemas import (
    VendorBusinessNameAvailabilityResponse,
    VendorProfilePutBody,
    VendorProfileState,
)

router = APIRouter(prefix="/vendor", tags=["vendor"])


@router.get("/profile", response_model=VendorProfileState, responses=error_responses(*AUTH_ERRORS))
async def get_profile(session: SessionDep, principal: CurrentUser) -> VendorProfileState:
    """The caller's onboarding form and listing state (a blank draft before they start)."""
    return await service_profile.get_profile_state(session, principal)


@router.get(
    "/profile/business-name-available",
    response_model=VendorBusinessNameAvailabilityResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def business_name_available(
    session: SessionDep,
    principal: CurrentVendor,
    business_name: Annotated[str, Query(min_length=1, max_length=200)],
) -> VendorBusinessNameAvailabilityResponse:
    """Whether another vendor already uses this business name."""
    available = await service_profile.is_business_name_available(session, principal, business_name)
    return VendorBusinessNameAvailabilityResponse(available=available)


@router.put(
    "/profile",
    response_model=VendorProfileState,
    responses=error_responses(*AUTH_ERRORS, ProfileInvalid, BusinessNameTaken),
)
async def save_profile(
    session: SessionDep,
    principal: CurrentUser,
    body: VendorProfilePutBody,
    storage: StorageDependency,
    mailer: MailerDependency,
) -> VendorProfileState:
    """Save a step of the onboarding form, or submit it for review."""
    return await service_profile.save_profile(session, principal, body, storage=storage, mailer=mailer)
