"""Tables owned by `messaging`: conversations and their messages.

Only this slice's repositories import these classes. They mirror the baseline
schema (Alembic 0002); `alembic check` fails when the two drift apart. The kind,
shape and body-length CHECK constraints live in the migrations only (autogenerate
does not compare CHECK constraints).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Index, Text, Uuid, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, UUIDPrimaryKey


class Conversation(Base, UUIDPrimaryKey):
    """A thread: a client-vendor DM (`kind='dm'`) or one user's Eventtz Support thread (`kind='support'`).

    Each side's `*_last_read_at` is its read cursor; messages after it are unread.
    On a support thread the end user's cursor is `client_last_read_at`, whether
    they are a client or a vendor, and staff share `admin_last_read_at`.
    """

    __tablename__ = "conversations"
    __table_args__ = (
        Index(
            "conversations_unique_dm_pair",
            "client_user_id",
            "vendor_user_id",
            unique=True,
            postgresql_where=text("kind = 'dm'::text"),
        ),
        Index(
            "conversations_unique_support_user",
            "support_user_id",
            unique=True,
            postgresql_where=text("kind = 'support'::text"),
        ),
        Index("idx_conversations_client", "client_user_id"),
        Index("idx_conversations_kind", "kind"),
        Index("idx_conversations_last_message", text("last_message_at DESC NULLS LAST")),
        Index(
            "idx_conversations_support_user",
            "support_user_id",
            postgresql_where=text("kind = 'support'::text"),
        ),
        Index("idx_conversations_vendor", "vendor_user_id"),
        {"comment": "DM thread between a client and a vendor; last_read_* drive unread badges."},
    )

    client_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", name="conversations_client_user_id_fkey", ondelete="RESTRICT")
    )
    vendor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", name="conversations_vendor_user_id_fkey", ondelete="RESTRICT")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    client_last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    vendor_last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    kind: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'dm'::text"),
        comment="dm = client-vendor pair; support = Eventtz Support ↔ one end user.",
    )
    support_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="conversations_support_user_id_fkey", ondelete="CASCADE"),
        comment="End user (client or vendor) on a support thread; null for DMs.",
    )
    admin_last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), comment="Staff read cursor for support threads."
    )


class Message(Base, UUIDPrimaryKey):
    """One message in a conversation: plain text, or sanitised HTML when staff sent it."""

    __tablename__ = "messages"
    __table_args__ = (
        Index("idx_messages_conversation_created", "conversation_id", text("created_at DESC")),
        {"comment": "Chat messages; sender must be client or vendor on the conversation."},
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("conversations.id", name="messages_conversation_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    sender_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="messages_sender_user_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        comment=(
            "Message body: plain text for user DMs; sanitized HTML for admin support messages "
            "(metadata.format = html)."
        ),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    metadata_: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata",
        JSONB,
        comment=(
            'Optional structured payload for non-plain-text messages, e.g. {"kind":"quote",'
            '"booking_request_id":"...","event_name":"...","total_label":"...","status":"pending"}.'
        ),
    )
