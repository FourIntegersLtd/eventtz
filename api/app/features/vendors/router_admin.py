"""Staff routes for moderating vendors: the list, approval, returns for edits, nudges, listing controls."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import ImmediateMailerDependency, MailerDependency, StorageDependency
from app.features.vendors import service_moderation
from app.features.vendors.errors import (
    ListingMediaUrlInvalid,
    ListingOverrideReasonRequired,
    ListingOverrideSuperAdminOnly,
    OnlyPendingToDraft,
    OnlySubmittedToDraft,
    VendorProfileNotFound,
)
from app.features.vendors.schemas import (
    AdminVendorApprovalBody,
    AdminVendorApprovalResponse,
    AdminVendorListingMediaBody,
    AdminVendorListingMediaResponse,
    AdminVendorListingOverrideBody,
    AdminVendorListingOverrideResponse,
    AdminVendorPauseBody,
    AdminVendorPauseResponse,
    AdminVendorPayoutNudgeBody,
    AdminVendorProfileNudgeBody,
    AdminVendorProfileNudgeResponse,
    AdminVendorsListResponse,
    AdminVendorUnsubmitBody,
    AdminVendorUnsubmitResponse,
    AdminVendorWarnBody,
    AdminVendorWarnResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/vendors", response_model=AdminVendorsListResponse, responses=error_responses(*ROLE_ERRORS))
async def list_vendors(
    session: SessionDep,
    principal: CurrentStaff,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    search: Annotated[
        str | None, Query(alias="q", max_length=200, description="Part of an email or business name.")
    ] = None,
    approval_status: str | None = None,
    status: str | None = None,
) -> AdminVendorsListResponse:
    """Vendors, most recently updated first, searched and filtered."""
    return await service_moderation.list_vendors(
        session, offset=offset, limit=limit, search=search, approval_status=approval_status, status=status
    )


@router.patch(
    "/vendors/{user_id}/approval",
    response_model=AdminVendorApprovalResponse,
    responses=error_responses(*ROLE_ERRORS, VendorProfileNotFound),
)
async def set_approval(
    session: SessionDep,
    principal: CurrentStaff,
    user_id: str,
    body: AdminVendorApprovalBody,
    mailer: MailerDependency,
) -> AdminVendorApprovalResponse:
    """Approve, ban or re-queue a vendor."""
    return await service_moderation.set_approval(
        session, principal, user_id, body.approval_status, mailer=mailer, reason=body.reason
    )


@router.patch(
    "/vendors/{user_id}/listing-media",
    response_model=AdminVendorListingMediaResponse,
    responses=error_responses(*ROLE_ERRORS, ListingMediaUrlInvalid, VendorProfileNotFound),
)
async def set_listing_media(
    session: SessionDep,
    principal: CurrentStaff,
    user_id: str,
    body: AdminVendorListingMediaBody,
    storage: StorageDependency,
) -> AdminVendorListingMediaResponse:
    """Reorder or hide the vendor's listing photos."""
    return await service_moderation.set_listing_media(
        session,
        principal,
        user_id,
        display_order=body.display_order,
        hidden_image_urls=body.hidden_image_urls,
        storage=storage,
    )


@router.patch(
    "/vendors/{user_id}/unsubmit",
    response_model=AdminVendorUnsubmitResponse,
    responses=error_responses(*ROLE_ERRORS, OnlySubmittedToDraft, OnlyPendingToDraft, VendorProfileNotFound),
)
async def return_for_edits(
    session: SessionDep,
    principal: CurrentStaff,
    user_id: str,
    body: AdminVendorUnsubmitBody,
    mailer: ImmediateMailerDependency,
) -> AdminVendorUnsubmitResponse:
    """Send a submitted profile back to the vendor for edits.

    Emails during the request, not after commit: the response's `email_sent` is
    the provider's answer, which the console shows (baseline contract).
    """
    return await service_moderation.return_for_edits(
        session, principal, user_id, send_email=body.send_email, message=body.message, mailer=mailer
    )


@router.post(
    "/vendors/nudge-profile-complete",
    response_model=AdminVendorProfileNudgeResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def nudge_to_complete_profile(
    session: SessionDep,
    principal: CurrentStaff,
    body: AdminVendorProfileNudgeBody,
    mailer: ImmediateMailerDependency,
) -> AdminVendorProfileNudgeResponse:
    """Email draft vendors to finish their profile.

    Emails during the request: the response counts each provider's answer
    (`sent`/`failures`), and a nudge changes no row besides the audit entry.
    """
    return await service_moderation.nudge_to_complete_profile(
        session, principal, body.user_ids, mailer=mailer
    )


@router.post(
    "/vendors/nudge-setup-payouts",
    response_model=AdminVendorProfileNudgeResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def nudge_to_set_up_payouts(
    session: SessionDep,
    principal: CurrentStaff,
    body: AdminVendorPayoutNudgeBody,
    mailer: ImmediateMailerDependency,
) -> AdminVendorProfileNudgeResponse:
    """Email approved vendors to finish Stripe payout setup.

    Emails during the request for the same reason as the profile nudge: the
    response reports each provider's answer.
    """
    return await service_moderation.nudge_to_set_up_payouts(session, principal, body.user_ids, mailer=mailer)


@router.patch(
    "/vendors/{user_id}/listing-override",
    response_model=AdminVendorListingOverrideResponse,
    responses=error_responses(
        *ROLE_ERRORS, ListingOverrideSuperAdminOnly, ListingOverrideReasonRequired, VendorProfileNotFound
    ),
)
async def set_listing_override(
    session: SessionDep,
    principal: CurrentStaff,
    user_id: str,
    body: AdminVendorListingOverrideBody,
    mailer: MailerDependency,
) -> AdminVendorListingOverrideResponse:
    """Force a listing visible or hidden, or return it to the automatic rule."""
    return await service_moderation.set_listing_override(
        session, principal, user_id, body.listing_override, reason=body.reason, mailer=mailer
    )


@router.post(
    "/vendors/{user_id}/warn",
    response_model=AdminVendorWarnResponse,
    responses=error_responses(*ROLE_ERRORS, VendorProfileNotFound),
)
async def warn_vendor(
    session: SessionDep,
    principal: CurrentStaff,
    user_id: str,
    body: AdminVendorWarnBody,
    mailer: ImmediateMailerDependency,
) -> AdminVendorWarnResponse:
    """Email the vendor a formal warning (recorded in the audit log)."""
    return await service_moderation.warn_vendor(
        session, principal, user_id, message=body.message, mailer=mailer
    )


@router.put(
    "/vendors/{user_id}/listing-pause",
    response_model=AdminVendorPauseResponse,
    responses=error_responses(*ROLE_ERRORS, VendorProfileNotFound),
)
async def pause_listing(
    session: SessionDep,
    principal: CurrentStaff,
    user_id: str,
    body: AdminVendorPauseBody,
    mailer: MailerDependency,
) -> AdminVendorPauseResponse:
    """Hide the vendor's listing for a number of days; it returns on its own."""
    return await service_moderation.pause_listing(
        session, principal, user_id, days=body.days, reason=body.reason, mailer=mailer
    )


@router.delete(
    "/vendors/{user_id}/listing-pause",
    response_model=AdminVendorPauseResponse,
    responses=error_responses(*ROLE_ERRORS, VendorProfileNotFound),
)
async def clear_listing_pause(
    session: SessionDep, principal: CurrentStaff, user_id: str
) -> AdminVendorPauseResponse:
    """End a listing pause early."""
    return await service_moderation.clear_listing_pause(session, principal, user_id)
