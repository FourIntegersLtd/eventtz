"""Vendor routes: open a dispute on a booking, list the vendor's own disputes, fetch one."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import ROLE_ERRORS, CurrentVendor
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.ports import MailerDependency
from app.features.disputes import errors, service_participant
from app.features.disputes.schemas import (
    CreateDisputeBody,
    CreateDisputeResponse,
    DisputeDetailResponse,
    DisputesListResponse,
)

router = APIRouter(prefix="/vendor", tags=["vendor"])


@router.post(
    "/booking-requests/{booking_id}/disputes",
    response_model=CreateDisputeResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        errors.InvalidBookingId,
        errors.BookingNotFound,
        errors.CannotOpenDispute,
        errors.DisputeInvalidStatus,
        errors.DisputeAlreadyOpen,
    ),
)
async def post_vendor_dispute(
    session: SessionDep,
    mailer: MailerDependency,
    vendor: CurrentVendor,
    booking_id: str,
    body: CreateDisputeBody,
) -> CreateDisputeResponse:
    """Open a dispute on one of the vendor's own bookings."""
    dispute = await service_participant.open_dispute(
        session, mailer, user_id=vendor.id, booking_id=booking_id, summary=body.summary
    )
    return CreateDisputeResponse(dispute=dispute)


@router.get(
    "/booking-requests/{booking_id}/disputes",
    response_model=DisputesListResponse,
    responses=error_responses(*ROLE_ERRORS, errors.InvalidBookingId),
)
async def list_vendor_booking_disputes(
    session: SessionDep, vendor: CurrentVendor, booking_id: str
) -> DisputesListResponse:
    """Disputes on this booking; an empty list if the vendor isn't a party to it."""
    disputes = await service_participant.list_disputes_on_booking(
        session, user_id=vendor.id, booking_id=booking_id
    )
    return DisputesListResponse(disputes=disputes)


@router.get(
    "/disputes",
    response_model=DisputesListResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def list_vendor_disputes(session: SessionDep, vendor: CurrentVendor) -> DisputesListResponse:
    """Every dispute on a booking the vendor is party to, most recently opened first."""
    disputes = await service_participant.list_own_disputes(session, vendor.id)
    return DisputesListResponse(disputes=disputes)


@router.get(
    "/disputes/{dispute_id}",
    response_model=DisputeDetailResponse,
    responses=error_responses(*ROLE_ERRORS, errors.InvalidDisputeId, errors.DisputeNotFoundForParticipant),
)
async def get_vendor_dispute(
    session: SessionDep, vendor: CurrentVendor, dispute_id: str
) -> DisputeDetailResponse:
    """One dispute, if the vendor is a party to its booking."""
    dispute = await service_participant.get_dispute(session, user_id=vendor.id, dispute_id=dispute_id)
    return DisputeDetailResponse(dispute=dispute)
