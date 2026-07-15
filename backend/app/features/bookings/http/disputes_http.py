"""Shared problem-report handlers for client and vendor booking routes."""

from __future__ import annotations

import uuid

from fastapi import HTTPException

from app.contracts.disputes import (
    CreateParticipantDisputeBody,
    CreateParticipantDisputeResponse,
    ParticipantDisputeDetailResponse,
    ParticipantDisputePublic,
    ParticipantDisputesListResponse,
)
from app.features.bookings.disputes import (
    create_dispute_for_participant,
    get_dispute_for_participant,
    list_disputes_for_participant_user,
    list_disputes_on_booking_for_participant,
)


def create_booking_dispute(
    booking_id: str,
    uid: str,
    body: CreateParticipantDisputeBody,
) -> CreateParticipantDisputeResponse:
    row, err = create_dispute_for_participant(booking_id, uid, body.summary)
    if err == "not_found":
        raise HTTPException(status_code=404, detail="Booking not found.")
    if err == "forbidden":
        raise HTTPException(status_code=403, detail="You cannot open a dispute for this booking.")
    if err == "conflict":
        raise HTTPException(
            status_code=409,
            detail="A dispute is already open or under review for this booking.",
        )
    if err == "invalid_status":
        raise HTTPException(
            status_code=400,
            detail="Disputes cannot be opened for this booking in its current status.",
        )
    if not row:
        raise HTTPException(status_code=500, detail="Could not create dispute.")
    return CreateParticipantDisputeResponse(dispute=ParticipantDisputePublic.model_validate(row))


def list_booking_disputes(booking_id: str, uid: str) -> ParticipantDisputesListResponse:
    rows = list_disputes_on_booking_for_participant(uid, booking_id)
    items = [ParticipantDisputePublic.model_validate(r) for r in rows]
    return ParticipantDisputesListResponse(disputes=items)


def list_user_disputes(uid: str) -> ParticipantDisputesListResponse:
    rows = list_disputes_for_participant_user(uid)
    items = [ParticipantDisputePublic.model_validate(r) for r in rows]
    return ParticipantDisputesListResponse(disputes=items)


def get_dispute(dispute_id: str, uid: str) -> ParticipantDisputeDetailResponse:
    try:
        uuid.UUID(dispute_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Invalid dispute id.") from e
    row = get_dispute_for_participant(dispute_id, uid)
    if not row:
        raise HTTPException(status_code=404, detail="Dispute not found.")
    return ParticipantDisputeDetailResponse(dispute=ParticipantDisputePublic.model_validate(row))
