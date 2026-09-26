"""Tables owned by `notifications`: in-app booking notices, and the log that dedupes booking emails.

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
    booking_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("booking_requests.id", name="booking_notifications_booking_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    body: Mapped[str | None] = mapped_column(
        Text,
        comment="Human-readable summary (e.g. updated total and vendor additions) for the client.",
    )


class EmailDeliveryLog(Base, UUIDPrimaryKey):
    """One booking lifecycle email that was sent, so a retried request never sends it twice.

    The partial unique index makes (template, booking, recipient) one row: a second
    insert for the same send fails, and the sender skips the email.
    """

    __tablename__ = "email_delivery_log"
    __table_args__ = (
        Index("email_delivery_log_created_at_idx", text("created_at DESC")),
        Index(
            "email_delivery_log_dedupe_idx",
            "template_id",
            "booking_id",
            "recipient_user_id",
            unique=True,
            postgresql_where=text("(booking_id IS NOT NULL) AND (recipient_user_id IS NOT NULL)"),
        ),
        {
            "comment": (
                "Records sent transactional emails; unique index prevents duplicate booking lifecycle sends."
            )
        },
    )

    template_id: Mapped[str] = mapped_column(Text, nullable=False)
    recipient_email: Mapped[str] = mapped_column(Text, nullable=False)
    recipient_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", name="email_delivery_log_recipient_user_id_fkey", ondelete="SET NULL")
    )
    booking_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("booking_requests.id", name="email_delivery_log_booking_id_fkey", ondelete="SET NULL"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
