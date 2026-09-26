"""Staff use cases other slices call, plus the audit-log screens' own use cases."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.features.staff import repository
from app.features.staff.errors import AuditEntryNotFound
from app.features.staff.rows import AdminAuditLogRow
from app.features.staff.schemas import AdminAuditLogDetailResponse, AdminAuditLogItem, AdminAuditLogResponse

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


def _audit_item(row: AdminAuditLogRow) -> AdminAuditLogItem:
    """A repository row, as the audit-log screens answer it.

    BASELINE QUIRK: the baseline joins each entry to the acting admin's current
    email (`admin_email`); this rebuild does not perform that join yet (no
    route or test reads it), so it is always `None` here.
    """
    return AdminAuditLogItem(
        id=row.id,
        admin_user_id=row.admin_user_id,
        admin_email=None,
        action=row.action,
        entity_type=row.entity_type,
        entity_id=row.entity_id,
        audit_event_details=row.audit_event_details,
        created_at=row.created_at,
    )


async def list_audit_log(
    session: AsyncSession, *, offset: int, limit: int, category: str
) -> AdminAuditLogResponse:
    """A page of the audit trail, most recent first, optionally narrowed to one category."""
    rows, total = await repository.list_audit_log(session, offset=offset, limit=limit, category=category)
    return AdminAuditLogResponse(entries=[_audit_item(row) for row in rows], total=total)


async def get_audit_log_entry(session: AsyncSession, entry_id: str) -> AdminAuditLogDetailResponse:
    """One audit entry by id, or `AuditEntryNotFound`."""
    row = await repository.get_audit_log_entry(session, entry_id)
    if row is None:
        raise AuditEntryNotFound()
    return AdminAuditLogDetailResponse(entry=_audit_item(row))
