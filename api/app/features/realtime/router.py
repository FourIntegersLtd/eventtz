"""Realtime routes: mint a stream ticket, then stream that user's events over SSE.

`POST /stream-ticket` is not in the baseline (it authenticates with a cookie
there); it is a new, additive route the parity guard allows because it does
not rename or remove anything the baseline serves (see `README.md`'s Routes
section for the corresponding `openapi.baseline.json` entry).
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from starlette.responses import StreamingResponse

from app.core.auth import ROLE_ERRORS, CurrentUser
from app.core.errors import error_responses
from app.core.events import get_event_bus, user_topic
from app.core.sse import MEDIA_TYPE, SSE_HEADERS, event_stream
from app.features.realtime import service
from app.features.realtime.errors import InvalidStreamTicket
from app.features.realtime.schemas import StreamTicketResponse

router = APIRouter(prefix="/realtime", tags=["realtime"])


@router.post(
    "/stream-ticket",
    response_model=StreamTicketResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def issue_stream_ticket_route(principal: CurrentUser) -> StreamTicketResponse:
    """Mint a short-lived ticket the caller's browser can open the stream with."""
    return service.issue_ticket_for(principal)


@router.get(
    "/stream",
    responses=error_responses(InvalidStreamTicket),
)
async def stream(ticket: str | None = Query(default=None)) -> StreamingResponse:
    """Server-sent events for the user `ticket` names: `connected`, then business events.

    Authenticates through the `ticket` query parameter rather than a Bearer
    header, because `EventSource` cannot set one (ADR 0005). No response model:
    a stream has no single JSON body, only the frames `core.sse.event_stream` yields.
    """
    user_id = service.user_id_for_ticket(ticket)
    return StreamingResponse(
        event_stream(topics=[user_topic(user_id)], bus=get_event_bus()),
        media_type=MEDIA_TYPE,
        headers=SSE_HEADERS,
    )
