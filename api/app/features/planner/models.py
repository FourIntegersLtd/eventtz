"""Tables owned by `planner`. Only this slice's repositories import these classes.

They mirror the baseline schema (Alembic 0002); `alembic check` fails when the two
drift apart. The status CHECK and the `updated_at` trigger live in the migrations only.
"""

from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamps, UUIDPrimaryKey


class ClientEvent(Base, UUIDPrimaryKey, Timestamps):
    """One celebration a client plans; several bookings (one per vendor) can hang off it."""

    __tablename__ = "client_events"
    __table_args__ = (
        Index(
            "idx_client_events_client_status_date",
            "client_user_id",
            "status",
            text("event_date DESC"),
        ),
        {"comment": "Client-owned celebration/event; multiple booking_requests can link to one event."},
    )

    client_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="client_events_client_user_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    event_end_date: Mapped[date | None] = mapped_column(Date)
    event_address: Mapped[str | None] = mapped_column(Text)
    event_postcode: Mapped[str | None] = mapped_column(Text)
    # 'active' or 'archived' (CHECK in the migration).
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'active'::text"))
