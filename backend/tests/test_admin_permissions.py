"""Tests for admin role permissions."""

import pytest
from fastapi import HTTPException

from app.features.admin.permissions import (
    validate_admin_message_send_permissions,
    validate_dispute_patch_permissions,
    validate_listing_override_permissions,
)


def test_regular_admin_can_triage_dispute():
    user = {"user_type": "admin", "admin_role": "admin", "email": "support@example.com"}
    validate_dispute_patch_permissions(user, {"internal_notes": "Looking into it"})


def test_regular_admin_cannot_resolve_dispute_with_money():
    user = {"user_type": "admin", "admin_role": "admin", "email": "support@example.com"}
    with pytest.raises(HTTPException) as exc:
        validate_dispute_patch_permissions(
            user,
            {"status": "resolved", "resolution_action": "refund_client"},
        )
    assert exc.value.status_code == 403


def test_regular_admin_can_update_dispute_status_without_money():
    user = {"user_type": "admin", "admin_role": "admin", "email": "support@example.com"}
    validate_dispute_patch_permissions(user, {"status": "closed"})


def test_super_admin_can_resolve_dispute():
    user = {"user_type": "admin", "admin_role": "super_admin", "email": "boss@example.com"}
    validate_dispute_patch_permissions(
        user,
        {"status": "resolved", "resolution_action": "refund_client"},
    )


def test_regular_admin_can_reset_listing_override_to_auto():
    user = {"user_type": "admin", "admin_role": "admin", "email": "support@example.com"}
    validate_listing_override_permissions(user, "auto")


def test_regular_admin_cannot_force_listing_visible_or_hidden():
    user = {"user_type": "admin", "admin_role": "admin", "email": "support@example.com"}
    for override in ("visible", "hidden"):
        with pytest.raises(HTTPException) as exc:
            validate_listing_override_permissions(user, override)
        assert exc.value.status_code == 403


def test_super_admin_can_force_listing_override():
    user = {"user_type": "admin", "admin_role": "super_admin", "email": "boss@example.com"}
    validate_listing_override_permissions(user, "visible")
    validate_listing_override_permissions(user, "hidden")


def test_regular_admin_can_send_targeted_support_messages():
    user = {"user_type": "admin", "admin_role": "admin", "email": "support@example.com"}
    validate_admin_message_send_permissions(user, None)


def test_regular_admin_cannot_broadcast_support_messages():
    user = {"user_type": "admin", "admin_role": "admin", "email": "support@example.com"}
    for audience in ("clients", "vendors", "users"):
        with pytest.raises(HTTPException) as exc:
            validate_admin_message_send_permissions(user, audience)
        assert exc.value.status_code == 403


def test_super_admin_can_broadcast_support_messages():
    user = {"user_type": "admin", "admin_role": "super_admin", "email": "boss@example.com"}
    validate_admin_message_send_permissions(user, "clients")
    validate_admin_message_send_permissions(user, "vendors")
    validate_admin_message_send_permissions(user, "users")
