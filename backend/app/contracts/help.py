"""Help Center API contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class HelpCategoryOut(BaseModel):
    id: str
    slug: str
    title: str
    description: str
    icon_key: str
    sort_order: int
    audience: str
    article_count: int = 0


class HelpArticleListItem(BaseModel):
    id: str
    slug: str
    title: str
    summary: str
    audience: str
    category_id: str
    category_slug: str | None = None
    category_title: str | None = None
    sort_order: int


class HelpArticleDetail(HelpArticleListItem):
    body_md: str
    related_slugs: list[str] = Field(default_factory=list)


class HelpCategoriesResponse(BaseModel):
    categories: list[HelpCategoryOut]


class HelpArticlesResponse(BaseModel):
    articles: list[HelpArticleListItem]


class HelpArticleResponse(BaseModel):
    article: HelpArticleDetail


class HelpAskMessage(BaseModel):
    role: str = Field(description="user or assistant")
    content: str


class HelpAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    audience: str = Field(description="client, vendor, or admin")
    history: list[HelpAskMessage] = Field(default_factory=list, max_length=12)


class HelpAskResponse(BaseModel):
    answer_markdown: str
    related_article_slugs: list[str] = Field(default_factory=list)
    escalate_to_human: bool = False
    escalate_reason: str | None = None
