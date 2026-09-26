"""Use cases: mint a stream ticket for the signed-in caller, and read one back.

No repository and no domain module: a stream ticket carries no business state
of its own, only a user id and an expiry, so `core.auth`'s JWT helpers are the
whole implementation. This module exists so the router (like every other
slice's) reaches its logic through a `service`, not by calling `core.auth`
directly, and so a future rule about tickets has one place to land.
"""

from __future__ import annotations

from app.core.auth import Principal, decode_stream_ticket, issue_stream_ticket
from app.core.settings import get_settings
from app.features.realtime.errors import InvalidStreamTicket
from app.features.realtime.schemas import StreamTicketResponse


def issue_ticket_for(principal: Principal) -> StreamTicketResponse:
    """A ticket good for `settings.stream_ticket_ttl_seconds`, naming this signed-in caller."""
    settings = get_settings()
    ticket = issue_stream_ticket(user_id=principal.id, settings=settings)
    return StreamTicketResponse(ticket=ticket, expires_in_seconds=settings.stream_ticket_ttl_seconds)


def user_id_for_ticket(ticket: str | None) -> str:
    """The user a stream ticket names, or `InvalidStreamTicket` if missing, expired or the wrong type."""
    if not ticket:
        raise InvalidStreamTicket()
    claims = decode_stream_ticket(ticket, settings=get_settings())
    if claims is None:
        raise InvalidStreamTicket()
    return claims.user_id
