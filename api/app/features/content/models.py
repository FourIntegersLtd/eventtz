"""Tables owned by `content`: the blog, the help centre and contact-form messages.

Only this slice's repository imports these classes. They mirror the baseline
schema (Alembic 0002); `alembic check` fails when the two drift apart. CHECK
constraints (status and audience values) live in the migrations only.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint, Uuid, func, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamps, UUIDPrimaryKey


class BlogPost(Base, UUIDPrimaryKey, Timestamps):
    """A marketing blog post: staff draft it in TipTap, readers get the sanitised HTML."""

    __tablename__ = "blog_posts"
    __table_args__ = (
        Index("blog_posts_slug_unique", "slug", unique=True),
        Index(
            "idx_blog_posts_published_feed",
            "status",
            text("published_at DESC NULLS LAST"),
            postgresql_where=text("status = 'published'::text"),
        ),
        Index("idx_blog_posts_updated", text("updated_at DESC")),
        {
            "comment": (
                "Public marketing blog; admins draft/publish. "
                "body_json = TipTap doc; body_html = sanitized HTML for readers."
            )
        },
    )

    slug: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    subtitle: Mapped[str | None] = mapped_column(Text)
    cover_image_url: Mapped[str | None] = mapped_column(Text)
    body_json: Mapped[Any] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    body_html: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    excerpt: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'draft'"))
    author_admin_user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", name="blog_posts_author_admin_user_id_fkey", ondelete="SET NULL")
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    author_name: Mapped[str | None] = mapped_column(
        Text,
        comment='Display name shown as "By …" on public blog pages; independent of author_admin_user_id.',
    )


class HelpCategory(Base, UUIDPrimaryKey, Timestamps):
    """A help-centre section, shown to the portals its `audience` names."""

    __tablename__ = "help_categories"
    __table_args__ = (
        UniqueConstraint("slug", name="help_categories_slug_unique"),
        Index(
            "idx_help_categories_audience_sort",
            "audience",
            "sort_order",
            postgresql_where=text("published = true"),
        ),
        {"comment": "Help Center categories filtered by portal audience (client/vendor/both)."},
    )

    slug: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    icon_key: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'book'"))
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    audience: Mapped[str] = mapped_column(Text, nullable=False)
    published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))


class HelpArticle(Base, UUIDPrimaryKey, Timestamps):
    """A help-centre article in markdown; also what the assistant retrieves from."""

    __tablename__ = "help_articles"
    __table_args__ = (
        UniqueConstraint("slug", name="help_articles_slug_unique"),
        Index(
            "idx_help_articles_audience_sort",
            "audience",
            "sort_order",
            postgresql_where=text("published = true"),
        ),
        Index("idx_help_articles_category", "category_id", "sort_order"),
        {"comment": "Help Center articles (markdown body). Source for browse + AI assistant retrieval."},
    )

    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("help_categories.id", name="help_articles_category_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    slug: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    body_md: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("''"))
    audience: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    related_slugs: Mapped[list[str]] = mapped_column(
        ARRAY(Text), nullable=False, server_default=text("'{}'::text[]")
    )


class ContactSubmission(Base, UUIDPrimaryKey):
    """A message sent through a portal's contact form, optionally about one booking.

    `booking_id` references `booking_requests`, which the bookings slice will own;
    the foreign key is in the schema, and joins the model when that table is mapped.
    """

    __tablename__ = "contact_submissions"
    __table_args__ = (
        Index("idx_contact_submissions_created_at", text("created_at DESC")),
        Index("idx_contact_submissions_user_id", "user_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", name="contact_submissions_user_id_fkey", ondelete="CASCADE"),
        nullable=False,
    )
    portal: Mapped[str] = mapped_column(Text, nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    booking_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
