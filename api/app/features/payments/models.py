"""Tables owned by `payments`: the Stripe webhook events already handled.

Only this slice's repository imports these classes. They mirror the baseline
schema (Alembic 0002, from `backend/sql/026`); `alembic check` fails when the two drift apart.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class StripeWebhookEvent(Base):
    """One Stripe event id we have handled. Stripe redelivers events; a second delivery is ignored."""

    __tablename__ = "stripe_webhook_events"
    __table_args__ = {"comment": "Processed Stripe event ids, for webhook dedupe."}

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    type: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
