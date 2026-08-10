"""Tests for admin unsubmit vendor profile."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.core.db import local_vendors
from app.features.vendors.moderation import unsubmit_vendor_profile

_USER = "test-vendor-unsubmit-user"


def _seed(**overrides: object) -> None:
    local_vendors[_USER] = {
        "id": "vendor-row-1",
        "user_id": _USER,
        "status": "submitted",
        "approval_status": "pending",
        "current_step": 8,
        "payload": {"businessName": "Scenery Studios"},
        **overrides,
    }


def _cleanup() -> None:
    local_vendors.pop(_USER, None)


@patch("app.features.vendors.profile.get_settings")
@patch("app.features.vendors.moderation.get_settings")
def test_unsubmit_submitted_pending_returns_draft(mock_mod_settings, mock_profile_settings):
    mock_mod_settings.return_value.local_auth_mode = True
    mock_profile_settings.return_value.local_auth_mode = True
    _seed()
    try:
        row, email_sent = unsubmit_vendor_profile(_USER, send_email=False)
        assert row is not None
        assert row["status"] == "draft"
        assert local_vendors[_USER]["status"] == "draft"
        assert local_vendors[_USER]["approval_status"] == "pending"
        assert local_vendors[_USER]["current_step"] == 8
    finally:
        _cleanup()


@patch("app.features.vendors.profile.get_settings")
@patch("app.features.vendors.moderation.get_settings")
def test_unsubmit_rejects_already_draft(mock_mod_settings, mock_profile_settings):
    mock_mod_settings.return_value.local_auth_mode = True
    mock_profile_settings.return_value.local_auth_mode = True
    _seed(status="draft")
    try:
        with pytest.raises(ValueError, match="Only submitted"):
            unsubmit_vendor_profile(_USER)
    finally:
        _cleanup()


@patch("app.features.vendors.profile.get_settings")
@patch("app.features.vendors.moderation.get_settings")
def test_unsubmit_rejects_approved(mock_mod_settings, mock_profile_settings):
    mock_mod_settings.return_value.local_auth_mode = True
    mock_profile_settings.return_value.local_auth_mode = True
    _seed(approval_status="approved")
    try:
        with pytest.raises(ValueError, match="Only pending"):
            unsubmit_vendor_profile(_USER)
    finally:
        _cleanup()


@patch("app.features.vendors.profile.get_settings")
@patch("app.features.vendors.moderation.get_settings")
def test_unsubmit_rejects_banned(mock_mod_settings, mock_profile_settings):
    mock_mod_settings.return_value.local_auth_mode = True
    mock_profile_settings.return_value.local_auth_mode = True
    _seed(approval_status="banned")
    try:
        with pytest.raises(ValueError, match="Only pending"):
            unsubmit_vendor_profile(_USER)
    finally:
        _cleanup()


@patch("app.features.vendors.profile.get_settings")
@patch("app.features.vendors.moderation.get_settings")
def test_unsubmit_missing_vendor(mock_mod_settings, mock_profile_settings):
    mock_mod_settings.return_value.local_auth_mode = True
    mock_profile_settings.return_value.local_auth_mode = True
    assert unsubmit_vendor_profile("missing-vendor-id") == (None, False)


@patch("app.features.vendors.moderation.send_vendor_returned_for_edits_email")
@patch("app.features.vendors.profile.get_settings")
@patch("app.features.vendors.moderation.get_settings")
def test_unsubmit_sends_return_email(mock_mod_settings, mock_profile_settings, mock_email):
    mock_mod_settings.return_value.local_auth_mode = True
    mock_profile_settings.return_value.local_auth_mode = True
    mock_email.return_value = True
    _seed()
    try:
        row, email_sent = unsubmit_vendor_profile(_USER, send_email=True)
        assert row is not None
        mock_email.assert_called_once()
        assert email_sent is True
    finally:
        _cleanup()
