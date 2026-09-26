"""Tables owned by `notifications`: the in-app booking notices clients and vendors see.

Only this slice's repositories import these classes. They mirror the baseline
schema (Alembic 0002); `alembic check` fails when the two drift apart. The kind
CHECK constraint lives in the migrations only (autogenerate does not compare
CHECK constraints).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Text, UniqueConstraint, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UUIDPrimaryKey


class BookingNotification(Base, UUIDPrimaryKey):
    """One in-app notice about a booking, for one person. `read_at` is null until they read it.

    There is at most one row per (booking, kind): a repeat notice replaces the
    old one rather than stacking.
    """

    __tablename__ = "booking_notifications"
    __table_args__ = (
        UniqueConstraint("booking_id", "kind", name="uq_booking_notifications_booking_kind"),
        Index("idx_booking_notifications_user_created", "user_id", text("created_at DESC")),
        {"comment": "In-app alerts for clients when a vendor accepts or completes a booking."},
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="booking_notifications_user_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    # The database's foreign key into `booking_requests` is declared once bookings is mapped.
    booking_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    body: Mapped[str | None] = mapped_column(
        Text,
        comment="Human-readable summary (e.g. updated total and vendor additions) for the client.",
    )
