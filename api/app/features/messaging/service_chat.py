"""Client and vendor chat: opening DMs, the inbox, reading and sending messages, unread counts.

The end user's side of a support thread goes through these same use cases; only
staff use `service_support`. Every change tells the affected people's screens to
refresh their unread badge once the transaction commits.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.events import publish_after_commit, user_topic
from app.features.disputes import service_participant as disputes
from app.features.identity import service as identity
from app.features.marketplace import service_events as marketplace_events
from app.features.messaging import domain, repository, repository_bookings
from app.features.messaging.errors import (
    ChatPortalOnly,
    ClientBookingsOnly,
    ConversationNotFound,
    ConversationNotFoundOnSend,
    NotInConversation,
    NotInConversationOnRead,
    NotVendorAccount,
    SelfChat,
    VendorNotFound,
    VendorUnavailable,
)
from app.features.messaging.rows import ThreadRow
from app.features.messaging.schemas import ConversationRow, MessageRow
from app.features.vendors import service_listing as vendor_listing

# The funnel event a vendor's reply on an enquiry thread records.
VENDOR_MESSAGE_SENT = "vendor_message_sent"


def _require_chat_portal(principal: Principal) -> None:
    """Only clients and vendors have a `/chat` inbox; staff use the support inbox."""
    if principal.user_type not in ("client", "vendor"):
        raise ChatPortalOnly()


async def _dm_item_for_client(session: AsyncSession, thread: ThreadRow) -> ConversationRow:
    """A DM as its client sees it: the vendor is the peer, with the client's unread count."""
    client_id = thread.client_user_id or ""
    vendor_id = thread.vendor_user_id or ""
    names = await vendor_listing.display_names(session, [vendor_id])
    unread = await repository.unread_counts_for_user(session, client_id)
    return ConversationRow.model_validate(
        domain.conversation_item(
            thread,
            client_id,
            peer_display_name=names.get(vendor_id, domain.VENDOR_DISPLAY_FALLBACK),
            unread_count=unread.get(thread.id, 0),
        )
    )


async def _open_dm(
    session: AsyncSession, *, client_user_id: str, vendor_user_id: str, require_bookable: bool
) -> ConversationRow:
    """The pair's DM, started if needed, after checking the vendor side is a real (and listed) vendor."""
    if client_user_id == vendor_user_id:
        raise SelfChat()
    vendor_type = (await identity.user_types(session, [vendor_user_id])).get(vendor_user_id)
    if vendor_type is None:
        raise VendorNotFound()
    if vendor_type != "vendor":
        raise NotVendorAccount()
    if require_bookable and await vendor_listing.listed_vendor(session, vendor_user_id) is None:
        raise VendorUnavailable()
    thread = await repository.get_or_insert_dm(
        session, client_user_id=client_user_id, vendor_user_id=vendor_user_id
    )
    return await _dm_item_for_client(session, thread)


async def open_conversation(
    session: AsyncSession, principal: Principal, peer_user_id: str
) -> ConversationRow:
    """Open (or reopen) a DM with a vendor (as a client) or a client who has enquired (as a vendor).

    The row is always shaped for the client, even when a vendor opened it: the
    baseline did this and the web relies only on the id, so it is kept.
    """
    peer_id = peer_user_id.strip()
    if principal.user_type == "client":
        return await _open_dm(
            session, client_user_id=principal.id, vendor_user_id=peer_id, require_bookable=True
        )
    if principal.user_type == "vendor":
        if not await repository_bookings.has_booking_between(
            session, vendor_user_id=principal.id, client_user_id=peer_id
        ):
            raise ClientBookingsOnly()
        return await _open_dm(
            session, client_user_id=peer_id, vendor_user_id=principal.id, require_bookable=False
        )
    raise ChatPortalOnly()


async def _peer_names(
    session: AsyncSession, principal: Principal, threads: list[ThreadRow]
) -> dict[str, str]:
    """What the viewer calls each DM peer: business names for vendors, client names (or "Eventtz Admin")."""
    dm_threads = [thread for thread in threads if not domain.is_support(thread)]
    peer_ids = sorted({domain.dm_peer_id(thread, principal.id) for thread in dm_threads} - {""})
    if not peer_ids:
        return {}
    if principal.user_type == "client":
        names = await vendor_listing.display_names(session, peer_ids)
        return {peer_id: names.get(peer_id, domain.VENDOR_DISPLAY_FALLBACK) for peer_id in peer_ids}
    types = await identity.user_types(session, peer_ids)
    client_names = await identity.client_display_names(session, peer_ids)
    return {
        peer_id: domain.client_peer_label(user_type=types.get(peer_id), client_name=client_names.get(peer_id))
        for peer_id in peer_ids
    }


async def list_conversations(session: AsyncSession, principal: Principal) -> list[ConversationRow]:
    """Every thread the caller is on (DMs and their support thread), newest activity first."""
    page, _total = await list_conversations_page(session, principal, kind=None, offset=0, limit=10_000)
    return page


async def list_conversations_page(
    session: AsyncSession,
    principal: Principal,
    *,
    kind: str | None,
    offset: int,
    limit: int,
) -> tuple[list[ConversationRow], int]:
    """One page of the caller's inbox, optionally filtered to DMs or support only."""
    _require_chat_portal(principal)
    threads, total = await repository.threads_for_user_page(
        session, principal.id, kind=kind, offset=offset, limit=limit
    )
    names = await _peer_names(session, principal, threads)
    unread = await repository.unread_counts_for_user(session, principal.id)
    rows = [
        ConversationRow.model_validate(
            domain.conversation_item(
                thread,
                principal.id,
                peer_display_name=names.get(domain.dm_peer_id(thread, principal.id), ""),
                unread_count=unread.get(thread.id, 0),
            )
        )
        for thread in threads
    ]
    return rows, total


async def _participant_thread(session: AsyncSession, principal: Principal, conversation_id: str) -> ThreadRow:
    """The thread, if the caller is on it; otherwise "not found" (so ids of others' threads leak nothing)."""
    thread = await repository.get_thread(session, conversation_id)
    if thread is None or domain.role_in_conversation(thread, principal.id) is None:
        raise ConversationNotFound()
    return thread


async def get_conversation(
    session: AsyncSession, principal: Principal, conversation_id: str
) -> ConversationRow:
    """One of the caller's threads, shaped as in their inbox."""
    thread = await _participant_thread(session, principal, conversation_id)
    names = await _peer_names(session, principal, [thread])
    unread = await repository.unread_counts_for_user(session, principal.id)
    return ConversationRow.model_validate(
        domain.conversation_item(
            thread,
            principal.id,
            peer_display_name=names.get(domain.dm_peer_id(thread, principal.id), ""),
            unread_count=unread.get(thread.id, 0),
        )
    )


async def list_messages(
    session: AsyncSession, principal: Principal, conversation_id: str, *, limit: int
) -> list[MessageRow]:
    """The newest messages of one of the caller's threads, oldest first. Staff are masked on support."""
    thread = await _participant_thread(session, principal, conversation_id)
    support_user_id = thread.support_user_id if domain.is_support(thread) else None
    messages = await repository.latest_messages(session, thread.id, limit=limit)
    return [
        MessageRow.model_validate(domain.message_item(message, support_user_id=support_user_id))
        for message in messages
    ]


async def _support_staff_ids(session: AsyncSession) -> list[str]:
    """Every staff member who should see a support badge change."""
    return await identity.open_user_ids_of_type(session, "admin", include_suspended=False)


async def send_message(
    session: AsyncSession, principal: Principal, conversation_id: str, raw_body: str
) -> MessageRow:
    """Post a message as the caller and tell the other side's screens.

    A vendor's reply on an enquiry thread stamps the request's first response
    time (only the first counts) and records a funnel event.
    """
    body = domain.user_message_body(raw_body)
    thread = await repository.get_thread(session, conversation_id)
    if thread is None:
        raise ConversationNotFoundOnSend()
    role = domain.role_in_conversation(thread, principal.id)
    if role is None:
        raise NotInConversation()
    message = await repository.insert_message(
        session, conversation_id=thread.id, sender_user_id=principal.id, body=body
    )
    if role == "vendor":
        booking_id = await repository_bookings.mark_vendor_first_response(
            session, conversation_id=thread.id, vendor_user_id=principal.id
        )
        if booking_id:
            await marketplace_events.record_marketplace_event(
                session,
                VENDOR_MESSAGE_SENT,
                actor_user_id=principal.id,
                vendor_user_id=principal.id,
                booking_request_id=booking_id,
            )
    publish_after_commit(session, user_topic(principal.id), domain.CHAT_UNREAD_CHANGED)
    if domain.is_support(thread):
        recipients = [staff_id for staff_id in await _support_staff_ids(session) if staff_id != principal.id]
    else:
        recipients = [domain.dm_peer_id(thread, principal.id)]
    for recipient_id in recipients:
        if recipient_id:
            publish_after_commit(session, user_topic(recipient_id), domain.CHAT_UNREAD_CHANGED)
    if not domain.is_support(thread):
        await disputes.wake_parties_after_chat_reply(session, thread.id)
    return MessageRow(
        id=message.id,
        sender_user_id=message.sender_user_id,
        body=message.body,
        created_at=message.created_at,
    )


async def mark_read(session: AsyncSession, principal: Principal, conversation_id: str) -> None:
    """Move the caller's read cursor on the thread to now."""
    thread = await repository.get_thread(session, conversation_id)
    if thread is None:
        raise ConversationNotFound()
    role = domain.role_in_conversation(thread, principal.id)
    if role is None:
        raise NotInConversationOnRead()
    await repository.set_read_cursor(session, thread.id, domain.read_cursor_column(role))
    publish_after_commit(session, user_topic(principal.id), domain.CHAT_UNREAD_CHANGED)


async def unread_count(session: AsyncSession, principal: Principal) -> int:
    """Messages waiting for the caller across all their threads."""
    return sum((await repository.unread_counts_for_user(session, principal.id)).values())
