"""Errors the realtime routes raise."""

from __future__ import annotations

from app.core.errors import Unauthenticated


class InvalidStreamTicket(Unauthenticated):
    """The `ticket` query parameter is missing, expired, badly signed, or not a stream ticket."""

    code = "invalid_stream_ticket"
    default_message = "This live-update link has expired. Reconnect to get a new one."
