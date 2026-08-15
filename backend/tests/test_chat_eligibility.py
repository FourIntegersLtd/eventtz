"""Tests for client chat vendor eligibility."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.chat.service import get_or_create_conversation


@patch("app.features.chat.dm._assert_vendor_exists")
@patch("app.features.vendors.moderation.vendor_is_bookable_for_explore", return_value=False)
def test_unapproved_vendor_rejected(_bookable, _exists):
    with pytest.raises(ValueError, match="not available for messages"):
        get_or_create_conversation(client_user_id="client-1", vendor_user_id="vendor-1")


@patch("app.features.chat.dm.vendor_display_names_by_id", return_value={"vendor-1": "Vendor"})
@patch("app.features.chat.dm.get_db")
@patch("app.features.chat.dm._assert_vendor_exists")
@patch("app.features.vendors.moderation.vendor_is_bookable_for_explore", return_value=False)
def test_vendor_initiated_skips_bookable_check(_bookable, _exists, mock_get_db, _names):
    client = MagicMock()
    mock_get_db.return_value = client
    client.table.return_value.select.return_value.eq.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
        data=[],
    )
    client.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{
            "id": "conv-1",
            "kind": "dm",
            "client_user_id": "client-1",
            "vendor_user_id": "vendor-1",
        }],
    )
    row = get_or_create_conversation(
        client_user_id="client-1",
        vendor_user_id="vendor-1",
        require_bookable_vendor=False,
    )
    assert row["client_user_id"] == "client-1"
