"""Admin support messaging: compose fan-out + support inbox."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.contracts.admin_messages import (
    AdminMessageSendBody,
    AdminMessageSendFailure,
    AdminMessageSendResponse,
    AdminSupportConversationDetailResponse,
    AdminSupportConversationRow,
    AdminSupportConversationsListResponse,
    AdminSupportMarkReadResponse,
    AdminSupportMessageCreateBody,
    AdminSupportMessageCreateResponse,
    AdminSupportMessageRow,
    AdminSupportMessagesListResponse,
)
from app.features.admin.audit import insert_admin_audit_log
from app.features.admin.client_ops import list_client_user_ids_for_broadcast
from app.features.auth.http.guards import require_admin
from app.features.chat.service import (
    admin_reply_support_message,
    admin_send_support_message,
    get_support_conversation_for_admin,
    list_messages_for_admin_support,
    list_support_conversations_for_admin,
    mark_support_conversation_read_admin,
)
from app.features.vendors.moderation import list_vendor_user_ids_for_broadcast

router = APIRouter(prefix="/admin", tags=["admin"])


def _resolve_recipient_ids(body: AdminMessageSendBody) -> list[str]:
    ids: list[str] = []
    seen: set[str] = set()

    def add_many(raw: list[str]) -> None:
        for uid in raw:
            u = (uid or "").strip()
            if u and u not in seen:
                seen.add(u)
                ids.append(u)

    if body.recipient_user_ids:
        add_many(body.recipient_user_ids)

    audience = body.audience
    if audience == "clients":
        add_many(list_client_user_ids_for_broadcast())
    elif audience == "vendors":
        add_many(list_vendor_user_ids_for_broadcast())
    elif audience == "users":
        add_many(list_client_user_ids_for_broadcast())
        add_many(list_vendor_user_ids_for_broadcast())

    if not ids:
        raise HTTPException(
            status_code=400,
            detail="Provide recipient_user_ids and/or audience (clients|vendors|users).",
        )
    return ids


def _conv_row(d: dict[str, Any]) -> AdminSupportConversationRow:
    return AdminSupportConversationRow.model_validate(d)


@router.post("/messages/send", response_model=AdminMessageSendResponse)
def admin_messages_send(
    request: Request,
    response: Response,
    body: AdminMessageSendBody,
) -> AdminMessageSendResponse:
    admin = require_admin(request, response)
    admin_id = str(admin.get("id") or "")
    recipients = _resolve_recipient_ids(body)
    try:
        result = admin_send_support_message(
            admin_user_id=admin_id,
            recipient_user_ids=recipients,
            body=body.body,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e

    failures_raw = result.get("failures") or []
    failures = [
        AdminMessageSendFailure(user_id=str(f.get("user_id", "")), error=str(f.get("error", "")))
        for f in failures_raw
        if isinstance(f, dict)
    ] or None

    insert_admin_audit_log(
        admin_user_id=admin_id,
        action="chat.admin_send",
        entity_type="conversation",
        entity_id=None,
        payload={
            "sent": result.get("sent", 0),
            "audience": body.audience,
            "recipient_count": len(recipients),
            "conversation_ids": result.get("conversation_ids") or [],
            "failure_count": len(failures or []),
        },
    )
    return AdminMessageSendResponse(
        sent=int(result.get("sent") or 0),
        conversation_ids=[str(x) for x in (result.get("conversation_ids") or [])],
        failures=failures,
    )


@router.get("/messages/conversations", response_model=AdminSupportConversationsListResponse)
def admin_messages_conversations(
    request: Request,
    response: Response,
    limit: int = Query(200, ge=1, le=500),
) -> AdminSupportConversationsListResponse:
    require_admin(request, response)
    rows = list_support_conversations_for_admin(limit=limit)
    return AdminSupportConversationsListResponse(
        conversations=[_conv_row(r) for r in rows],
    )


@router.get(
    "/messages/conversations/{conversation_id}",
    response_model=AdminSupportConversationDetailResponse,
)
def admin_messages_conversation_detail(
    conversation_id: str,
    request: Request,
    response: Response,
) -> AdminSupportConversationDetailResponse:
    require_admin(request, response)
    row = get_support_conversation_for_admin(conversation_id)
    if not row:
        raise HTTPException(status_code=404, detail="Support conversation not found.")
    return AdminSupportConversationDetailResponse(conversation=_conv_row(row))


@router.get(
    "/messages/conversations/{conversation_id}/messages",
    response_model=AdminSupportMessagesListResponse,
)
def admin_messages_list(
    conversation_id: str,
    request: Request,
    response: Response,
    limit: int = Query(200, ge=1, le=500),
) -> AdminSupportMessagesListResponse:
    require_admin(request, response)
    if not get_support_conversation_for_admin(conversation_id):
        raise HTTPException(status_code=404, detail="Support conversation not found.")
    rows = list_messages_for_admin_support(conversation_id, limit=limit)
    return AdminSupportMessagesListResponse(
        messages=[AdminSupportMessageRow.model_validate(r) for r in rows],
    )


@router.post(
    "/messages/conversations/{conversation_id}/messages",
    response_model=AdminSupportMessageCreateResponse,
)
def admin_messages_reply(
    conversation_id: str,
    request: Request,
    response: Response,
    body: AdminSupportMessageCreateBody,
) -> AdminSupportMessageCreateResponse:
    admin = require_admin(request, response)
    admin_id = str(admin.get("id") or "")
    try:
        msg = admin_reply_support_message(
            conversation_id=conversation_id,
            admin_user_id=admin_id,
            body=body.body,
        )
    except Exception as e:
        from app.core.errors import NotFoundError

        if isinstance(e, NotFoundError):
            raise HTTPException(status_code=404, detail=str(e)) from e
        if isinstance(e, ValueError):
            raise HTTPException(status_code=400, detail=str(e)) from e
        raise HTTPException(status_code=503, detail="Could not send message.") from e

    insert_admin_audit_log(
        admin_user_id=admin_id,
        action="chat.admin_reply",
        entity_type="conversation",
        entity_id=conversation_id,
        payload={},
    )
    return AdminSupportMessageCreateResponse(
        message=AdminSupportMessageRow.model_validate(msg),
    )


@router.post(
    "/messages/conversations/{conversation_id}/read",
    response_model=AdminSupportMarkReadResponse,
)
def admin_messages_mark_read(
    conversation_id: str,
    request: Request,
    response: Response,
) -> AdminSupportMarkReadResponse:
    require_admin(request, response)
    try:
        mark_support_conversation_read_admin(conversation_id)
    except Exception as e:
        from app.core.errors import NotFoundError

        if isinstance(e, NotFoundError):
            raise HTTPException(status_code=404, detail=str(e)) from e
        raise HTTPException(status_code=503, detail="Could not update read state.") from e
    return AdminSupportMarkReadResponse()
