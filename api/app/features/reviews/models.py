"""Tables owned by `reviews`: one row per booking review.

Only this slice's repository imports this class. It mirrors the baseline
schema (`backend/sql/017_booking_reviews.sql`, `018_admin_console.sql` and
`059_booking_review_images.sql`, folded into Alembic `0002`); `alembic check`
fails when the two drift apart. Bookings, marketplace and explore still read
this table through their own `sqlalchemy.table()` handles (they own no
`models.py` entry for it) until the integration workstream points them at this
slice's service instead.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint, Uuid, func, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UUIDPrimaryKey


class BookingReview(Base, UUIDPrimaryKey):
    """A client's rating and comment on one completed booking. One per booking (`UNIQUE`)."""

    __tablename__ = "booking_reviews"
    __table_args__ = (
        Index("idx_booking_reviews_vendor", "vendor_user_id"),
        Index("idx_booking_reviews_client", "client_user_id"),
        # Postgres named this constraint itself (inline `UNIQUE`, migration 017); named
        # explicitly here so it matches the naming convention's guess byte for byte.
        UniqueConstraint("booking_request_id", name="booking_reviews_booking_request_id_key"),
        {
            "comment": (
                "Client review after a completed booking; UNIQUE(booking_request_id) enforces "
                "one review per booking."
            )
        },
    )

    booking_request_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("booking_requests.id", name="booking_reviews_booking_request_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    vendor_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="booking_reviews_vendor_user_id_fkey", ondelete="RESTRICT"),
        nullable=False,
    )
    client_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="booking_reviews_client_user_id_fkey", ondelete="RESTRICT"),
        nullable=False,
    )
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Kept current by the `trg_booking_reviews_updated_at` trigger.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    hidden_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When set, review is excluded from public lists (admin moderation).",
    )
    image_urls: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        server_default=text("'{}'::text[]"),
        comment="Public image URLs uploaded by the client with the review (max enforced in app).",
    )
