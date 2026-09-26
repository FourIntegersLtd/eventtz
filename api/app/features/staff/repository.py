"""Database access for the staff slice (the `admin_audit_log` table)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.staff.models import AdminAuditLog


async def insert_audit_event(
    session: AsyncSession,
    *,
    admin_user_id: str,
    action: str,
    entity_type: str,
    entity_id: str | None,
    details: dict[str, Any],
) -> None:
    """Append one row to `admin_audit_log`; `details` is stored in the `payload` column.

    Written inside a savepoint: a failed audit insert must not poison the
    request's transaction, because the action it records has already happened.
    """
    async with session.begin_nested():
        session.add(
            AdminAuditLog(
                admin_user_id=uuid.UUID(admin_user_id),
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                payload=details,
            )
        )
