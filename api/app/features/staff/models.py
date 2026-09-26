"""Tables owned by `staff`: the audit trail of what staff did.

Only this slice's repository imports these classes. They mirror the baseline
schema (Alembic 0002); `alembic check` fails when the two drift apart.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Text, Uuid, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UUIDPrimaryKey


class AdminAuditLog(Base, UUIDPrimaryKey):
    """One staff action: who did what to which record, with its details in `payload`."""

    __tablename__ = "admin_audit_log"
    __table_args__ = (Index("idx_admin_audit_created", text("created_at DESC")),)

    admin_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", name="admin_audit_log_admin_user_id_fkey", ondelete="SET NULL")
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[str | None] = mapped_column(Text)
    payload: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
