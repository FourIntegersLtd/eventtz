"""Shared chat API (client + vendor) under /api/v1/chat."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.auth.http.guards import require_user
from app.features.chat.http import handlers as h
from app.contracts.chat import (
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


@router.get("/unread-count", response_model=ChatUnreadCountResponse)
def get_chat_unread(request: Request, response: Response) -> ChatUnreadCountResponse:
    user = require_user(request, response)
    return h.chat_unread_count(str(user.get("id") or ""))


@router.get("/conversations", response_model=ConversationsListResponse)
def list_conversations(request: Request, response: Response) -> ConversationsListResponse:
    user = require_user(request, response)
    return h.list_conversations(user)


@router.post("/conversations", response_model=ConversationCreateResponse)
def post_conversation(
    request: Request,
    response: Response,
    body: ConversationCreateBodyShared,
) -> ConversationCreateResponse:
    user = require_user(request, response)
    try:
        return h.create_conversation(user, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    request: Request,
    response: Response,
) -> ConversationDetailResponse:
    user = require_user(request, response)
    return h.get_conversation(user, conversation_id)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessagesListResponse,
)
def get_messages(
    conversation_id: str,
    request: Request,
    response: Response,
    limit: int = Query(100, ge=1, le=200),
) -> MessagesListResponse:
    user = require_user(request, response)
    return h.get_messages(user, conversation_id, limit=limit)


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageCreateResponse,
)
def post_message(
    conversation_id: str,
    request: Request,
    response: Response,
    body: MessageCreateBody,
) -> MessageCreateResponse:
    user = require_user(request, response)
    try:
        return h.post_message(user, conversation_id, body)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post(
    "/conversations/{conversation_id}/read",
    response_model=MarkReadResponse,
)
def post_conversation_read(
    conversation_id: str,
    request: Request,
    response: Response,
) -> MarkReadResponse:
    user = require_user(request, response)
    return h.mark_read(user, conversation_id)
