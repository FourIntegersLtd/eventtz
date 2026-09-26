"""Tables owned by `disputes`: `dispute_cases`.

Only this slice's repository imports this class. It mirrors the baseline schema
(Alembic 0002, columns added by later baseline migrations 018/021/022/026/031/050);
`alembic check` fails when the two drift apart. The `updated_at` trigger lives in
the migrations only; the one-active-dispute-per-booking partial unique index is
declared here too, so autogenerate sees it as already present.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UUIDPrimaryKey


class DisputeCase(Base, UUIDPrimaryKey):
    """One dispute raised by a client or vendor on a booking, triaged and resolved by staff."""

    __tablename__ = "dispute_cases"
    __table_args__ = (
        Index("idx_dispute_cases_booking", "booking_request_id"),
        Index("idx_dispute_cases_status", "status"),
        Index("idx_dispute_cases_assigned_admin", "assigned_admin_id"),
        Index(
            "idx_dispute_cases_conversation",
            "conversation_id",
            postgresql_where=text("conversation_id IS NOT NULL"),
        ),
        # At most one open/under_review dispute per booking (concurrency-safe).
        Index(
            "idx_dispute_cases_one_active_per_booking",
            "booking_request_id",
            unique=True,
            postgresql_where=text("status IN ('open', 'under_review')"),
        ),
        {"comment": "Admin-managed disputes linked to a booking request."},
    )

    booking_request_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("booking_requests.id", name="dispute_cases_booking_request_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    opened_by_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="dispute_cases_opened_by_user_id_fkey", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'open'"))
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    internal_notes: Mapped[str | None] = mapped_column(Text)
    resolution_note: Mapped[str | None] = mapped_column(
        Text,
        comment=(
            "Legacy shared note; prefer client_resolution_note / vendor_resolution_note. "
            "Still used as fallback when party-specific notes are empty."
        ),
    )
    client_resolution_note: Mapped[str | None] = mapped_column(
        Text, comment="Admin message shown only to the client on this dispute."
    )
    vendor_resolution_note: Mapped[str | None] = mapped_column(
        Text, comment="Admin message shown only to the vendor on this dispute."
    )
    assigned_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", name="dispute_cases_assigned_admin_id_fkey", ondelete="SET NULL")
    )
    conversation_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("conversations.id", name="dispute_cases_conversation_id_fkey", ondelete="SET NULL"),
        comment=(
            "In-app chat between the same client and vendor, stored when the dispute is opened "
            "for investigation."
        ),
    )
    resolution_action: Mapped[str | None] = mapped_column(
        Text, comment="Money decision recorded when an admin resolves the dispute."
    )
    refund_amount_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), comment="Set when resolution_action = partial_refund."
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Kept current by the `trg_dispute_cases_updated_at` trigger.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
