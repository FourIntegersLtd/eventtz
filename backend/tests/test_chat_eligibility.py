"""Tests for client chat vendor eligibility."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.features.chat.service import get_or_create_conversation


@patch("app.features.chat.dm._assert_vendor_exists")
@patch("app.features.vendors.moderation.vendor_is_bookable_for_explore", return_value=False)
def test_unapproved_vendor_rejected(_bookable, _exists):
    with pytest.raises(ValueError, match="not available for messages"):
        get_or_create_conversation(client_user_id="client-1", vendor_user_id="vendor-1")


@patch("app.features.chat.dm._assert_vendor_exists")
@patch("app.features.vendors.moderation.vendor_is_bookable_for_explore", return_value=False)
@patch("app.features.chat.dm.get_settings")
def test_vendor_initiated_skips_bookable_check(mock_settings, _bookable, _exists):
    mock_settings.return_value.local_auth_mode = True
    row = get_or_create_conversation(
        client_user_id="client-1",
        vendor_user_id="vendor-1",
        require_bookable_vendor=False,
    )
    assert row["client_user_id"] == "client-1"
