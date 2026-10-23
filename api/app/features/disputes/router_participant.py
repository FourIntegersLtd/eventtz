"""Participant routes: open a dispute, list one's own disputes, fetch one. One factory, two roles.

The client and the vendor get identical routes under their own prefix; only the account that
may call them differs. Built by `participant_router` so a fix lands once, not twice. This module
has no `from __future__ import annotations`: FastAPI reads the role's dependency from the
closure, and a string annotation could not resolve it.
"""

from collections.abc import Callable
from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.auth import ROLE_ERRORS, Principal, require_client, require_vendor
from app.core.db import SessionDep
from app.core.errors import InvalidBookingId, error_responses
from app.core.pagination import PageDep
from app.core.ports import MailerDependency
from app.features.disputes import errors, service_participant
from app.features.disputes.schemas import (
    CreateDisputeBody,
    CreateDisputeResponse,
    DisputeDetailResponse,
    DisputesListResponse,
)


def participant_router(role: str, require_role: Callable[..., Principal]) -> APIRouter:
    """The dispute routes for `role` ("client" or "vendor"), guarded by `require_role`."""
    router = APIRouter(prefix=f"/{role}", tags=[role])
    participant = Annotated[Principal, Depends(require_role)]

    @router.post(
        "/booking-requests/{booking_id}/disputes",
        name=f"post_{role}_dispute",
        response_model=CreateDisputeResponse,
        responses=error_responses(
            *ROLE_ERRORS,
            InvalidBookingId,
            errors.BookingNotFound,
            errors.CannotOpenDispute,
            errors.DisputeInvalidStatus,
            errors.DisputeAlreadyOpen,
        ),
    )
    async def post_dispute(
        session: SessionDep,
        mailer: MailerDependency,
        user: participant,
        booking_id: str,
        body: CreateDisputeBody,
    ) -> CreateDisputeResponse:
        """Open a dispute on one of the caller's own bookings."""
        dispute = await service_participant.open_dispute(
            session, mailer, user_id=user.id, booking_id=booking_id, summary=body.summary
        )
        return CreateDisputeResponse(dispute=dispute)

    @router.get(
        "/booking-requests/{booking_id}/disputes",
        name=f"list_{role}_booking_disputes",
        response_model=DisputesListResponse,
        responses=error_responses(*ROLE_ERRORS, InvalidBookingId),
    )
    async def list_booking_disputes(
        session: SessionDep, user: participant, booking_id: str
    ) -> DisputesListResponse:
        """Disputes on this booking; an empty list if the caller isn't a party to it."""
        disputes = await service_participant.list_disputes_on_booking(
            session, user_id=user.id, booking_id=booking_id
        )
        return DisputesListResponse(disputes=disputes)

    @router.get(
        "/disputes",
        name=f"list_{role}_disputes",
        response_model=DisputesListResponse,
        responses=error_responses(*ROLE_ERRORS),
    )
    async def list_disputes(session: SessionDep, user: participant, page: PageDep) -> DisputesListResponse:
        """Every dispute on a booking the caller is party to, most recently opened first."""
        disputes, total = await service_participant.list_own_disputes_page(
            session, user.id, offset=page.offset, limit=page.limit
        )
        open_count = await service_participant.open_dispute_count(session, user.id)
        return DisputesListResponse(
            disputes=disputes, total=total, offset=page.offset, limit=page.limit, open_count=open_count
        )

    @router.get(
        "/disputes/{dispute_id}",
        name=f"get_{role}_dispute",
        response_model=DisputeDetailResponse,
        responses=error_responses(
            *ROLE_ERRORS, errors.InvalidDisputeId, errors.DisputeNotFoundForParticipant
        ),
    )
    async def get_dispute(session: SessionDep, user: participant, dispute_id: str) -> DisputeDetailResponse:
        """One dispute, if the caller is a party to its booking."""
        dispute = await service_participant.get_dispute(session, user_id=user.id, dispute_id=dispute_id)
        return DisputeDetailResponse(dispute=dispute)

    return router


client_router = participant_router("client", require_client)
vendor_router = participant_router("vendor", require_vendor)
