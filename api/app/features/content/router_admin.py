"""Staff routes: the blog CMS and the admin console's bug report form."""

from __future__ import annotations

from fastapi import APIRouter

from app.core.auth import ROLE_ERRORS, CurrentStaff
from app.core.errors import error_responses
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
def list_posts(principal: CurrentStaff) -> BlogPostsListResponse:
    """Every post, draft or published, most recently edited first."""
    return BlogPostsListResponse(posts=service_blog.list_posts_for_staff())


@router.post(
    "/blog/posts",
    tags=["admin-blog"],
    response_model=BlogPostAdminDetailResponse,
    responses=error_responses(*ROLE_ERRORS, PostWriteFailed),
)
def create_post(principal: CurrentStaff, body: BlogPostCreateBody) -> BlogPostAdminDetailResponse:
    """Start a new draft."""
    return BlogPostAdminDetailResponse(post=service_blog.create_draft(principal.id, body))


@router.get(
    "/blog/posts/{post_id}",
    tags=["admin-blog"],
    response_model=BlogPostAdminDetailResponse,
    responses=error_responses(*ROLE_ERRORS, PostNotFound),
)
def get_post(principal: CurrentStaff, post_id: str) -> BlogPostAdminDetailResponse:
    """One post for the editor."""
    return BlogPostAdminDetailResponse(post=service_blog.get_post_for_staff(post_id))


@router.patch(
    "/blog/posts/{post_id}",
    tags=["admin-blog"],
    response_model=BlogPostAdminDetailResponse,
    responses=error_responses(*_POST_CHANGE_ERRORS),
)
def update_post(
    principal: CurrentStaff, post_id: str, body: BlogPostUpdateBody
) -> BlogPostAdminDetailResponse:
    """Save an edit (only the fields sent change)."""
    return BlogPostAdminDetailResponse(post=service_blog.update_post(principal.id, post_id, body))


@router.delete(
    "/blog/posts/{post_id}",
    tags=["admin-blog"],
    response_model=BlogPostDeleteResponse,
    responses=error_responses(*_POST_CHANGE_ERRORS),
)
def delete_post(principal: CurrentStaff, post_id: str) -> BlogPostDeleteResponse:
    """Delete a post for good."""
    service_blog.delete_post(principal.id, post_id)
    return BlogPostDeleteResponse()


@router.post(
    "/blog/posts/{post_id}/publish",
    tags=["admin-blog"],
    response_model=BlogPostAdminDetailResponse,
    responses=error_responses(*_POST_CHANGE_ERRORS),
)
def publish_post(principal: CurrentStaff, post_id: str) -> BlogPostAdminDetailResponse:
    """Make a post public."""
    return BlogPostAdminDetailResponse(post=service_blog.publish_post(principal.id, post_id))


@router.post(
    "/blog/posts/{post_id}/unpublish",
    tags=["admin-blog"],
    response_model=BlogPostAdminDetailResponse,
    responses=error_responses(*_POST_CHANGE_ERRORS),
)
def unpublish_post(principal: CurrentStaff, post_id: str) -> BlogPostAdminDetailResponse:
    """Take a post back to draft."""
    return BlogPostAdminDetailResponse(post=service_blog.unpublish_post(principal.id, post_id))


@router.post(
    "/contact",
    tags=["admin"],
    response_model=ContactSubmitResponse,
    responses=error_responses(*ROLE_ERRORS, MessageTooShort),
)
def submit_bug_report(
    principal: CurrentStaff, body: AdminBugReportBody, mailer: MailerDependency, webhooks: WebhooksDependency
) -> ContactSubmitResponse:
    """A staff bug report from the admin console."""
    service_contact.submit_bug_report(principal, message=body.message, mailer=mailer, webhooks=webhooks)
    return ContactSubmitResponse()
