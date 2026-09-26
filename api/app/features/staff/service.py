"""Staff use cases other slices call. Today: recording what a staff member did."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.features.staff import repository

log = get_logger(__name__)


async def record_admin_action(
    session: AsyncSession,
    *,
    admin_user_id: str,
    action: str,
    entity_type: str,
    entity_id: str | None,
    details: dict[str, Any] | None = None,
) -> None:
    """Write an audit event such as `blog.publish` on `blog_post` <id>.

    Never raises: the action being audited has already happened, so a failed
    audit write is logged for follow-up rather than turned into an error.
    """
    try:
        await repository.insert_audit_event(
            session,
            admin_user_id=admin_user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
        )
    except Exception:
        log.warning("audit: could not record %s on %s %s", action, entity_type, entity_id, exc_info=True)
