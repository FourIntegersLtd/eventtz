"""Tests for admin role permissions."""

import pytest
from fastapi import HTTPException

from app.features.admin.permissions import validate_dispute_patch_permissions


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
