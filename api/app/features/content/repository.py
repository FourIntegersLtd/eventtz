"""Database access for blog posts, help articles and contact submissions. The only file here that queries.

Reads raise when the database fails, so callers see an error rather than an
empty page (the baseline returned `[]`). Writes return the stored row.
"""

from __future__ import annotations

from typing import Any

from app.core import db
from app.features.content.models import (
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
    "id,slug,title,subtitle,cover_image_url,excerpt,author_name,status,published_at,created_at,updated_at"
)
# The admin list is capped; the CMS has never come close to this many posts.
ADMIN_POST_LIST_LIMIT = 500


def list_posts_newest_first() -> list[BlogPostRow]:
    """Every post, most recently edited first (ties broken by creation time, then id)."""
    result = (
        db.service_client()
        .table("blog_posts")
        .select(_BLOG_LIST_COLUMNS)
        .order("updated_at", desc=True)
        .order("created_at", desc=True)
        .order("id", desc=True)
        .limit(ADMIN_POST_LIST_LIMIT)
        .execute()
    )
    return [BlogPostRow.model_validate(row) for row in db.rows(result)]


def list_published_posts(limit: int) -> list[BlogPostRow]:
    """Published posts, newest publication first."""
    result = (
        db.service_client()
        .table("blog_posts")
        .select(_BLOG_LIST_COLUMNS)
        .eq("status", "published")
        .order("published_at", desc=True)
        .limit(limit)
        .execute()
    )
    return [BlogPostRow.model_validate(row) for row in db.rows(result)]


def find_post(post_id: str) -> BlogPostRow | None:
    """One post by id, draft or published."""
    result = db.service_client().table("blog_posts").select("*").eq("id", post_id).limit(1).execute()
    row = db.first(result)
    return BlogPostRow.model_validate(row) if row else None


def find_published_post(slug: str) -> BlogPostRow | None:
    """One published post by slug (drafts are invisible to the public)."""
    result = (
        db.service_client()
        .table("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .limit(1)
        .execute()
    )
    row = db.first(result)
    return BlogPostRow.model_validate(row) if row else None


def post_id_with_slug(slug: str) -> str | None:
    """The id of the post already using `slug`, if any."""
    result = db.service_client().table("blog_posts").select("id").eq("slug", slug).limit(1).execute()
    row = db.first(result)
    return str(row["id"]) if row else None


def insert_post(values: dict[str, Any]) -> BlogPostRow | None:
    """Insert a post; the stored row, or `None` when the database returned nothing."""
    result = db.service_client().table("blog_posts").insert(values).execute()
    row = db.first(result)
    return BlogPostRow.model_validate(row) if row else None


def update_post(post_id: str, changes: dict[str, Any]) -> BlogPostRow | None:
    """Apply `changes` to a post; the updated row, or `None` when the database returned nothing."""
    result = db.service_client().table("blog_posts").update(changes).eq("id", post_id).execute()
    row = db.first(result)
    return BlogPostRow.model_validate(row) if row else None


def delete_post(post_id: str) -> None:
    """Delete a post for good."""
    db.service_client().table("blog_posts").delete().eq("id", post_id).execute()


# --- help center -------------------------------------------------------------------------------

_CATEGORY_COLUMNS = "id,slug,title,description,icon_key,sort_order,audience"
_ARTICLE_LIST_COLUMNS = "id,category_id,slug,title,summary,audience,sort_order,related_slugs"


def list_published_categories(audiences: list[str]) -> list[HelpCategoryRow]:
    """Published categories for these audience values, in display order."""
    result = (
        db.service_client()
        .table("help_categories")
        .select(_CATEGORY_COLUMNS)
        .eq("published", True)
        .in_("audience", audiences)
        .order("sort_order")
        .execute()
    )
    return [HelpCategoryRow.model_validate(row) for row in db.rows(result)]


def published_article_category_ids(audiences: list[str]) -> list[str]:
    """The category id of every published article for these audiences (one entry per article)."""
    result = (
        db.service_client()
        .table("help_articles")
        .select("category_id")
        .eq("published", True)
        .in_("audience", audiences)
        .execute()
    )
    return [str(row["category_id"]) for row in db.rows(result) if row.get("category_id")]


def find_published_category(slug: str) -> HelpCategoryName | None:
    """A published category by slug."""
    result = (
        db.service_client()
        .table("help_categories")
        .select("id,slug,title")
        .eq("slug", slug)
        .eq("published", True)
        .limit(1)
        .execute()
    )
    row = db.first(result)
    return HelpCategoryName.model_validate(row) if row else None


def list_published_category_names() -> list[HelpCategoryName]:
    """Every published category's id, slug and title (for labelling articles)."""
    result = (
        db.service_client().table("help_categories").select("id,slug,title").eq("published", True).execute()
    )
    return [HelpCategoryName.model_validate(row) for row in db.rows(result)]


def find_category_name(category_id: str) -> HelpCategoryName | None:
    """A category by id, published or not (an article page still shows its category)."""
    result = (
        db.service_client()
        .table("help_categories")
        .select("id,slug,title")
        .eq("id", category_id)
        .limit(1)
        .execute()
    )
    row = db.first(result)
    return HelpCategoryName.model_validate(row) if row else None


def list_published_articles(audiences: list[str], category_id: str | None) -> list[HelpArticleRow]:
    """Published articles for these audiences, optionally in one category, in display order."""
    query = (
        db.service_client()
        .table("help_articles")
        .select(_ARTICLE_LIST_COLUMNS)
        .eq("published", True)
        .in_("audience", audiences)
    )
    if category_id:
        query = query.eq("category_id", category_id)
    result = query.order("sort_order").execute()
    return [HelpArticleRow.model_validate(row) for row in db.rows(result)]


def find_published_article(slug: str, audiences: list[str]) -> HelpArticleRow | None:
    """A published article by slug, with its body, if one of these audiences may read it."""
    result = (
        db.service_client()
        .table("help_articles")
        .select(_ARTICLE_LIST_COLUMNS + ",body_md")
        .eq("slug", slug)
        .eq("published", True)
        .in_("audience", audiences)
        .limit(1)
        .execute()
    )
    row = db.first(result)
    return HelpArticleRow.model_validate(row) if row else None


def published_titles_by_slug(slugs: list[str]) -> dict[str, str]:
    """`{slug: title}` for the published articles among `slugs` (any audience)."""
    result = (
        db.service_client()
        .table("help_articles")
        .select("slug,title")
        .in_("slug", slugs)
        .eq("published", True)
        .execute()
    )
    return {
        str(row["slug"]): str(row.get("title") or row["slug"]) for row in db.rows(result) if row.get("slug")
    }


def list_article_texts(audiences: list[str]) -> list[HelpArticleText]:
    """The searchable text of every published article for these audiences (the assistant's pool)."""
    result = (
        db.service_client()
        .table("help_articles")
        .select("slug,title,summary,body_md,audience,related_slugs")
        .eq("published", True)
        .in_("audience", audiences)
        .execute()
    )
    return [HelpArticleText.model_validate(row) for row in db.rows(result)]


# --- contact ----------------------------------------------------------------------------------------


def find_booking_parties(booking_id: str) -> BookingParties | None:
    """The client and vendor on a booking.

    Reads `booking_requests` directly until the bookings slice is rebuilt; then
    this moves behind `bookings.service`.
    """
    result = (
        db.service_client()
        .table("booking_requests")
        .select("id,client_user_id,vendor_user_id")
        .eq("id", booking_id)
        .limit(1)
        .execute()
    )
    row = db.first(result)
    return BookingParties.model_validate(row) if row else None


def insert_contact_submission(
    *, user_id: str, portal: str, subject_label: str, message: str, booking_id: str | None
) -> str | None:
    """Store a contact message; its new id, or `None` when the database returned no row."""
    result = (
        db.service_client()
        .table("contact_submissions")
        .insert(
            {
                "user_id": user_id,
                "portal": portal,
                "subject": subject_label,
                "message": message,
                "booking_id": booking_id,
            }
        )
        .execute()
    )
    row = db.first(result)
    return str(row["id"]) if row and row.get("id") else None
