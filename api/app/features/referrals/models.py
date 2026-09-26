"""Tables owned by `referrals`: creator partners and the vendor sign-ups they brought in.

Only this slice's repository imports these classes. They mirror the baseline
schema (Alembic 0002); `alembic check` fails when the two drift apart. CHECK
constraints (the slug format) live in the migrations only.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Text, UniqueConstraint, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamps, UUIDPrimaryKey


class ReferralPartner(Base, UUIDPrimaryKey, Timestamps):
    """A creator with a trackable vendor sign-up link (`?ref=<slug>`)."""

    __tablename__ = "referral_partners"
    __table_args__ = (
        UniqueConstraint("slug", name="referral_partners_slug_unique"),
        Index("idx_referral_partners_active_slug", "slug", postgresql_where=text("is_active = true")),
        {"comment": "Instagram creators / partners with trackable vendor signup links (?ref=slug)."},
    )

    slug: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    instagram_handle: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_by_admin_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", name="referral_partners_created_by_admin_id_fkey", ondelete="SET NULL")
    )


class ReferralAttribution(Base):
    """Which partner brought a vendor in (first touch at sign-up), and whether they were thanked."""

    __tablename__ = "referral_attributions"
    __table_args__ = (
        Index(
            "idx_referral_attributions_partner_attributed", "referral_partner_id", text("attributed_at DESC")
        ),
        {"comment": "Vendor signups attributed to a referral partner link (first-touch at registration)."},
    )

    # One attribution per vendor account, so the account is the key.
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="referral_attributions_user_id_fkey", ondelete="CASCADE"),
        primary_key=True,
    )
    referral_partner_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey(
            "referral_partners.id", name="referral_attributions_referral_partner_id_fkey", ondelete="RESTRICT"
        ),
        nullable=False,
    )
    referral_slug: Mapped[str] = mapped_column(Text, nullable=False)
    attributed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    shoutout_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    shoutout_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
