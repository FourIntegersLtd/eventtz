"""Tables owned by `marketplace`: clients' saved vendors and the funnel event log.

Only this slice's repositories import these classes. They mirror the baseline
schema (Alembic 0002); `alembic check` fails when the two drift apart. The event
name CHECK constraint lives in the migrations only.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, Text, UniqueConstraint, Uuid, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UUIDPrimaryKey


class ClientSavedVendor(Base, UUIDPrimaryKey):
    """A vendor a client has saved to their favourites."""

    __tablename__ = "client_saved_vendors"
    __table_args__ = (
        UniqueConstraint(
            "client_user_id",
            "vendor_user_id",
            name="client_saved_vendors_client_user_id_vendor_user_id_key",
        ),
        Index("client_saved_vendors_client_idx", "client_user_id", text("created_at DESC")),
        {"comment": "Client bookmarked vendors for favorites / saved list."},
    )

    client_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="client_saved_vendors_client_user_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    vendor_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="client_saved_vendors_vendor_user_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class MarketplaceEvent(Base, UUIDPrimaryKey):
    """One step of the marketplace funnel (a profile view, an enquiry, a payment...) for analytics."""

    __tablename__ = "marketplace_events"
    __table_args__ = (
        Index(
            "idx_marketplace_events_booking",
            "booking_request_id",
            postgresql_where=text("booking_request_id IS NOT NULL"),
        ),
        Index("idx_marketplace_events_created", text("created_at DESC")),
        Index("idx_marketplace_events_name_created", "event_name", text("created_at DESC")),
        Index(
            "idx_marketplace_events_vendor_created",
            "vendor_user_id",
            text("created_at DESC"),
            postgresql_where=text("vendor_user_id IS NOT NULL"),
        ),
        {"comment": "Lightweight marketplace funnel events for analytics (not a third-party SDK)."},
    )

    event_name: Mapped[str] = mapped_column(Text, nullable=False)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", name="marketplace_events_actor_user_id_fkey", ondelete="SET NULL")
    )
    vendor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", name="marketplace_events_vendor_user_id_fkey", ondelete="SET NULL")
    )
    # The database's foreign key into `booking_requests` is declared once bookings is mapped.
    booking_request_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    category: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(Text)
    booking_value_gbp: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    payload: Mapped[Any] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
