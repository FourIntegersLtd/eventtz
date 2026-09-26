"""Staff side of Eventtz Support: sending to users, the support inbox, replies and edits, the chat viewer.

Staff messages are sanitised HTML. Each one reaching a user also emails them a
copy (best effort) and refreshes their unread badge. Every staff action is written
to the audit log.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.events import publish_after_commit, user_topic
from app.core.ports import Mailer
from app.core.site import public_url
from app.features.identity import service as identity
from app.features.messaging import domain, repository
from app.features.messaging.domain_sanitize import message_plain_text
from app.features.messaging.errors import (
    BroadcastSuperAdminOnly,
    EditOwnMessagesOnly,
    MessageNotFound,
    RecipientsRequired,
    StaffMessagesOnly,
    SupportConversationNotFound,
)
from app.features.messaging.rows import StoredMessageRow, ThreadRow
from app.features.messaging.schemas import (
    AdminChatMessageItem,
    AdminConversationMessagesResponse,
    AdminMessageSendFailure,
    AdminMessageSendResponse,
    AdminSupportConversationRow,
    AdminSupportMessageRow,
)
from app.features.notifications import service as notifications
from app.features.staff import service as staff
from app.features.vendors import service_listing as vendor_listing

Audience = Literal["clients", "vendors", "users"]

# Which account types each broadcast audience reaches.
_AUDIENCE_USER_TYPES: dict[str, tuple[str, ...]] = {
    "clients": ("client",),
    "vendors": ("vendor",),
    "users": ("client", "vendor"),
}
# The failure reported for a recipient id that names no account.
SUPPORT_START_FAILED = "Could not start support conversation."
# How many messages the staff chat viewer shows, from the start of the thread.
CHAT_VIEWER_LIMIT = 500


def _staff_item(message: StoredMessageRow) -> AdminSupportMessageRow:
    """A stored message as staff see it."""
    return AdminSupportMessageRow.model_validate(domain.raw_message_item(message))


async def _email_recipient(
    session: AsyncSession, mailer: Mailer, *, recipient_user_id: str, conversation_id: str, html: str
) -> None:
    """Email the user a copy of a support message, linking to the thread in their portal's inbox.

    Staff have no portal inbox, so they get no email. Never raises.
    """
    portal = domain.messages_portal(
        (await identity.user_types(session, [recipient_user_id])).get(recipient_user_id)
    )
    if portal is None:
        return
    email = (await identity.emails_by_id(session, [recipient_user_id])).get(recipient_user_id)
    notifications.send_support_message(
        mailer,
        email=email,
        messages_url=public_url(f"/{portal}/messages/{conversation_id}"),
        body_html=html,
        body_plain=message_plain_text(html),
    )


async def _audience_ids(session: AsyncSession, audience: Audience | None) -> list[str]:
    """Every open account in the audience (suspended ones included), in id order."""
    if audience is None:
        return []
    audience_ids: list[str] = []
    for user_type in _AUDIENCE_USER_TYPES[audience]:
        audience_ids.extend(await identity.open_user_ids_of_type(session, user_type, include_suspended=True))
    return audience_ids


async def send_to_users(
    session: AsyncSession,
    mailer: Mailer,
    staff_member: Principal,
    *,
    raw_body: str,
    recipient_user_ids: list[str] | None,
    audience: Audience | None,
) -> AdminMessageSendResponse:
    """Post one message into each recipient's support thread (started if needed) and email them.

    Recipients are the named ids plus, for super admins only, a whole audience.
    An id that names no account is reported as a failure; the rest still send.
    """
    if audience is not None and not staff_member.is_super_admin:
        raise BroadcastSuperAdminOnly()
    html = domain.staff_message_body(raw_body)
    recipients = domain.unique_recipient_ids(recipient_user_ids or [], await _audience_ids(session, audience))
    if not recipients:
        raise RecipientsRequired()
    conversation_ids: list[str] = []
    failures: list[AdminMessageSendFailure] = []
    for recipient_id in recipients:
        thread = await repository.get_or_insert_support_thread(session, recipient_id)
        if thread is None:
            failures.append(AdminMessageSendFailure(user_id=recipient_id, error=SUPPORT_START_FAILED))
            continue
        await repository.insert_message(
            session,
            conversation_id=thread.id,
            sender_user_id=staff_member.id,
            body=html,
            metadata=dict(domain.STAFF_MESSAGE_METADATA),
        )
        conversation_ids.append(thread.id)
        publish_after_commit(session, user_topic(recipient_id), domain.CHAT_UNREAD_CHANGED)
        await _email_recipient(
            session, mailer, recipient_user_id=recipient_id, conversation_id=thread.id, html=html
        )
    publish_after_commit(session, user_topic(staff_member.id), domain.CHAT_UNREAD_CHANGED)
    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action="chat.admin_send",
        entity_type="conversation",
        entity_id=None,
        details={
            "sent": len(conversation_ids),
            "audience": audience,
            "recipient_count": len(recipients),
            "conversation_ids": conversation_ids,
            "failure_count": len(failures),
        },
    )
    return AdminMessageSendResponse(
        sent=len(conversation_ids), conversation_ids=conversation_ids, failures=failures or None
    )


async def _inbox_rows(session: AsyncSession, threads: list[ThreadRow]) -> list[AdminSupportConversationRow]:
    """Support threads as staff inbox rows: the user's email as the peer, staff's unread counts."""
    user_ids = sorted({thread.support_user_id for thread in threads if thread.support_user_id})
    labels = await identity.email_labels(session, user_ids)
    unread = await repository.staff_unread_counts(session, [thread.id for thread in threads])
    return [
        AdminSupportConversationRow.model_validate(
            domain.staff_inbox_item(
                thread,
                peer_display_name=domain.staff_peer_label(labels.get(thread.support_user_id or "")),
                unread_count=unread.get(thread.id, 0),
            )
        )
        for thread in threads
    ]


async def list_support_threads(session: AsyncSession, *, limit: int) -> list[AdminSupportConversationRow]:
    """The newest support threads, for the staff inbox."""
    return await _inbox_rows(session, await repository.support_threads(session, limit=limit))


async def _support_thread(session: AsyncSession, conversation_id: str) -> ThreadRow:
    """The support thread, or "not found" (also for a DM's id)."""
    thread = await repository.get_support_thread(session, conversation_id)
    if thread is None:
        raise SupportConversationNotFound()
    return thread


async def get_support_thread(session: AsyncSession, conversation_id: str) -> AdminSupportConversationRow:
    """One support thread as an inbox row."""
    (row,) = await _inbox_rows(session, [await _support_thread(session, conversation_id)])
    return row


async def list_support_messages(
    session: AsyncSession, conversation_id: str, *, limit: int
) -> list[AdminSupportMessageRow]:
    """The newest messages of a support thread, oldest first, with real sender ids."""
    thread = await _support_thread(session, conversation_id)
    return [
        _staff_item(message) for message in await repository.latest_messages(session, thread.id, limit=limit)
    ]


async def reply(
    session: AsyncSession, mailer: Mailer, staff_member: Principal, conversation_id: str, raw_body: str
) -> AdminSupportMessageRow:
    """Post a staff reply on a support thread, then tell and email the user."""
    thread = await _support_thread(session, conversation_id)
    html = domain.staff_message_body(raw_body)
    message = await repository.insert_message(
        session,
        conversation_id=thread.id,
        sender_user_id=staff_member.id,
        body=html,
        metadata=dict(domain.STAFF_MESSAGE_METADATA),
    )
    if thread.support_user_id:
        publish_after_commit(session, user_topic(thread.support_user_id), domain.CHAT_UNREAD_CHANGED)
        await _email_recipient(
            session, mailer, recipient_user_id=thread.support_user_id, conversation_id=thread.id, html=html
        )
    publish_after_commit(session, user_topic(staff_member.id), domain.CHAT_UNREAD_CHANGED)
    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action="chat.admin_reply",
        entity_type="conversation",
        entity_id=thread.id,
        details={},
    )
    return _staff_item(message)


async def edit_message(
    session: AsyncSession, staff_member: Principal, conversation_id: str, message_id: str, raw_body: str
) -> AdminSupportMessageRow:
    """Replace the text of a message the caller sent on a support thread, stamping when it was edited."""
    thread = await _support_thread(session, conversation_id)
    html = domain.staff_message_body(raw_body)
    existing = await repository.get_message(session, conversation_id=thread.id, message_id=message_id)
    if existing is None:
        raise MessageNotFound()
    if existing.sender_user_id == thread.support_user_id:
        raise StaffMessagesOnly()
    if existing.sender_user_id != staff_member.id:
        raise EditOwnMessagesOnly()
    updated = await repository.update_message(
        session,
        message_id=existing.id,
        body=html,
        metadata=domain.edited_metadata(existing.metadata, edited_at=datetime.now(UTC).isoformat()),
    )
    if thread.support_user_id:
        publish_after_commit(session, user_topic(thread.support_user_id), domain.CHAT_UNREAD_CHANGED)
    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action="chat.admin_edit",
        entity_type="message",
        entity_id=existing.id,
        details={"conversation_id": thread.id},
    )
    return _staff_item(updated)


async def mark_read(session: AsyncSession, conversation_id: str) -> None:
    """Mark a support thread read for all staff (they share one cursor)."""
    thread = await _support_thread(session, conversation_id)
    await repository.set_read_cursor(session, thread.id, "admin_last_read_at")


async def view_any_thread(
    session: AsyncSession, staff_member: Principal, conversation_id: str
) -> AdminConversationMessagesResponse:
    """Any thread's first messages and who is on it, for staff investigating a DM. Audited first.

    An unknown id gives an empty thread rather than an error, as in the baseline.
    """
    await staff.record_admin_action(
        session,
        admin_user_id=staff_member.id,
        action="chat.view",
        entity_type="conversation",
        entity_id=conversation_id,
        details={},
    )
    thread = await repository.get_thread(session, conversation_id)
    client_user_id: str | None = None
    vendor_user_id: str | None = None
    client_email: str | None = None
    vendor_display_name: str | None = None
    # Only a DM has both sides; support threads show no participants, as in the baseline.
    if thread is not None and thread.client_user_id and thread.vendor_user_id:
        client_user_id, vendor_user_id = thread.client_user_id, thread.vendor_user_id
        client_email = (await identity.email_labels(session, [client_user_id])).get(client_user_id)
        vendor_display_name = (await vendor_listing.display_names(session, [vendor_user_id])).get(
            vendor_user_id
        )
    messages = await repository.earliest_messages(session, conversation_id, limit=CHAT_VIEWER_LIMIT)
    return AdminConversationMessagesResponse(
        conversation_id=conversation_id,
        messages=[
            AdminChatMessageItem(
                id=message.id,
                sender_user_id=message.sender_user_id,
                body=message.body,
                created_at=message.created_at,
            )
            for message in messages
        ],
        client_user_id=client_user_id,
        vendor_user_id=vendor_user_id,
        client_email=client_email,
        vendor_display_name=vendor_display_name,
    )
