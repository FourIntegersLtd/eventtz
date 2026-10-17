"""Tables owned by `vendors`: one profile row per vendor account.

Only this slice's repository imports these classes. They mirror the baseline
schema (Alembic 0002); `alembic check` fails when the two drift apart. CHECK
constraints (status, approval and override values) live in the migrations only.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    CHAR,
    Boolean,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamps, UUIDPrimaryKey

# Who may appear in public search (docs/domain-rules.md). The partial indexes repeat it.
_APPROVED = "approval_status = 'approved'::text"


class Vendor(Base, UUIDPrimaryKey, Timestamps):
    """A vendor's profile: the onboarding form in `payload`, approval, Stripe and listing state.

    Several columns are copies of `payload` fields kept for SQL filters on
    explore search; the application writes them alongside the payload.
    """

    __tablename__ = "vendors"
    __table_args__ = (
        UniqueConstraint("user_id", name="vendors_user_id_key"),
        Index(
            "idx_vendors_business_name_normalized_unique",
            "business_name_normalized",
            unique=True,
            postgresql_where=text("business_name_normalized IS NOT NULL"),
        ),
        Index(
            "idx_vendors_client_referral_code_unique",
            "client_referral_code",
            unique=True,
            postgresql_where=text("client_referral_code IS NOT NULL"),
        ),
        Index(
            "idx_vendors_stripe_account_id",
            "stripe_account_id",
            postgresql_where=text("stripe_account_id IS NOT NULL"),
        ),
        Index("idx_vendors_user_id", "user_id"),
        Index(
            "vendors_approval_status_approved_idx", text("updated_at DESC"), postgresql_where=text(_APPROVED)
        ),
        Index(
            "vendors_base_city_normalized_idx",
            "base_city_normalized",
            postgresql_where=text(f"({_APPROVED}) AND (base_city_normalized IS NOT NULL)"),
        ),
        Index(
            "vendors_country_code_approved_idx",
            "country_code",
            text("updated_at DESC"),
            postgresql_where=text(_APPROVED),
        ),
        Index(
            "vendors_country_code_base_city_idx",
            "country_code",
            "base_city_normalized",
            postgresql_where=text(f"({_APPROVED}) AND (base_city_normalized IS NOT NULL)"),
        ),
        Index(
            "vendors_min_list_price_gbp_idx",
            "min_list_price_gbp",
            postgresql_where=text(f"({_APPROVED}) AND (min_list_price_gbp IS NOT NULL)"),
        ),
        Index(
            "vendors_public_listing_idx",
            "country_code",
            text("updated_at DESC"),
            postgresql_where=text(
                f"({_APPROVED}) AND (listing_override <> 'hidden'::text) "
                "AND ((listing_override = 'visible'::text) OR ((stripe_account_id IS NOT NULL) "
                "AND stripe_charges_enabled AND stripe_payouts_enabled))"
            ),
        ),
        Index(
            "vendors_services_offered_gin_idx",
            "services_offered",
            postgresql_using="gin",
            postgresql_where=text(f"({_APPROVED}) AND (services_offered IS NOT NULL)"),
        ),
        {"comment": "Vendor profile row per vendor user; payload JSONB (draft/submitted)."},
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", name="vendors_user_id_fkey", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'draft'"))
    current_step: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("1"))
    payload: Mapped[dict[str, Any]] = mapped_column(
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
        comment=(
            "JSON snapshot of vendor profile (strings, numbers, booleans, string arrays). "
            "File blobs: Storage later."
        ),
    )
    approval_status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'pending'"),
        comment="pending = awaiting admin; approved = visible in client explore; banned = hidden.",
    )
    stripe_account_id: Mapped[str | None] = mapped_column(
        Text, comment="Stripe Connect Express account id (acct_...)."
    )
    stripe_charges_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Mirrors Stripe Account.charges_enabled.",
    )
    stripe_payouts_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="Mirrors Stripe Account.payouts_enabled.",
    )
    # Written by Postgres from the payload; unique, so two vendors cannot share a business name.
    business_name_normalized: Mapped[str | None] = mapped_column(
        Text,
        Computed(
            "NULLIF(lower(regexp_replace("
            "TRIM(BOTH FROM COALESCE((payload ->> 'businessName'::text), ''::text)), "
            "'\\s+'::text, ' '::text, 'g'::text)), ''::text)",
            persisted=True,
        ),
        comment=(
            "Generated from payload.businessName for uniqueness checks "
            "(lowercase, trimmed, collapsed spaces)."
        ),
    )
    min_list_price_gbp: Mapped[Decimal | None] = mapped_column(
        Numeric, comment="Denormalized from payload for SQL budget filters on explore search."
    )
    base_city_normalized: Mapped[str | None] = mapped_column(
        Text, comment="Lowercase trimmed baseCity from vendor payload."
    )
    services_offered: Mapped[list[str] | None] = mapped_column(
        ARRAY(Text), comment="Denormalized servicesOffered keys from vendor payload."
    )
    country_code: Mapped[str] = mapped_column(
        CHAR(2),
        nullable=False,
        server_default=text("'GB'"),
        comment="ISO 3166-1 alpha-2 operating country (denormalized from payload.countryCode).",
    )
    currency: Mapped[str] = mapped_column(
        CHAR(3),
        nullable=False,
        server_default=text("'GBP'"),
        comment="ISO 4217 listing currency for explore budget filters (denormalized from market).",
    )
    listing_override: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'auto'"),
        comment=(
            "auto = approval + Stripe decide visibility; visible = admin waives the Stripe gate; "
            "hidden = admin takes the listing down without banning."
        ),
    )
    listing_override_reason: Mapped[str | None] = mapped_column(Text)
    listing_override_by: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    listing_override_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    listing_paused_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="Staff paused the listing until this time (repeated cancellations); it returns on its own.",
    )
    listing_pause_reason: Mapped[str | None] = mapped_column(
        Text, comment="The reason sent to the vendor when the listing was paused."
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When approval_status last became approved (for the 24h payouts-setup nudge).",
    )
    payouts_setup_nudge_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When the automatic payouts-setup email was sent."
    )
    cancellation_policy_nudge_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When the one choose-your-cancellation-policy email was sent."
    )
    cancellation_policy_reminder_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When the one follow-up was sent, 14 days after the first email, if still no preset.",
    )
    insurance_certificate_url: Mapped[str | None] = mapped_column(
        Text, comment="The public liability certificate staff checked (the payload upload at the time)."
    )
    insurance_expires_on: Mapped[date | None] = mapped_column(
        Date, comment="When the checked public liability cover ends, as staff read it off the certificate."
    )
    insurance_cover_gbp: Mapped[int | None] = mapped_column(
        Integer, comment="The checked public liability cover, in whole pounds."
    )
    insurance_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When staff checked the certificate."
    )
    insurance_verified_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, comment="The staff member who checked the certificate."
    )
    insurance_reminder_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When the renew-or-upload insurance email was sent; cleared when a certificate is checked.",
    )
    client_referral_code: Mapped[str | None] = mapped_column(
        Text, comment="Shareable numeric code for clients (?vref= on browse, or booking form). 1–6 digits."
    )
    client_referral_enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        comment="When false, client_referral_code is ignored for new bookings.",
    )
