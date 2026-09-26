"""Database access for blog posts, help articles and contact submissions. The only file here that queries.

Every function takes the request's session and never commits (ADR 0002). Reads
raise when the database fails, so callers see an error rather than an empty page
(the baseline returned `[]`). Writes return the stored row.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import Uuid, column, delete, insert, select, table, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import as_uuid, plain_row
from app.features.content.models import BlogPost, ContactSubmission, HelpArticle, HelpCategory
from app.features.content.rows import (
    BlogPostRow,
    BookingParties,
    HelpArticleRow,
    HelpArticleText,
    HelpCategoryName,
    HelpCategoryRow,
)

# --- blog posts ----------------------------------------------------------------------------------

# The admin and public lists leave out the bodies, which can be large.
_BLOG_LIST_COLUMNS = (
    BlogPost.id,
    BlogPost.slug,
    BlogPost.title,
    BlogPost.subtitle,
    BlogPost.cover_image_url,
    BlogPost.excerpt,
    BlogPost.author_name,
    BlogPost.status,
    BlogPost.published_at,
    BlogPost.created_at,
    BlogPost.updated_at,
)
_BLOG_DETAIL_COLUMNS = (
    *_BLOG_LIST_COLUMNS,
    BlogPost.body_json,
    BlogPost.body_html,
    BlogPost.author_admin_user_id,
)
# The admin list is capped; the CMS has never come close to this many posts.
ADMIN_POST_LIST_LIMIT = 500


async def list_posts_newest_first(session: AsyncSession) -> list[BlogPostRow]:
    """Every post, most recently edited first (ties broken by creation time, then id)."""
    result = await session.execute(
        select(*_BLOG_LIST_COLUMNS)
        .order_by(BlogPost.updated_at.desc(), BlogPost.created_at.desc(), BlogPost.id.desc())
        .limit(ADMIN_POST_LIST_LIMIT)
    )
    return [BlogPostRow.model_validate(plain_row(row)) for row in result]


async def list_published_posts(session: AsyncSession, limit: int) -> list[BlogPostRow]:
    """Published posts, newest publication first."""
    result = await session.execute(
        select(*_BLOG_LIST_COLUMNS)
        .where(BlogPost.status == "published")
        .order_by(BlogPost.published_at.desc())
        .limit(limit)
    )
    return [BlogPostRow.model_validate(plain_row(row)) for row in result]


async def find_post(session: AsyncSession, post_id: str) -> BlogPostRow | None:
    """One post by id, draft or published; `None` for an unknown or malformed id."""
    parsed_id = as_uuid(post_id)
    if parsed_id is None:
        return None
    row = (await session.execute(select(*_BLOG_DETAIL_COLUMNS).where(BlogPost.id == parsed_id))).first()
    return BlogPostRow.model_validate(plain_row(row)) if row else None


async def find_published_post(session: AsyncSession, slug: str) -> BlogPostRow | None:
    """One published post by slug (drafts are invisible to the public)."""
    row = (
        await session.execute(
            select(*_BLOG_DETAIL_COLUMNS)
            .where(BlogPost.slug == slug, BlogPost.status == "published")
            .limit(1)
        )
    ).first()
    return BlogPostRow.model_validate(plain_row(row)) if row else None


async def post_id_with_slug(session: AsyncSession, slug: str) -> str | None:
    """The id of the post already using `slug`, if any."""
    post_id = await session.scalar(select(BlogPost.id).where(BlogPost.slug == slug).limit(1))
    return str(post_id) if post_id is not None else None


def _post_values(values: dict[str, Any]) -> dict[str, Any]:
    """Column values as the table takes them: the author id parsed to a UUID when present.

    Timestamps may stay ISO text; Postgres casts them.
    """
    if "author_admin_user_id" in values:
        return {**values, "author_admin_user_id": as_uuid(values["author_admin_user_id"])}
    return values


async def insert_post(session: AsyncSession, values: dict[str, Any]) -> BlogPostRow | None:
    """Insert a post and return the stored row."""
    result = await session.execute(
        insert(BlogPost).values(**_post_values(values)).returning(*_BLOG_DETAIL_COLUMNS)
    )
    row = result.first()
    return BlogPostRow.model_validate(plain_row(row)) if row else None


async def update_post(session: AsyncSession, post_id: str, changes: dict[str, Any]) -> BlogPostRow | None:
    """Apply `changes` to a post; the updated row, or `None` when no post has that id."""
    parsed_id = as_uuid(post_id)
    if parsed_id is None:
        return None
    result = await session.execute(
        update(BlogPost)
        .where(BlogPost.id == parsed_id)
        .values(**_post_values(changes))
        .returning(*_BLOG_DETAIL_COLUMNS)
    )
    row = result.first()
    return BlogPostRow.model_validate(plain_row(row)) if row else None


async def delete_post(session: AsyncSession, post_id: str) -> None:
    """Delete a post for good."""
    parsed_id = as_uuid(post_id)
    if parsed_id is not None:
        await session.execute(delete(BlogPost).where(BlogPost.id == parsed_id))


# --- help center -------------------------------------------------------------------------------

_CATEGORY_COLUMNS = (
    HelpCategory.id,
    HelpCategory.slug,
    HelpCategory.title,
    HelpCategory.description,
    HelpCategory.icon_key,
    HelpCategory.sort_order,
    HelpCategory.audience,
)
_CATEGORY_NAME_COLUMNS = (HelpCategory.id, HelpCategory.slug, HelpCategory.title)
_ARTICLE_LIST_COLUMNS = (
    HelpArticle.id,
    HelpArticle.category_id,
    HelpArticle.slug,
    HelpArticle.title,
    HelpArticle.summary,
    HelpArticle.audience,
    HelpArticle.sort_order,
    HelpArticle.related_slugs,
)


async def list_published_categories(session: AsyncSession, audiences: list[str]) -> list[HelpCategoryRow]:
    """Published categories for these audience values, in display order."""
    result = await session.execute(
        select(*_CATEGORY_COLUMNS)
        .where(HelpCategory.published.is_(True), HelpCategory.audience.in_(audiences))
        .order_by(HelpCategory.sort_order)
    )
    return [HelpCategoryRow.model_validate(plain_row(row)) for row in result]


async def published_article_category_ids(session: AsyncSession, audiences: list[str]) -> list[str]:
    """The category id of every published article for these audiences (one entry per article)."""
    result = await session.execute(
        select(HelpArticle.category_id).where(
            HelpArticle.published.is_(True), HelpArticle.audience.in_(audiences)
        )
    )
    return [str(category_id) for category_id in result.scalars() if category_id]


async def find_published_category(session: AsyncSession, slug: str) -> HelpCategoryName | None:
    """A published category by slug."""
    row = (
        await session.execute(
            select(*_CATEGORY_NAME_COLUMNS)
            .where(HelpCategory.slug == slug, HelpCategory.published.is_(True))
            .limit(1)
        )
    ).first()
    return HelpCategoryName.model_validate(plain_row(row)) if row else None


async def list_published_category_names(session: AsyncSession) -> list[HelpCategoryName]:
    """Every published category's id, slug and title (for labelling articles)."""
    result = await session.execute(select(*_CATEGORY_NAME_COLUMNS).where(HelpCategory.published.is_(True)))
    return [HelpCategoryName.model_validate(plain_row(row)) for row in result]


async def find_category_name(session: AsyncSession, category_id: str) -> HelpCategoryName | None:
    """A category by id, published or not (an article page still shows its category)."""
    parsed_id = as_uuid(category_id)
    if parsed_id is None:
        return None
    row = (await session.execute(select(*_CATEGORY_NAME_COLUMNS).where(HelpCategory.id == parsed_id))).first()
    return HelpCategoryName.model_validate(plain_row(row)) if row else None


async def list_published_articles(
    session: AsyncSession, audiences: list[str], category_id: str | None
) -> list[HelpArticleRow]:
    """Published articles for these audiences, optionally in one category, in display order."""
    query = select(*_ARTICLE_LIST_COLUMNS).where(
        HelpArticle.published.is_(True), HelpArticle.audience.in_(audiences)
    )
    if category_id:
        query = query.where(HelpArticle.category_id == as_uuid(category_id))
    result = await session.execute(query.order_by(HelpArticle.sort_order))
    return [HelpArticleRow.model_validate(plain_row(row)) for row in result]


async def find_published_article(
    session: AsyncSession, slug: str, audiences: list[str]
) -> HelpArticleRow | None:
    """A published article by slug, with its body, if one of these audiences may read it."""
    row = (
        await session.execute(
            select(*_ARTICLE_LIST_COLUMNS, HelpArticle.body_md)
            .where(
                HelpArticle.slug == slug,
                HelpArticle.published.is_(True),
                HelpArticle.audience.in_(audiences),
            )
            .limit(1)
        )
    ).first()
    return HelpArticleRow.model_validate(plain_row(row)) if row else None


async def published_titles_by_slug(session: AsyncSession, slugs: list[str]) -> dict[str, str]:
    """`{slug: title}` for the published articles among `slugs` (any audience)."""
    result = await session.execute(
        select(HelpArticle.slug, HelpArticle.title).where(
            HelpArticle.slug.in_(slugs), HelpArticle.published.is_(True)
        )
    )
    return {str(slug): str(title or slug) for slug, title in result if slug}


async def list_article_texts(session: AsyncSession, audiences: list[str]) -> list[HelpArticleText]:
    """The searchable text of every published article for these audiences (the assistant's pool)."""
    result = await session.execute(
        select(
            HelpArticle.slug,
            HelpArticle.title,
            HelpArticle.summary,
            HelpArticle.body_md,
            HelpArticle.audience,
            HelpArticle.related_slugs,
        ).where(HelpArticle.published.is_(True), HelpArticle.audience.in_(audiences))
    )
    return [HelpArticleText.model_validate(plain_row(row)) for row in result]


# --- contact ----------------------------------------------------------------------------------------

# `booking_requests` belongs to the bookings slice; only the columns read here are declared.
_booking_requests = table(
    "booking_requests", column("id", Uuid), column("client_user_id", Uuid), column("vendor_user_id", Uuid)
)


async def find_booking_parties(session: AsyncSession, booking_id: str) -> BookingParties | None:
    """The client and vendor on a booking.

    Reads `booking_requests` directly until the bookings slice is rebuilt; then
    this moves behind `bookings.service`.
    """
    parsed_id = as_uuid(booking_id)
    if parsed_id is None:
        return None
    bookings = _booking_requests.c
    row = (
        await session.execute(
            select(bookings.id, bookings.client_user_id, bookings.vendor_user_id).where(
                bookings.id == parsed_id
            )
        )
    ).first()
    return BookingParties.model_validate(plain_row(row)) if row else None


async def insert_contact_submission(
    session: AsyncSession,
    *,
    user_id: str,
    portal: str,
    subject_label: str,
    message: str,
    booking_id: str | None,
) -> str | None:
    """Store a contact message and return its new id."""
    submission_id = await session.scalar(
        insert(ContactSubmission)
        .values(
            user_id=as_uuid(user_id),
            portal=portal,
            subject=subject_label,
            message=message,
            booking_id=as_uuid(booking_id),
        )
        .returning(ContactSubmission.id)
    )
    return str(submission_id) if submission_id is not None else None
