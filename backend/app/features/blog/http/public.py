"""Public blog routes (no sign-in required)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.contracts.blog import (
    BlogPostListItem,
    BlogPostPublicDetail,
    BlogPostPublicDetailResponse,
    BlogPostsListResponse,
)
from app.features.blog import service as blog_service

router = APIRouter(prefix="/blog", tags=["blog"])


@router.get("/posts", response_model=BlogPostsListResponse)
def public_list_blog_posts(
    limit: int = Query(50, ge=1, le=100),
) -> BlogPostsListResponse:
    rows = blog_service.list_published_posts(limit=limit)
    return BlogPostsListResponse(posts=[BlogPostListItem.model_validate(r) for r in rows])


@router.get("/posts/{slug}", response_model=BlogPostPublicDetailResponse)
def public_get_blog_post(slug: str) -> BlogPostPublicDetailResponse:
    row = blog_service.get_published_post_by_slug(slug)
    if not row:
        raise HTTPException(status_code=404, detail="Post not found.")
    return BlogPostPublicDetailResponse(post=BlogPostPublicDetail.model_validate(row))
