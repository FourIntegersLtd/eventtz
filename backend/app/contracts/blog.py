"""Shared types for blog posts (admin editing and public pages)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


BlogPostStatus = Literal["draft", "published"]


class BlogPostListItem(BaseModel):
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
    body_html: str = ""


class BlogPostAdminDetail(BlogPostListItem):
    body_json: dict[str, Any] = Field(default_factory=dict)
    body_html: str = ""
    author_admin_user_id: str | None = None


class BlogPostsListResponse(BaseModel):
    success: bool = True
    posts: list[BlogPostListItem]


class BlogPostPublicDetailResponse(BaseModel):
    success: bool = True
    post: BlogPostPublicDetail


class BlogPostAdminDetailResponse(BaseModel):
    success: bool = True
    post: BlogPostAdminDetail


class BlogPostCreateBody(BaseModel):
    title: str = Field(default="Untitled", max_length=300)
    subtitle: str | None = Field(default=None, max_length=500)
    slug: str | None = Field(default=None, max_length=200)
    author_name: str | None = Field(default=None, max_length=120)


class BlogPostUpdateBody(BaseModel):
    title: str | None = Field(default=None, max_length=300)
    subtitle: str | None = Field(default=None, max_length=500)
    slug: str | None = Field(default=None, max_length=200)
    cover_image_url: str | None = None
    body_json: dict[str, Any] | None = None
    body_html: str | None = None
    excerpt: str | None = Field(default=None, max_length=600)
    author_name: str | None = Field(default=None, max_length=120)


class BlogPostDeleteResponse(BaseModel):
    success: bool = True
