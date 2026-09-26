"""Account settings routes: `/user/contact-settings` and the client's `/client/onboarding`."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import ROLE_ERRORS, CurrentClient, CurrentUser
from app.core.errors import error_responses
from app.features.identity import service_settings
from app.features.identity.schemas import (
    ClientOnboardingPatchBody,
    ClientOnboardingResponse,
    ContactSharingSettingsPutBody,
    ContactSharingSettingsResponse,
)

router = APIRouter()


@router.get(
    "/user/contact-settings",
    tags=["user"],
    response_model=ContactSharingSettingsResponse,
    responses=error_responses(*ROLE_ERRORS),
)
def get_contact_settings(principal: CurrentUser) -> ContactSharingSettingsResponse:
    """What the caller shares with the other side of a paid booking."""
    return ContactSharingSettingsResponse(settings=service_settings.contact_settings(principal.id))


@router.put(
    "/user/contact-settings",
    tags=["user"],
    response_model=ContactSharingSettingsResponse,
    responses=error_responses(*ROLE_ERRORS),
)
def put_contact_settings(
    body: ContactSharingSettingsPutBody, principal: CurrentUser
) -> ContactSharingSettingsResponse:
    """Change what the caller shares; omitted fields are left alone."""
    return ContactSharingSettingsResponse(settings=service_settings.update_contact_settings(principal, body))


@router.get(
    "/client/onboarding",
    tags=["client"],
    response_model=ClientOnboardingResponse,
    responses=error_responses(*ROLE_ERRORS),
)
def get_onboarding(principal: CurrentClient) -> ClientOnboardingResponse:
    """Whether the client finished first-visit setup, and their preferred name."""
    return ClientOnboardingResponse(onboarding=service_settings.client_onboarding(principal.id))


@router.patch(
    "/client/onboarding",
    tags=["client"],
    response_model=ClientOnboardingResponse,
    responses=error_responses(*ROLE_ERRORS),
)
def patch_onboarding(body: ClientOnboardingPatchBody, principal: CurrentClient) -> ClientOnboardingResponse:
    """Set the client's preferred name and/or mark first-visit setup done."""
    return ClientOnboardingResponse(onboarding=service_settings.update_client_onboarding(principal.id, body))
