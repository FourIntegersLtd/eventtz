"""Tests for admin support message editing."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.core.errors import ForbiddenError, NotFoundError
from app.features.chat.support_admin import admin_edit_support_message


@patch("app.features.chat.support_admin.notify_user")
@patch("app.features.chat.support_admin.get_client")
@patch("app.features.chat.support_admin.get_support_conversation_for_admin")
@patch("app.features.chat.support_admin.get_settings")
def test_admin_edit_own_staff_message(mock_settings, mock_get_conv, mock_get_client, _notify):
    mock_settings.return_value.local_auth_mode = False
    conv_id = "conv-1"
    msg_id = "msg-1"
    admin_id = "admin-1"
    client_id = "client-1"
    mock_get_conv.return_value = {
        "id": conv_id,
        "support_user_id": client_id,
    }

    table = MagicMock()
    select_chain = MagicMock()
    select_chain.eq.return_value = select_chain
    select_chain.limit.return_value = select_chain
    select_chain.execute.return_value = MagicMock(
        data=[
            {
                "id": msg_id,
                "sender_user_id": admin_id,
                "body": "Old text",
                "created_at": "2026-08-10T09:00:00+00:00",
                "metadata": {"kind": "admin"},
            },
        ],
    )

    update_chain = MagicMock()
    update_chain.eq.return_value = update_chain
    update_chain.execute.return_value = MagicMock(
        data=[
            {
                "id": msg_id,
                "sender_user_id": admin_id,
                "body": "Updated text",
                "created_at": "2026-08-10T09:00:00+00:00",
                "metadata": {"kind": "admin", "edited_at": "2026-08-10T10:00:00+00:00"},
            },
        ],
    )

    def table_side(name: str):
        t = MagicMock()
        if name == "messages":
            t.select.return_value = select_chain
            t.update.return_value = update_chain
        return t

    mock_get_client.return_value = MagicMock(table=table_side)

    result = admin_edit_support_message(
        conversation_id=conv_id,
        message_id=msg_id,
        admin_user_id=admin_id,
        body="Updated text",
    )

    assert result["body"] == "Updated text"
    assert result["metadata"]["edited_at"]
    _notify.assert_called_once_with(client_id, "chat_unread_changed")


@patch("app.features.chat.support_admin.get_support_conversation_for_admin")
@patch("app.features.chat.support_admin.get_settings")
def test_admin_edit_rejects_other_admin_message(mock_settings, mock_get_conv):
    mock_settings.return_value.local_auth_mode = False
    mock_get_conv.return_value = {"id": "conv-1", "support_user_id": "client-1"}

    with patch("app.features.chat.support_admin.get_client") as mock_get_client:
        table = MagicMock()
        select_chain = MagicMock()
        select_chain.eq.return_value = select_chain
        select_chain.limit.return_value = select_chain
        select_chain.execute.return_value = MagicMock(
            data=[
                {
                    "id": "msg-1",
                    "sender_user_id": "other-admin",
                    "body": "Hello",
                    "created_at": None,
                    "metadata": {"kind": "admin"},
                },
            ],
        )
        table.select.return_value = select_chain
        mock_get_client.return_value = MagicMock(table=MagicMock(return_value=table))

        with pytest.raises(ForbiddenError, match="only edit messages you sent"):
            admin_edit_support_message(
                conversation_id="conv-1",
                message_id="msg-1",
                admin_user_id="admin-1",
                body="Nope",
            )


@patch("app.features.chat.support_admin.get_support_conversation_for_admin")
@patch("app.features.chat.support_admin.get_settings")
def test_admin_edit_rejects_end_user_message(mock_settings, mock_get_conv):
    mock_settings.return_value.local_auth_mode = False
    mock_get_conv.return_value = {"id": "conv-1", "support_user_id": "client-1"}

    with patch("app.features.chat.support_admin.get_client") as mock_get_client:
        table = MagicMock()
        select_chain = MagicMock()
        select_chain.eq.return_value = select_chain
        select_chain.limit.return_value = select_chain
        select_chain.execute.return_value = MagicMock(
            data=[
                {
                    "id": "msg-1",
                    "sender_user_id": "client-1",
                    "body": "Reply from client",
                    "created_at": None,
                    "metadata": None,
                },
            ],
        )
        table.select.return_value = select_chain
        mock_get_client.return_value = MagicMock(table=MagicMock(return_value=table))

        with pytest.raises(ForbiddenError, match="Only staff messages"):
            admin_edit_support_message(
                conversation_id="conv-1",
                message_id="msg-1",
                admin_user_id="admin-1",
                body="Nope",
            )


@patch("app.features.chat.support_admin.get_support_conversation_for_admin")
@patch("app.features.chat.support_admin.get_settings")
def test_admin_edit_missing_conversation(mock_settings, mock_get_conv):
    mock_settings.return_value.local_auth_mode = False
    mock_get_conv.return_value = None

    with pytest.raises(NotFoundError):
        admin_edit_support_message(
            conversation_id="conv-missing",
            message_id="msg-1",
            admin_user_id="admin-1",
            body="Hi",
        )
