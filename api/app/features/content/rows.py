"""Typed rows the content repository returns. Only the repository builds them; schemas never import them.

Plain values (text ids, ISO timestamps): the shape the domain rules and goldens
were written against. The mapped tables are in `models.py`."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class BlogPostRow(BaseModel):
    """A `blog_posts` row. List queries select fewer columns, so the body fields default to empty."""

    id: str
    slug: str = ""
    title: str = ""
    subtitle: str | None = None
    cover_image_url: str | None = None
    excerpt: str | None = None
    author_name: str | None = None
    status: str = "draft"
    published_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    body_json: Any = None
    body_html: str | None = None
    author_admin_user_id: str | None = None


class HelpCategoryRow(BaseModel):
    """A `help_categories` row (every column is NOT NULL in the schema)."""

    id: str
    slug: str
    title: str
    description: str
    icon_key: str
    sort_order: int
    audience: str


class HelpCategoryName(BaseModel):
    """Just enough of a category to label an article with it."""

    id: str
    slug: str
    title: str


class HelpArticleRow(BaseModel):
    """A `help_articles` row. `body_md` is only selected for the detail page."""

    id: str
    category_id: str
    slug: str
    title: str
    summary: str
    audience: str
    sort_order: int
    related_slugs: list[str] = Field(default_factory=list)
    body_md: str = ""


class HelpArticleText(BaseModel):
    """The searchable text of an article, as the assistant's keyword retrieval reads it."""

    slug: str
    title: str
    summary: str
    body_md: str
    audience: str
    related_slugs: list[str] = Field(default_factory=list)
