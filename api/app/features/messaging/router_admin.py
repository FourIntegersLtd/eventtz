"""Staff routes for Eventtz Support (sending, the inbox, replies, edits) and the any-thread chat viewer."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.pagination import PageDep
from app.core.ports import MailerDependency
from app.features.messaging import service_support
from app.features.messaging.errors import (
    BroadcastSuperAdminOnly,
    EditOwnMessagesOnly,
    MessageEmpty,
    MessageNotFound,
    MessageTooLong,
    RecipientsRequired,
    StaffMessagesOnly,
    SupportConversationNotFound,
)
from app.features.messaging.schemas import (
    AdminConversationMessagesResponse,
    AdminMessageSendBody,
    AdminMessageSendResponse,
    AdminSupportConversationDetailResponse,
    AdminSupportConversationsListResponse,
    AdminSupportMarkReadResponse,
    AdminSupportMessageCreateBody,
    AdminSupportMessageCreateResponse,
    AdminSupportMessageEditBody,
    AdminSupportMessageEditResponse,
    AdminSupportMessagesListResponse,
    ChatUnreadCountResponse,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post(
    "/messages/send",
    response_model=AdminMessageSendResponse,
    responses=error_responses(
        *ROLE_ERRORS, BroadcastSuperAdminOnly, RecipientsRequired, MessageEmpty, MessageTooLong
    ),
)
async def admin_messages_send(
    session: SessionDep, principal: CurrentStaff, body: AdminMessageSendBody, mailer: MailerDependency
) -> AdminMessageSendResponse:
    """Send a support message to named users, or (super admins) to a whole audience."""
    return await service_support.send_to_users(
        session,
        mailer,
        principal,
        raw_body=body.body,
        recipient_user_ids=body.recipient_user_ids,
        audience=body.audience,
    )


@router.get(
    "/messages/unread-count",
    response_model=ChatUnreadCountResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def admin_messages_unread_count(
    session: SessionDep, principal: CurrentStaff
) -> ChatUnreadCountResponse:
    """Unread support messages across all threads (the staff Messages badge)."""
    return ChatUnreadCountResponse(unread_count=await service_support.staff_unread_total(session))


@router.get(
    "/messages/conversations",
    response_model=AdminSupportConversationsListResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def admin_messages_conversations(
    session: SessionDep,
    principal: CurrentStaff,
    page: PageDep,
) -> AdminSupportConversationsListResponse:
    """The newest support threads."""
    conversations, total = await service_support.list_support_threads_page(
        session, offset=page.offset, limit=page.limit
    )
    return AdminSupportConversationsListResponse(
        conversations=conversations, total=total, offset=page.offset, limit=page.limit
    )


@router.get(
    "/messages/conversations/{conversation_id}",
    response_model=AdminSupportConversationDetailResponse,
    responses=error_responses(*ROLE_ERRORS, SupportConversationNotFound),
)
async def admin_messages_conversation_detail(
    session: SessionDep, principal: CurrentStaff, conversation_id: str
) -> AdminSupportConversationDetailResponse:
    """One support thread."""
    return AdminSupportConversationDetailResponse(
        conversation=await service_support.get_support_thread(session, conversation_id)
    )


@router.get(
    "/messages/conversations/{conversation_id}/messages",
    response_model=AdminSupportMessagesListResponse,
    responses=error_responses(*ROLE_ERRORS, SupportConversationNotFound),
)
async def admin_messages_list(
    session: SessionDep,
    principal: CurrentStaff,
    conversation_id: str,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
) -> AdminSupportMessagesListResponse:
    """The newest messages of a support thread, oldest first."""
    return AdminSupportMessagesListResponse(
        messages=await service_support.list_support_messages(session, conversation_id, limit=limit)
    )


@router.post(
    "/messages/conversations/{conversation_id}/messages",
    response_model=AdminSupportMessageCreateResponse,
    responses=error_responses(*ROLE_ERRORS, SupportConversationNotFound, MessageEmpty, MessageTooLong),
)
async def admin_messages_reply(
    session: SessionDep,
    principal: CurrentStaff,
    conversation_id: str,
    body: AdminSupportMessageCreateBody,
    mailer: MailerDependency,
) -> AdminSupportMessageCreateResponse:
    """Reply on a support thread (the user is emailed a copy)."""
    return AdminSupportMessageCreateResponse(
        message=await service_support.reply(session, mailer, principal, conversation_id, body.body)
    )


@router.patch(
    "/messages/conversations/{conversation_id}/messages/{message_id}",
    response_model=AdminSupportMessageEditResponse,
    responses=error_responses(
        *ROLE_ERRORS,
        SupportConversationNotFound,
        MessageNotFound,
        StaffMessagesOnly,
        EditOwnMessagesOnly,
        MessageEmpty,
        MessageTooLong,
    ),
)
async def admin_messages_edit(
    session: SessionDep,
    principal: CurrentStaff,
    conversation_id: str,
    message_id: str,
    body: AdminSupportMessageEditBody,
) -> AdminSupportMessageEditResponse:
    """Edit a message the caller sent on a support thread."""
    return AdminSupportMessageEditResponse(
        message=await service_support.edit_message(session, principal, conversation_id, message_id, body.body)
    )


@router.post(
    "/messages/conversations/{conversation_id}/read",
    response_model=AdminSupportMarkReadResponse,
    responses=error_responses(*ROLE_ERRORS, SupportConversationNotFound),
)
async def admin_messages_mark_read(
    session: SessionDep, principal: CurrentStaff, conversation_id: str
) -> AdminSupportMarkReadResponse:
    """Mark a support thread read for staff."""
    await service_support.mark_read(session, conversation_id)
    return AdminSupportMarkReadResponse()


@router.get(
    "/chat/conversations/{conversation_id}/messages",
    response_model=AdminConversationMessagesResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def admin_chat_conversation_messages(
    session: SessionDep, principal: CurrentStaff, conversation_id: str
) -> AdminConversationMessagesResponse:
    """Any thread's first messages and participants, for staff investigating a DM (audited)."""
    return await service_support.view_any_thread(session, principal, conversation_id)
