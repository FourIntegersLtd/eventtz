"""Tables owned by `identity`: accounts, their one-click email tokens and sign-in sessions.

Only this slice's repositories import these classes. They mirror the schema the
baseline migrations built (Alembic 0002) plus platform sign-in (0003); `alembic
check` fails when the two drift apart. CHECK constraints live in the migrations
only: Alembic does not compare them, and the naming convention would rename them.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, Uuid, func, text
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamps, UUIDPrimaryKey

# Created by the baseline schema; the model only names it.
USER_TYPE = ENUM("client", "vendor", "admin", name="user_type", create_type=False)


class User(Base, UUIDPrimaryKey, Timestamps):
    """One account: client, vendor or staff. Closed accounts stay as tombstones (`deleted_at`)."""

    __tablename__ = "users"
    __table_args__ = (
        Index("idx_users_deleted_at", "deleted_at", postgresql_where=text("deleted_at IS NOT NULL")),
        Index("idx_users_user_type", "user_type"),
        {"comment": "One account; user_type drives client vs vendor vs admin UI."},
    )

    # Lowercase by constraint; NULL once the account is closed, which is why it can stay unique.
    email: Mapped[str | None] = mapped_column(Text, unique=True)
    # argon2, or an imported Supabase bcrypt hash until the next sign-in rehashes it.
    password_hash: Mapped[str | None] = mapped_column(Text)
    user_type: Mapped[str] = mapped_column(USER_TYPE, nullable=False, server_default=text("'client'"))
    account_suspended: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("false"),
        comment="When true, user should be blocked from app actions (enforce in API as you roll out).",
    )
    contact_phone: Mapped[str | None] = mapped_column(
        Text,
        comment="Optional phone the user may share with booking counterparties when share_phone is true.",
    )
    share_email: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        comment="When true, email is visible to the counterparty on accepted bookings.",
    )
    share_phone: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        comment="When true, contact_phone is visible to the counterparty on accepted bookings.",
    )
    share_address: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
        comment="Legacy client pref; booking venue is always visible to vendors. Not used for contact masking.",  # noqa: E501 (the column comment, verbatim)
    )
    admin_role: Mapped[str | None] = mapped_column(
        Text,
        comment="When user_type = admin: super_admin can manage the team; admin is a standard operator.",
    )
    preferred_name: Mapped[str | None] = mapped_column(
        Text,
        comment="What the client wants to be called; shown to vendors on booking requests. Never an email.",
    )
    client_onboarding_completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When the client finished (or skipped) the first-visit portal onboarding modal.",
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment=(
            "When the user confirmed their email via Eventtz verify link. "
            "NULL = must verify before sign-in (client/vendor)."
        ),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        comment="When set, the account is closed: login is gone, PII is stripped, row kept for booking FKs.",
    )
    terms_accepted_version: Mapped[str | None] = mapped_column(
        Text, comment="Version (effective date) of the Terms of Service the person last accepted."
    )
    terms_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="When they accepted terms_accepted_version."
    )
    terms_notice_sent_version: Mapped[str | None] = mapped_column(
        Text,
        comment="Terms version whose change notice was last emailed to them (one email per version).",
    )


class EmailVerificationToken(Base, UUIDPrimaryKey):
    """One verify-email link. Only the SHA-256 of the raw token is stored; single use."""

    __tablename__ = "email_verification_tokens"
    __table_args__ = (
        Index(
            "idx_email_verification_tokens_expires", "expires_at", postgresql_where=text("used_at IS NULL")
        ),
        Index("idx_email_verification_tokens_user_created", "user_id", text("created_at DESC")),
        UniqueConstraint("token_hash", name="email_verification_tokens_token_hash_unique"),
        {"comment": "One-click email verification: store SHA-256 of raw token only; 60m expiry; single use."},
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="email_verification_tokens_user_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class PasswordResetToken(Base, UUIDPrimaryKey):
    """One reset-password link. Only the SHA-256 of the raw token is stored; single use."""

    __tablename__ = "password_reset_tokens"
    __table_args__ = (
        Index("idx_password_reset_tokens_expires", "expires_at", postgresql_where=text("used_at IS NULL")),
        Index("idx_password_reset_tokens_user_created", "user_id", text("created_at DESC")),
        UniqueConstraint("token_hash", name="password_reset_tokens_token_hash_unique"),
        {"comment": "One-click password reset: store SHA-256 of raw token only; 60m expiry; single use."},
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="password_reset_tokens_user_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class RefreshChain(Base, UUIDPrimaryKey, Timestamps):
    """One sign-in, from which a series of refresh tokens is issued (OSCE's shape)."""

    __tablename__ = "refresh_chains"
    __table_args__ = (Index("ix_refresh_chains_user_id", "user_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_reason: Mapped[str | None] = mapped_column(String(32))
    user_agent: Mapped[str | None] = mapped_column(String(255))


class RefreshToken(Base, UUIDPrimaryKey, Timestamps):
    """One issued refresh token.

    Every token is kept, spent or not, because that is the only way reuse can
    be told from forgery: a replayed spent token is found and revokes its
    chain, where an overwritten one would simply not be found.
    """

    __tablename__ = "refresh_tokens"
    __table_args__ = (Index("ix_refresh_tokens_chain_id", "chain_id"),)

    chain_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("refresh_chains.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
