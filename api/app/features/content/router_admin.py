"""Staff routes: the blog CMS and the admin console's bug report form."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.core.pagination import DEFAULT_LIST_LIMIT
from app.core.ports import MailerDependency, WebhooksDependency
from app.features.content import service_blog, service_contact
from app.features.content.errors import MessageTooShort, PostNotFound, PostWriteFailed
from app.features.content.schemas import (
    AdminBugReportBody,
    BlogPostAdminDetailResponse,
    BlogPostCreateBody,
    BlogPostDeleteResponse,
    BlogPostsListResponse,
    BlogPostUpdateBody,
    ContactSubmitResponse,
)

router = APIRouter(prefix="/admin")


# Errors every route that changes an existing post can return.
_POST_CHANGE_ERRORS = (*ROLE_ERRORS, PostNotFound, PostWriteFailed)


@router.get(
    "/blog/posts",
    tags=["admin-blog"],
    response_model=BlogPostsListResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def list_posts(
    session: SessionDep,
    principal: CurrentStaff,
    search: str | None = Query(None, description="Match title, slug, or author"),
    status: str | None = Query(None, description="draft or published"),
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIST_LIMIT, ge=1, le=200),
) -> BlogPostsListResponse:
    """Every post, draft or published, most recently edited first."""
    posts, total = await service_blog.list_posts_for_staff_page(
        session, status=status, search=search, offset=offset, limit=limit
    )
    return BlogPostsListResponse(posts=posts, total=total, offset=offset, limit=limit)


@router.post(
    "/blog/posts",
    tags=["admin-blog"],
    response_model=BlogPostAdminDetailResponse,
    responses=error_responses(*ROLE_ERRORS, PostWriteFailed),
)
async def create_post(
    session: SessionDep, principal: CurrentStaff, body: BlogPostCreateBody
) -> BlogPostAdminDetailResponse:
    """Start a new draft."""
    return BlogPostAdminDetailResponse(post=await service_blog.create_draft(session, principal.id, body))


@router.get(
    "/blog/posts/{post_id}",
    tags=["admin-blog"],
    response_model=BlogPostAdminDetailResponse,
    responses=error_responses(*ROLE_ERRORS, PostNotFound),
)
async def get_post(session: SessionDep, principal: CurrentStaff, post_id: str) -> BlogPostAdminDetailResponse:
    """One post for the editor."""
    return BlogPostAdminDetailResponse(post=await service_blog.get_post_for_staff(session, post_id))


@router.patch(
    "/blog/posts/{post_id}",
    tags=["admin-blog"],
    response_model=BlogPostAdminDetailResponse,
    responses=error_responses(*_POST_CHANGE_ERRORS),
)
async def update_post(
    session: SessionDep, principal: CurrentStaff, post_id: str, body: BlogPostUpdateBody
) -> BlogPostAdminDetailResponse:
    """Save an edit (only the fields sent change)."""
    return BlogPostAdminDetailResponse(
        post=await service_blog.update_post(session, principal.id, post_id, body)
    )


@router.delete(
    "/blog/posts/{post_id}",
    tags=["admin-blog"],
    response_model=BlogPostDeleteResponse,
    responses=error_responses(*_POST_CHANGE_ERRORS),
)
async def delete_post(session: SessionDep, principal: CurrentStaff, post_id: str) -> BlogPostDeleteResponse:
    """Delete a post for good."""
    await service_blog.delete_post(session, principal.id, post_id)
    return BlogPostDeleteResponse()


@router.post(
    "/blog/posts/{post_id}/publish",
    tags=["admin-blog"],
    response_model=BlogPostAdminDetailResponse,
    responses=error_responses(*_POST_CHANGE_ERRORS),
)
async def publish_post(
    session: SessionDep, principal: CurrentStaff, post_id: str
) -> BlogPostAdminDetailResponse:
    """Make a post public."""
    return BlogPostAdminDetailResponse(post=await service_blog.publish_post(session, principal.id, post_id))


@router.post(
    "/blog/posts/{post_id}/unpublish",
    tags=["admin-blog"],
    response_model=BlogPostAdminDetailResponse,
    responses=error_responses(*_POST_CHANGE_ERRORS),
)
async def unpublish_post(
    session: SessionDep, principal: CurrentStaff, post_id: str
) -> BlogPostAdminDetailResponse:
    """Take a post back to draft."""
    return BlogPostAdminDetailResponse(post=await service_blog.unpublish_post(session, principal.id, post_id))


@router.post(
    "/contact",
    tags=["admin"],
    response_model=ContactSubmitResponse,
    responses=error_responses(*ROLE_ERRORS, MessageTooShort),
)
async def submit_bug_report(
    session: SessionDep,
    principal: CurrentStaff,
    body: AdminBugReportBody,
    mailer: MailerDependency,
    webhooks: WebhooksDependency,
) -> ContactSubmitResponse:
    """A staff bug report from the admin console."""
    await service_contact.submit_bug_report(
        session, principal, message=body.message, mailer=mailer, webhooks=webhooks
    )
    return ContactSubmitResponse()
