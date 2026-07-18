"""Tests for admin support messaging."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.contracts.admin_messages import AdminMessageSendBody
from app.features.admin.http.messages import _resolve_recipient_ids
from app.features.chat.service import (
    SUPPORT_PEER_DISPLAY,
    admin_send_support_message,
    get_or_create_support_conversation,
    list_conversations_for_user,
    send_message,
)


@patch("app.features.chat.support_admin.get_settings")
def test_get_or_create_support_conversation_local(mock_settings):
    mock_settings.return_value.local_auth_mode = True
    row = get_or_create_support_conversation("user-abc")
    assert row["kind"] == "support"
    assert row["support_user_id"] == "user-abc"
    assert row["peer_display_name"] == SUPPORT_PEER_DISPLAY


@patch("app.features.chat.support_admin.notify_user")
@patch("app.features.chat.support_admin.insert_message")
@patch("app.features.chat.support_admin.get_or_create_support_conversation")
@patch("app.features.chat.support_admin.get_settings")
def test_admin_send_fan_out(mock_settings, mock_get_conv, mock_insert, _notify):
    mock_settings.return_value.local_auth_mode = False
    mock_get_conv.side_effect = lambda uid: {"id": f"conv-{uid}", "support_user_id": uid}
    mock_insert.return_value = {"id": "m1", "sender_user_id": "admin-1", "body": "Hello", "created_at": None}

    result = admin_send_support_message(
        admin_user_id="admin-1",
        recipient_user_ids=["u1", "u2", "u1"],
        body="Hello",
    )
    assert result["sent"] == 2
    assert result["conversation_ids"] == ["conv-u1", "conv-u2"]
    assert mock_insert.call_count == 2
    assert mock_insert.call_args.kwargs["metadata"] == {"kind": "admin"}


@patch("app.features.chat.dm.get_settings")
def test_send_message_rejects_non_participant_support(mock_settings):
    mock_settings.return_value.local_auth_mode = True
    with pytest.raises(ValueError, match="Conversation not found"):
        send_message(
            conversation_id="not-local",
            sender_user_id="user-1",
            body="hi",
        )


@patch("app.features.admin.http.messages.list_vendor_user_ids_for_broadcast")
@patch("app.features.admin.http.messages.list_client_user_ids_for_broadcast")
def test_resolve_audience_clients(mock_clients, mock_vendors):
    mock_clients.return_value = ["c1", "c2"]
    mock_vendors.return_value = ["v1"]
    ids = _resolve_recipient_ids(AdminMessageSendBody(body="x", audience="clients"))
    assert ids == ["c1", "c2"]


@patch("app.features.admin.http.messages.list_vendor_user_ids_for_broadcast")
@patch("app.features.admin.http.messages.list_client_user_ids_for_broadcast")
def test_resolve_audience_users_merges(mock_clients, mock_vendors):
    mock_clients.return_value = ["c1"]
    mock_vendors.return_value = ["v1", "c1"]
    ids = _resolve_recipient_ids(AdminMessageSendBody(body="x", audience="users"))
    assert ids == ["c1", "v1"]


def test_resolve_requires_recipients():
    with pytest.raises(HTTPException) as exc:
        _resolve_recipient_ids(AdminMessageSendBody(body="hello"))
    assert exc.value.status_code == 400


@patch("app.features.admin.http.messages.require_admin", side_effect=HTTPException(status_code=403, detail="forbidden"))
def test_admin_send_requires_admin(mock_require):
    from fastapi import Response
    from starlette.requests import Request

    from app.features.admin.http.messages import admin_messages_send

    scope = {"type": "http", "method": "POST", "path": "/", "headers": []}
    request = Request(scope)
    with pytest.raises(HTTPException) as exc:
        admin_messages_send(
            request,
            Response(),
            AdminMessageSendBody(body="hi", recipient_user_ids=["u1"]),
        )
    assert exc.value.status_code == 403
    mock_require.assert_called_once()


@patch("app.features.chat.dm.get_settings")
def test_list_conversations_local_empty(mock_settings):
    mock_settings.return_value.local_auth_mode = True
    assert list_conversations_for_user("u1", role="client") == []
