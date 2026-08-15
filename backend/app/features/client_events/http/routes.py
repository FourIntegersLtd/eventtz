"""Client events HTTP routes."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.contracts.client_event import (
    ClientEventDetail,
    ClientEventDetailResponse,
    ClientEventSummary,
    ClientEventsListResponse,
)
from app.features.auth.http.guards import require_client
from app.features.client_events import messages as client_event_messages
from app.features.client_events import events as client_events_ops

router = APIRouter(prefix="/client", tags=["client-events"])


@router.get("/events", response_model=ClientEventsListResponse)
def list_client_events(
    request: Request,
    response: Response,
    status: str = Query("active", description="active, archived, or all"),
) -> ClientEventsListResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    try:
        rows = client_events_ops.list_client_events(client_id, status=status)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return ClientEventsListResponse(events=[ClientEventSummary(**r) for r in rows])


@router.get("/events/{event_id}", response_model=ClientEventDetailResponse)
def get_client_event(
    event_id: str,
    request: Request,
    response: Response,
) -> ClientEventDetailResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    try:
        uuid.UUID(event_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=client_event_messages.INVALID_EVENT_ID) from e
    row = client_events_ops.get_client_event_by_id(client_id, event_id)
    if not row:
        raise HTTPException(status_code=404, detail=client_event_messages.EVENT_NOT_FOUND)
    counts = client_events_ops.booking_counts_by_event(client_id, [event_id])
    summary = client_events_ops.event_row_to_summary(row, counts)
    detail = ClientEventDetail(
        **summary,
        created_at=row.get("created_at"),
    )
    return ClientEventDetailResponse(event=detail)
