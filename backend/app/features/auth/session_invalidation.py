"""Revoke Supabase sessions after password change (best-effort)."""

from __future__ import annotations

from app.core.logging import get_logger

logger = get_logger(__name__)


def invalidate_all_sessions(user_id: str) -> None:
    """
    Best-effort session cleanup.

    Supabase Python ``auth.admin.sign_out`` requires the user's JWT, not their UUID.
    Password updates via the admin API revoke refresh tokens; hard deletes remove the
    auth user entirely - so we only log here.
    """
    logger.debug(
        "invalidate_all_sessions skipped for user_id=%s (Supabase requires user JWT for global sign-out)",
        user_id,
    )
