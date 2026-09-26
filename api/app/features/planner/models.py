"""Tables owned by `planner`. Only this slice's repositories import these classes.

They mirror the baseline schema (Alembic 0002); `alembic check` fails when the two
drift apart. The status CHECK and the `updated_at` trigger live in the migrations only.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import Date, ForeignKey, Index, Integer, Numeric, Text, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
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


_CELEBRATION_PLANS_COMMENT = (
    "AI Event Planner celebration plans for clients (prompt → brief → recommendations)."
)


class CelebrationPlan(Base, UUIDPrimaryKey, Timestamps):
    """One AI-assisted plan built from a client's celebration prompt, with its own budget and status."""

    __tablename__ = "celebration_plans"
    __table_args__ = (
        Index("celebration_plans_client_updated_idx", "client_user_id", text("updated_at DESC")),
        Index(
            "idx_celebration_plans_client_event",
            "client_event_id",
            postgresql_where=text("client_event_id IS NOT NULL"),
        ),
        {"comment": _CELEBRATION_PLANS_COMMENT},
    )

    client_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="celebration_plans_client_user_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    # Nullable in the baseline schema (unlike `client_events.title`): a plan can
    # exist before its title is computed.
    title: Mapped[str | None] = mapped_column(Text)
    raw_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    brief: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    confidence_score: Mapped[int | None] = mapped_column(Integer)
    confidence_reasons: Mapped[list[Any] | None] = mapped_column(JSONB)
    summary: Mapped[str | None] = mapped_column(Text)
    budget_total_gbp: Mapped[float | None] = mapped_column(Numeric)
    budget_remaining_gbp: Mapped[float | None] = mapped_column(Numeric)
    currency: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'GBP'::text"))
    # 'active' or 'archived' (CHECK in the migration).
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'active'::text"))
    client_event_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("client_events.id", name="celebration_plans_client_event_id_fkey", ondelete="SET NULL"),
        comment="Client celebration event created when the client starts booking from this plan.",
    )


class CelebrationPlanItem(Base, UUIDPrimaryKey):
    """One recommended need (a service category) within a celebration plan.

    Unlike its sibling tables, `celebration_plan_items` has no `created_at`/
    `updated_at` columns in the baseline schema (`backend/sql/055_celebration_plans.sql`) -
    only `celebration_plans` tracks a timestamp, touched whenever an item changes.
    """

    __tablename__ = "celebration_plan_items"
    __table_args__ = (
        UniqueConstraint("plan_id", "need_id", name="celebration_plan_items_plan_need_unique"),
        Index("celebration_plan_items_plan_idx", "plan_id"),
        {"comment": "Per-need primary + alternative vendor recommendations for a celebration plan."},
    )

    plan_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("celebration_plans.id", name="celebration_plan_items_plan_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    need_id: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''::text"))
    service_key: Mapped[str] = mapped_column(Text, nullable=False)
    optional: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    primary_vendor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey(
            "users.id", name="celebration_plan_items_primary_vendor_user_id_fkey", ondelete="SET NULL"
        ),
    )
    alternative_vendor_user_ids: Mapped[list[str]] = mapped_column(
        ARRAY(Uuid), nullable=False, server_default=text("'{}'::uuid[]")
    )
    estimated_cost_gbp: Mapped[float | None] = mapped_column(Numeric)
    why_selected: Mapped[str | None] = mapped_column(Text)
    score_breakdown: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
