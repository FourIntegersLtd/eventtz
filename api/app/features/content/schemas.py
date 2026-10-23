"""Request and response bodies for the blog, Help Center and contact routes.

Names and fields match the baseline contracts, so the generated web types do not change.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

# --- blog ---------------------------------------------------------------------------------------
from app.core.pagination import PagedResponse

BlogPostStatus = Literal["draft", "published"]


class BlogPostListItem(BaseModel):
    """A post as it appears in a list (no body)."""

    id: str
    slug: str
    title: str
    subtitle: str | None = None
    cover_image_url: str | None = None
    excerpt: str | None = None
    author_name: str | None = None
    status: BlogPostStatus = "draft"
    published_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class BlogPostPublicDetail(BlogPostListItem):
    """A published post as the public blog page renders it (sanitised HTML only)."""

    body_html: str = ""


class BlogPostAdminDetail(BlogPostListItem):
    """A post as the CMS editor loads it: the editor document as well as the HTML."""

    body_json: dict[str, Any] = Field(default_factory=dict)
    body_html: str = ""
    author_admin_user_id: str | None = None


class BlogPostsListResponse(PagedResponse):
    """A list of posts."""

    success: bool = True
    posts: list[BlogPostListItem]


class BlogPostPublicDetailResponse(BaseModel):
    """One published post."""

    success: bool = True
    post: BlogPostPublicDetail


class BlogPostAdminDetailResponse(BaseModel):
    """One post for the editor."""

    success: bool = True
    post: BlogPostAdminDetail


class BlogPostCreateBody(BaseModel):
    """A new draft. `author_name` is accepted but not stored on create (baseline behaviour)."""

    title: str = Field(default="Untitled", max_length=300)
    subtitle: str | None = Field(default=None, max_length=500)
    slug: str | None = Field(default=None, max_length=200)
    author_name: str | None = Field(default=None, max_length=120)


class BlogPostUpdateBody(BaseModel):
    """An edit. Only the fields sent are changed; sending `null` clears the optional text fields."""

    title: str | None = Field(default=None, max_length=300)
    subtitle: str | None = Field(default=None, max_length=500)
    slug: str | None = Field(default=None, max_length=200)
    cover_image_url: str | None = None
    body_json: dict[str, Any] | None = None
    body_html: str | None = None
    excerpt: str | None = Field(default=None, max_length=600)
    author_name: str | None = Field(default=None, max_length=120)


class BlogPostDeleteResponse(BaseModel):
    """Confirms a post was deleted."""

    success: bool = True


# --- help center ------------------------------------------------------------------------------


class HelpCategoryOut(BaseModel):
    """A Help Center category tile, with how many articles it holds for this audience."""

    id: str
    slug: str
    title: str
    description: str
    icon_key: str
    sort_order: int
    audience: str
    article_count: int = 0


class HelpArticleListItem(BaseModel):
    """An article in a list, labelled with its category."""

    id: str
    slug: str
    title: str
    summary: str
    audience: str
    category_id: str
    category_slug: str | None = None
    category_title: str | None = None
    sort_order: int


class HelpRelatedArticle(BaseModel):
    """A "see also" link on an article page."""

    slug: str
    title: str


class HelpArticleDetail(HelpArticleListItem):
    """A full article with its markdown body and related links."""

    body_md: str
    related_slugs: list[str] = Field(default_factory=list)
    related_articles: list[HelpRelatedArticle] = Field(default_factory=list)


class HelpCategoriesResponse(BaseModel):
    """The categories for the caller's portal."""

    categories: list[HelpCategoryOut]


class HelpArticlesResponse(BaseModel):
    """The articles for the caller's portal (optionally one category)."""

    articles: list[HelpArticleListItem]


class HelpArticleResponse(BaseModel):
    """One article."""

    article: HelpArticleDetail


class HelpAskMessage(BaseModel):
    """One earlier turn of the help chat: `message_role` from the web app, or the baseline's `role`."""

    model_config = ConfigDict(populate_by_name=True)

    message_role: str = Field(
        description="user or assistant", validation_alias=AliasChoices("message_role", "role")
    )
    content: str


class HelpAskRequest(BaseModel):
    """A question for the help assistant, with up to 12 earlier turns."""

    question: str = Field(min_length=1, max_length=2000)
    audience: str = Field(description="client, vendor, or admin")
    history: list[HelpAskMessage] = Field(default_factory=list, max_length=12)


class HelpAskResponse(BaseModel):
    """The assistant's answer, the articles it points to, and whether to contact a person."""

    answer_markdown: str
    related_article_slugs: list[str] = Field(default_factory=list)
    escalate_to_human: bool = False
    escalate_reason: str | None = None


# --- contact ------------------------------------------------------------------------------------


class ContactSubmitBody(BaseModel):
    """A client or vendor contact message, optionally about one of their bookings."""

    message: str = Field(min_length=10, max_length=5000)
    booking_id: str | None = None


class AdminBugReportBody(BaseModel):
    """A bug report from the admin console."""

    message: str = Field(min_length=10, max_length=5000)


class ContactSubmitResponse(BaseModel):
    """Confirms the message was received."""

    success: bool = True
