"""Listing override must not touch Stripe Connect columns."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.features.vendors.moderation import set_vendor_listing_override


@patch("app.features.vendors.moderation.get_vendor_profile")
@patch("app.features.vendors.moderation.get_settings")
@patch("app.features.vendors.moderation.get_client")
def test_listing_override_hidden_update_excludes_stripe(
    mock_client: MagicMock,
    mock_settings: MagicMock,
    mock_profile: MagicMock,
) -> None:
    mock_settings.return_value.local_auth_mode = False
    mock_table = MagicMock()
    mock_client.return_value.table.return_value = mock_table
    mock_table.update.return_value = mock_table
    mock_table.eq.return_value = mock_table
    mock_table.execute.return_value = MagicMock(data=[])

    mock_profile.return_value = {
        "user_id": "vendor-1",
        "listing_override": "hidden",
        "listing_visible": False,
    }

    set_vendor_listing_override(
        "vendor-1",
        "hidden",
        reason="test hide",
        admin_user_id="admin-1",
    )

    update_payload = mock_table.update.call_args[0][0]
    assert set(update_payload.keys()) == {
        "listing_override",
        "listing_override_reason",
        "listing_override_by",
        "listing_override_at",
    }
    assert "stripe_account_id" not in update_payload
