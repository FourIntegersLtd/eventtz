"""Admin directory pagination tests."""

from unittest.mock import MagicMock, patch

from app.features.admin.client_ops import list_clients_for_admin
from app.features.vendors.moderation import list_vendors_for_admin


@patch("app.features.admin.client_ops.apply_recent_first_order", side_effect=lambda q, **_: q)
@patch("app.features.admin.client_ops.get_settings")
@patch("app.features.admin.client_ops.get_client")
def test_list_clients_for_admin_paginated(mock_get_client, mock_settings, _order):
    mock_settings.return_value.local_auth_mode = False
    client = MagicMock()
    mock_get_client.return_value = client
    chain = client.table.return_value.select.return_value.eq.return_value
    chain.ilike.return_value = chain
    chain.range.return_value.execute.return_value = MagicMock(
        data=[{"id": "c1", "email": "a@example.com", "created_at": "2026-01-01", "account_suspended": False}],
        count=1,
    )
    client.table.return_value.select.return_value.in_.return_value.execute.return_value = MagicMock(data=[])

    rows, total = list_clients_for_admin(offset=0, limit=50, q="example")
    assert total == 1
    assert len(rows) == 1
    assert rows[0]["user_id"] == "c1"


@patch("app.features.vendors.moderation.apply_recent_first_order", side_effect=lambda q, **_: q)
@patch("app.features.vendors.moderation.get_settings")
@patch("app.features.vendors.moderation.get_client")
def test_list_vendors_for_admin_paginated(mock_get_client, mock_settings, _order):
    mock_settings.return_value.local_auth_mode = False
    client = MagicMock()
    mock_get_client.return_value = client
    chain = client.table.return_value.select.return_value.eq.return_value
    chain.in_.return_value = chain
    chain.gte.return_value = chain
    chain.lte.return_value = chain
    chain.overlaps.return_value = chain
    chain.ilike.return_value = chain
    chain.range.return_value.execute.return_value = MagicMock(
        data=[
            {
                "user_id": "v1",
                "status": "complete",
                "approval_status": "approved",
                "payload": {},
                "updated_at": "2026-01-01",
            }
        ],
        count=1,
    )
    client.table.return_value.select.return_value.in_.return_value.execute.return_value = MagicMock(
        data=[{"id": "v1", "email": "v@example.com"}],
    )

    rows, total = list_vendors_for_admin(offset=0, limit=50, approval_status="approved")
    assert total == 1
    assert rows[0]["user_id"] == "v1"
