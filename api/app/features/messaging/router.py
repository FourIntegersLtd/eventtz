"""Client and vendor chat routes: the inbox, opening a DM, messages, read state and the unread badge."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from app.core.auth import AUTH_ERRORS, CurrentUser
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.pagination import DEFAULT_LIST_LIMIT
from app.features.messaging import service_chat
from app.features.messaging.errors import (
    ChatPortalOnly,
    ClientBookingsOnly,
    ConversationNotFound,
    ConversationNotFoundOnSend,
    MessageEmpty,
    MessageTooLong,
    NotInConversation,
    NotInConversationOnRead,
    NotVendorAccount,
    SelfChat,
    VendorNotFound,
    VendorUnavailable,
)
from app.features.messaging.schemas import (
    ChatUnreadCountResponse,
    ConversationCreateBodyShared,
    ConversationCreateResponse,
    ConversationDetailResponse,
    ConversationsListResponse,
    MarkReadResponse,
    MessageCreateBody,
    MessageCreateResponse,
    MessagesListResponse,
)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/unread-count", response_model=ChatUnreadCountResponse, responses=error_responses(*AUTH_ERRORS))
async def get_chat_unread_count(session: SessionDep, principal: CurrentUser) -> ChatUnreadCountResponse:
    """Messages waiting for the caller across all their threads (the inbox badge)."""
    return ChatUnreadCountResponse(unread_count=await service_chat.unread_count(session, principal))


@router.get(
    "/conversations",
    response_model=ConversationsListResponse,
    responses=error_responses(*AUTH_ERRORS, ChatPortalOnly),
)
async def list_conversations(
    session: SessionDep,
    principal: CurrentUser,
    kind: Annotated[str | None, Query(description="all (default) | dm | support")] = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=200),
) -> ConversationsListResponse:
    """The caller's threads, newest activity first."""
    normalized_kind = (kind or "").strip().lower() or None
    if normalized_kind == "all":
        normalized_kind = None
    conversations, total = await service_chat.list_conversations_page(
        session, principal, kind=normalized_kind, offset=offset, limit=limit
    )
    return ConversationsListResponse(conversations=conversations, total=total, offset=offset, limit=limit)


@router.post(
    "/conversations",
    response_model=ConversationCreateResponse,
    responses=error_responses(
        *AUTH_ERRORS,
        ChatPortalOnly,
        ClientBookingsOnly,
        SelfChat,
        VendorNotFound,
        NotVendorAccount,
        VendorUnavailable,
    ),
)
async def post_conversation(
    session: SessionDep, principal: CurrentUser, body: ConversationCreateBodyShared
) -> ConversationCreateResponse:
    """Open (or reopen) a DM with a vendor, or with a client who has enquired."""
    return ConversationCreateResponse(
        conversation=await service_chat.open_conversation(session, principal, body.peer_user_id)
    )


@router.get(
    "/conversations/{conversation_id}",
    response_model=ConversationDetailResponse,
    responses=error_responses(*AUTH_ERRORS, ConversationNotFound),
)
async def get_conversation(
    session: SessionDep, principal: CurrentUser, conversation_id: str
) -> ConversationDetailResponse:
    """One of the caller's threads."""
    return ConversationDetailResponse(
        conversation=await service_chat.get_conversation(session, principal, conversation_id)
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessagesListResponse,
    responses=error_responses(*AUTH_ERRORS, ConversationNotFound),
)
async def get_messages(
    session: SessionDep,
    principal: CurrentUser,
    conversation_id: str,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> MessagesListResponse:
    """The newest messages of one of the caller's threads, oldest first."""
    return MessagesListResponse(
        messages=await service_chat.list_messages(session, principal, conversation_id, limit=limit)
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageCreateResponse,
    responses=error_responses(
        *AUTH_ERRORS, ConversationNotFoundOnSend, NotInConversation, MessageEmpty, MessageTooLong
    ),
)
async def post_message(
    session: SessionDep, principal: CurrentUser, conversation_id: str, body: MessageCreateBody
) -> MessageCreateResponse:
    """Send a message on one of the caller's threads."""
    return MessageCreateResponse(
        message=await service_chat.send_message(session, principal, conversation_id, body.body)
    )


@router.post(
    "/conversations/{conversation_id}/read",
    response_model=MarkReadResponse,
    responses=error_responses(*AUTH_ERRORS, ConversationNotFound, NotInConversationOnRead),
)
async def post_conversation_read(
    session: SessionDep, principal: CurrentUser, conversation_id: str
) -> MarkReadResponse:
    """Mark one of the caller's threads read up to now."""
    await service_chat.mark_read(session, principal, conversation_id)
    return MarkReadResponse()
