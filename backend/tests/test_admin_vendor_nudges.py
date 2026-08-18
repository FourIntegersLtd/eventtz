"""Tests for admin vendor bulk email nudges."""

from __future__ import annotations

from unittest.mock import patch

from app.features.vendors.moderation import (
    nudge_draft_vendors_to_complete_profile,
    nudge_vendors_to_setup_payouts,
)


@patch("app.features.vendors.moderation.send_vendor_setup_payouts_nudge_email", return_value=True)
@patch("app.features.vendors.moderation.get_vendor_profile")
def test_nudge_setup_payouts_sends_for_approved_without_payouts(mock_profile, mock_send):
    mock_profile.return_value = {
        "status": "complete",
        "approval_status": "approved",
        "email": "vendor@example.com",
        "stripe_account_id": None,
        "stripe_charges_enabled": False,
        "stripe_payouts_enabled": False,
        "payload": {"businessName": "DJ Co"},
    }
    result = nudge_vendors_to_setup_payouts(["user-1"])
    assert result["sent"] == 1
    assert result["skipped"] == 0
    mock_send.assert_called_once()


@patch("app.features.vendors.moderation.send_vendor_setup_payouts_nudge_email")
@patch("app.features.vendors.moderation.get_vendor_profile")
def test_nudge_setup_payouts_skips_when_payouts_verified(mock_profile, mock_send):
    mock_profile.return_value = {
        "status": "complete",
        "approval_status": "approved",
        "email": "vendor@example.com",
        "stripe_account_id": "acct_123",
        "stripe_charges_enabled": True,
        "stripe_payouts_enabled": True,
        "payload": {},
    }
    result = nudge_vendors_to_setup_payouts(["user-1"])
    assert result["sent"] == 0
    assert result["skipped"] == 1
    mock_send.assert_not_called()


@patch("app.features.vendors.moderation.send_vendor_complete_profile_nudge_email", return_value=True)
@patch("app.features.vendors.moderation.get_vendor_profile")
def test_nudge_profile_skips_non_draft(mock_profile, mock_send):
    mock_profile.return_value = {
        "status": "complete",
        "approval_status": "approved",
        "email": "vendor@example.com",
        "payload": {},
    }
    result = nudge_draft_vendors_to_complete_profile(["user-1"])
    assert result["sent"] == 0
    assert result["skipped"] == 1
    mock_send.assert_not_called()
