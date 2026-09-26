"""Client routes: open a dispute on a booking, list the client's own disputes, fetch one."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import ROLE_ERRORS, CurrentClient
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.features.disputes import errors, service_participant
from app.features.disputes.schemas import (
    CreateDisputeBody,
    CreateDisputeResponse,
    DisputeDetailResponse,
    DisputesListResponse,
)

router = APIRouter(prefix="/client", tags=["client"])


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
async def post_client_dispute(
    session: SessionDep, client: CurrentClient, booking_id: str, body: CreateDisputeBody
) -> CreateDisputeResponse:
    """Open a dispute on one of the client's own bookings."""
    dispute = await service_participant.open_dispute(
        session, user_id=client.id, booking_id=booking_id, summary=body.summary
    )
    return CreateDisputeResponse(dispute=dispute)


@router.get(
    "/booking-requests/{booking_id}/disputes",
    response_model=DisputesListResponse,
    responses=error_responses(*ROLE_ERRORS, errors.InvalidBookingId),
)
async def list_client_booking_disputes(
    session: SessionDep, client: CurrentClient, booking_id: str
) -> DisputesListResponse:
    """Disputes on this booking; an empty list if the client isn't a party to it."""
    disputes = await service_participant.list_disputes_on_booking(
        session, user_id=client.id, booking_id=booking_id
    )
    return DisputesListResponse(disputes=disputes)


@router.get(
    "/disputes",
    response_model=DisputesListResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def list_client_disputes(session: SessionDep, client: CurrentClient) -> DisputesListResponse:
    """Every dispute on a booking the client is party to, most recently opened first."""
    disputes = await service_participant.list_own_disputes(session, client.id)
    return DisputesListResponse(disputes=disputes)


@router.get(
    "/disputes/{dispute_id}",
    response_model=DisputeDetailResponse,
    responses=error_responses(*ROLE_ERRORS, errors.InvalidDisputeId, errors.DisputeNotFoundForParticipant),
)
async def get_client_dispute(
    session: SessionDep, client: CurrentClient, dispute_id: str
) -> DisputeDetailResponse:
    """One dispute, if the client is a party to its booking."""
    dispute = await service_participant.get_dispute(session, user_id=client.id, dispute_id=dispute_id)
    return DisputeDetailResponse(dispute=dispute)
