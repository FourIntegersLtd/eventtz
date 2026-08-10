"""Chat must never expose admin personal emails to clients or vendors."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.features.chat.chat_shared import ADMIN_SENDER_DISPLAY, ADMIN_SENDER_USER_ID
from app.features.chat.dm import _client_peer_labels, list_messages_for_user


@patch("app.features.chat.dm.client_display_names_by_id")
@patch("app.features.chat.dm.user_types_by_id")
def test_client_peer_labels_mask_admin(mock_types, mock_names):
    mock_types.return_value = {"admin-1": "admin", "client-1": "client"}
    mock_names.return_value = {"client-1": "Jane Doe"}

    labels = _client_peer_labels(["admin-1", "client-1"])

    assert labels["admin-1"] == ADMIN_SENDER_DISPLAY
    assert labels["client-1"] == "Jane Doe"


@patch("app.features.chat.dm._messages_table_select")
@patch("app.features.chat.dm.get_client")
@patch("app.features.chat.dm.get_settings")
def test_list_support_messages_mask_staff_sender(mock_settings, mock_get_client, mock_select):
    mock_settings.return_value.local_auth_mode = False
    conv_id = "conv-support"
    client_uid = "client-uuid"
    admin_uid = "admin-uuid"

    table = MagicMock()
    table.select.return_value = table
    table.eq.return_value = table
    table.limit.return_value = table
    table.execute.return_value = MagicMock(
        data=[
            {
                "id": conv_id,
                "kind": "support",
                "client_user_id": None,
                "vendor_user_id": None,
                "support_user_id": client_uid,
            },
        ],
    )
    mock_get_client.return_value = MagicMock(table=MagicMock(return_value=table))

    mock_select.return_value = [
        {
            "id": "m2",
            "sender_user_id": client_uid,
            "body": "Thanks, will do.",
            "created_at": "2026-08-10T10:05:00+00:00",
            "metadata": None,
        },
        {
            "id": "m1",
            "sender_user_id": admin_uid,
            "body": "Please update your profile.",
            "created_at": "2026-08-10T10:00:00+00:00",
            "metadata": {"kind": "admin"},
        },
    ]

    rows = list_messages_for_user(conv_id, client_uid)

    assert len(rows) == 2
    staff = next(r for r in rows if r["id"] == "m1")
    client_msg = next(r for r in rows if r["id"] == "m2")
    assert staff["sender_user_id"] == ADMIN_SENDER_USER_ID
    assert staff["sender_display_name"] == ADMIN_SENDER_DISPLAY
    assert admin_uid not in str(staff)
    assert client_msg["sender_user_id"] == client_uid
    assert client_msg.get("sender_display_name") is None
