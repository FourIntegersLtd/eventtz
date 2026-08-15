"""Tests for admin unsubmit vendor profile."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.features.vendors.moderation import unsubmit_vendor_profile

_USER = "test-vendor-unsubmit-user"

_BASE_ROW = {
    "id": "vendor-row-1",
    "user_id": _USER,
    "status": "submitted",
    "approval_status": "pending",
    "current_step": 8,
    "payload": {"businessName": "Scenery Studios"},
}


@patch("app.features.vendors.moderation.get_db")
@patch("app.features.vendors.moderation.get_vendor_profile")
def test_unsubmit_submitted_pending_returns_draft(mock_get_profile, mock_get_db):
    draft_row = {**_BASE_ROW, "status": "draft", "current_step": 8}
    mock_get_profile.side_effect = [_BASE_ROW, draft_row]
    row, email_sent = unsubmit_vendor_profile(_USER, send_email=False)
    assert row is not None
    assert row["status"] == "draft"
    assert row["approval_status"] == "pending"
    assert row["current_step"] == 8
    assert email_sent is False
    update_call = mock_get_db.return_value.table.return_value.update
    update_call.assert_called_once()
    update_args = update_call.call_args[0][0]
    assert update_args["status"] == "draft"
    assert update_args["current_step"] == 8
    assert isinstance(update_args.get("payload"), dict)
    assert update_args["payload"].get("returnedForEditsAt")


@patch("app.features.vendors.moderation.get_vendor_profile")
def test_unsubmit_rejects_already_draft(mock_get_profile):
    mock_get_profile.return_value = {**_BASE_ROW, "status": "draft"}
    with pytest.raises(ValueError, match="Only submitted"):
        unsubmit_vendor_profile(_USER)


@patch("app.features.vendors.moderation.get_vendor_profile")
def test_unsubmit_rejects_approved(mock_get_profile):
    mock_get_profile.return_value = {**_BASE_ROW, "approval_status": "approved"}
    with pytest.raises(ValueError, match="Only pending"):
        unsubmit_vendor_profile(_USER)


@patch("app.features.vendors.moderation.get_vendor_profile")
def test_unsubmit_rejects_banned(mock_get_profile):
    mock_get_profile.return_value = {**_BASE_ROW, "approval_status": "banned"}
    with pytest.raises(ValueError, match="Only pending"):
        unsubmit_vendor_profile(_USER)


@patch("app.features.vendors.moderation.get_vendor_profile")
def test_unsubmit_missing_vendor(mock_get_profile):
    mock_get_profile.return_value = None
    assert unsubmit_vendor_profile("missing-vendor-id") == (None, False)


@patch("app.features.vendors.moderation.send_vendor_returned_for_edits_email")
@patch("app.features.vendors.moderation.get_db")
@patch("app.features.vendors.moderation.get_vendor_profile")
def test_unsubmit_sends_return_email(mock_get_profile, mock_get_db, mock_email):
    draft_row = {**_BASE_ROW, "status": "draft"}
    mock_get_profile.side_effect = [_BASE_ROW, draft_row]
    mock_email.return_value = True
    row, email_sent = unsubmit_vendor_profile(_USER, send_email=True)
    assert row is not None
    mock_email.assert_called_once()
    assert email_sent is True


@patch("app.features.vendors.moderation.send_vendor_returned_for_edits_email")
@patch("app.features.vendors.moderation.get_db")
@patch("app.features.vendors.moderation.get_vendor_profile")
def test_unsubmit_passes_admin_message_to_email(mock_get_profile, mock_get_db, mock_email):
    draft_row = {**_BASE_ROW, "status": "draft"}
    mock_get_profile.side_effect = [_BASE_ROW, draft_row]
    mock_email.return_value = True
    message = "Please add a profile photo and complete your packages."
    unsubmit_vendor_profile(_USER, send_email=True, admin_message=message)
    mock_email.assert_called_once_with(
        vendor_user_id=_USER,
        vendor_email=None,
        business_name="Scenery Studios",
        admin_message=message,
    )
