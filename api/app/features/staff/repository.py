"""Database access for the staff slice (the `admin_audit_log` table)."""

from __future__ import annotations

from typing import Any

from app.core import db


def insert_audit_event(
    *,
    admin_user_id: str,
    action: str,
    entity_type: str,
    entity_id: str | None,
    details: dict[str, Any],
) -> None:
    """Append one row to `admin_audit_log`; `details` is stored in the `payload` column."""
    db.service_client().table("admin_audit_log").insert(
        {
            "admin_user_id": admin_user_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "payload": details,
        }
    ).execute()
