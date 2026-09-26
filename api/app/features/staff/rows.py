"""Typed rows `staff/repository*.py` returns. Only repositories build them; schemas never import them."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class AdminTeamMemberRow(BaseModel):
    """One admin account's `users` columns, as read via the table handle in `repository.py`."""

    id: str
    email: str | None = None
    admin_role: str | None = None
    created_at: str | None = None
    account_suspended: bool = False


class AdminClientRow(BaseModel):
    """One client account plus its booking count, for the client directory."""

    user_id: str
    email: str | None = None
    created_at: str | None = None
    account_suspended: bool = False
    booking_count: int = 0


class AdminAuditLogRow(BaseModel):
    """One `admin_audit_log` entry."""

    id: str
    admin_user_id: str | None = None
    action: str
    entity_type: str
    entity_id: str | None = None
    audit_event_details: dict[str, Any] = {}
    created_at: str | None = None
