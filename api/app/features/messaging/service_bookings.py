"""Chat side effects of bookings: the client's notes as the first message, the quote card, thread checks.

Bookings calls these; they never read or write `booking_requests`. Each tells both
people's inbox badge to refresh once the transaction commits.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.events import publish_after_commit, user_topic
from app.features.messaging import domain, repository
from app.features.messaging.errors import BookingConversationMismatch, QuoteConversationNotFound

# The metadata `source` that marks a message as a booking's notes, so they are posted once.
BOOKING_NOTES_SOURCE = "booking_notes"
# How many of the client's earliest messages are searched for notes already posted.
NOTES_LOOKBACK = 40
QUOTE_SENT_BODY = "Sent a custom quote - {event_name} ({total_label})"


def _refresh_badges(session: AsyncSession, *user_ids: str) -> None:
    """Tell each person's screens their unread count may have changed."""
    for user_id in user_ids:
        if user_id:
            publish_after_commit(session, user_topic(user_id), domain.CHAT_UNREAD_CHANGED)


async def _notes_already_posted(
    session: AsyncSession, *, conversation_id: str, client_user_id: str, notes: str
) -> bool:
    """True when the client already posted these notes (or any booking's notes) in the thread."""
    earliest = await repository.earliest_messages(session, conversation_id, limit=NOTES_LOOKBACK * 5)
    client_messages = [message for message in earliest if message.sender_user_id == client_user_id]
    for message in client_messages[:NOTES_LOOKBACK]:
        if (message.metadata or {}).get("source") == BOOKING_NOTES_SOURCE:
            return True
        if message.body.strip() == notes:
            return True
    return False


async def post_booking_notes(
    session: AsyncSession,
    *,
    booking_id: str,
    client_user_id: str,
    vendor_user_id: str,
    notes: str | None,
    conversation_id: str | None,
) -> str | None:
    """Put the client's booking notes in their DM with the vendor, once, and return the thread id.

    Opens the DM when the booking has none yet. Safe to call again (on create and on
    every open of the booking). Without notes nothing happens and the given id comes back.
    """
    text = (notes or "").strip()
    existing_id = (conversation_id or "").strip() or None
    if not text or not booking_id:
        return existing_id
    thread_id = existing_id
    if thread_id is None:
        thread = await repository.get_or_insert_dm(
            session, client_user_id=client_user_id, vendor_user_id=vendor_user_id
        )
        thread_id = thread.id
    if not await _notes_already_posted(
        session, conversation_id=thread_id, client_user_id=client_user_id, notes=text
    ):
        await repository.insert_message(
            session,
            conversation_id=thread_id,
            sender_user_id=client_user_id,
            body=text,
            metadata={"source": BOOKING_NOTES_SOURCE, "booking_id": booking_id},
        )
        _refresh_badges(session, client_user_id, vendor_user_id)
    return thread_id


async def require_pair_thread(
    session: AsyncSession, *, conversation_id: str, client_user_id: str, vendor_user_id: str
) -> None:
    """Fail unless the thread is the DM between exactly this client and vendor."""
    thread = await repository.get_thread(session, conversation_id)
    if thread is None:
        raise QuoteConversationNotFound()
    if (
        domain.is_support(thread)
        or thread.client_user_id != client_user_id
        or thread.vendor_user_id != vendor_user_id
    ):
        raise BookingConversationMismatch()


async def post_quote_card(
    session: AsyncSession,
    *,
    conversation_id: str,
    vendor_user_id: str,
    client_user_id: str,
    booking_request_id: str,
    event_name: str,
    total_label: str,
) -> None:
    """Add the "quote sent" card to the thread; the web renders it from the metadata."""
    await repository.insert_message(
        session,
        conversation_id=conversation_id,
        sender_user_id=vendor_user_id,
        body=QUOTE_SENT_BODY.format(event_name=event_name, total_label=total_label),
        metadata={
            "kind": "quote",
            "booking_request_id": booking_request_id,
            "event_name": event_name,
            "total_label": total_label,
        },
    )
    _refresh_badges(session, vendor_user_id, client_user_id)
