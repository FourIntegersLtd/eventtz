"""Request and response shapes for the realtime routes."""

from __future__ import annotations

from pydantic import BaseModel


class StreamTicketResponse(BaseModel):
    """A short-lived ticket the caller's browser opens `GET /realtime/stream` with."""

    ticket: str
    expires_in_seconds: int
