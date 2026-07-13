"""Admin capability tiers: standard admin (support) vs super_admin (destructive / money)."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from app.features.auth.accounts import is_super_admin_user

SUPER_ADMIN_ONLY_DETAIL = "Only super admins can perform this action."


def assert_super_admin(user: dict[str, Any], *, detail: str | None = None) -> None:
    if not is_super_admin_user(user):
        raise HTTPException(status_code=403, detail=detail or SUPER_ADMIN_ONLY_DETAIL)


def validate_dispute_patch_permissions(
    user: dict[str, Any],
    patch_fields: dict[str, Any],
) -> None:
    """Any admin may triage disputes; financial outcomes are super_admin only."""
    if is_super_admin_user(user):
        return
    if patch_fields.get("resolution_action") is not None:
        raise HTTPException(
            status_code=403,
            detail="Only super admins can resolve disputes with a financial outcome.",
        )
    if patch_fields.get("refund_amount_gbp") is not None:
        raise HTTPException(
            status_code=403,
            detail="Only super admins can set refund amounts on disputes.",
        )
