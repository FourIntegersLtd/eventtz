"""Admin blog CMS HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, Response

from app.contracts.blog import (
    BlogPostAdminDetail,
    BlogPostAdminDetailResponse,
    BlogPostCreateBody,
    BlogPostDeleteResponse,
    BlogPostListItem,
    BlogPostsListResponse,
    BlogPostUpdateBody,
)
from app.core.errors import NotFoundError, ServiceUnavailableError
from app.features.admin.audit import insert_admin_audit_log
from app.features.auth.http.guards import require_admin
from app.features.blog import service as blog_service

router = APIRouter(prefix="/admin/blog", tags=["admin-blog"])


@router.get("/posts", response_model=BlogPostsListResponse)
def admin_list_blog_posts(request: Request, response: Response) -> BlogPostsListResponse:
    require_admin(request, response)
    rows = blog_service.list_posts_for_admin()
    return BlogPostsListResponse(posts=[BlogPostListItem.model_validate(r) for r in rows])


@router.post("/posts", response_model=BlogPostAdminDetailResponse)
def admin_create_blog_post(
    request: Request,
    response: Response,
    body: BlogPostCreateBody,
) -> BlogPostAdminDetailResponse:
    admin = require_admin(request, response)
    admin_id = str(admin.get("id") or "")
    try:
        row = blog_service.create_draft_post(
            author_admin_user_id=admin_id,
            title=body.title,
            subtitle=body.subtitle,
            slug=body.slug,
        )
    except ServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=admin_id,
        action="blog.create",
        entity_type="blog_post",
        entity_id=row.get("id"),
        payload={"slug": row.get("slug")},
    )
    return BlogPostAdminDetailResponse(post=BlogPostAdminDetail.model_validate(row))


@router.get("/posts/{post_id}", response_model=BlogPostAdminDetailResponse)
def admin_get_blog_post(
    post_id: str,
    request: Request,
    response: Response,
) -> BlogPostAdminDetailResponse:
    require_admin(request, response)
    row = blog_service.get_post_for_admin(post_id)
    if not row:
        raise HTTPException(status_code=404, detail="Post not found.")
    return BlogPostAdminDetailResponse(post=BlogPostAdminDetail.model_validate(row))


@router.patch("/posts/{post_id}", response_model=BlogPostAdminDetailResponse)
def admin_update_blog_post(
    post_id: str,
    request: Request,
    response: Response,
    body: BlogPostUpdateBody,
) -> BlogPostAdminDetailResponse:
    admin = require_admin(request, response)
    fields = body.model_dump(exclude_unset=True)
    try:
        row = blog_service.update_post(post_id, fields)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(admin.get("id") or ""),
        action="blog.update",
        entity_type="blog_post",
        entity_id=post_id,
        payload={"fields": list(fields.keys())},
    )
    return BlogPostAdminDetailResponse(post=BlogPostAdminDetail.model_validate(row))


@router.post("/posts/{post_id}/publish", response_model=BlogPostAdminDetailResponse)
def admin_publish_blog_post(
    post_id: str,
    request: Request,
    response: Response,
) -> BlogPostAdminDetailResponse:
    admin = require_admin(request, response)
    try:
        row = blog_service.publish_post(post_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(admin.get("id") or ""),
        action="blog.publish",
        entity_type="blog_post",
        entity_id=post_id,
        payload={"slug": row.get("slug")},
    )
    return BlogPostAdminDetailResponse(post=BlogPostAdminDetail.model_validate(row))


@router.post("/posts/{post_id}/unpublish", response_model=BlogPostAdminDetailResponse)
def admin_unpublish_blog_post(
    post_id: str,
    request: Request,
    response: Response,
) -> BlogPostAdminDetailResponse:
    admin = require_admin(request, response)
    try:
        row = blog_service.unpublish_post(post_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(admin.get("id") or ""),
        action="blog.unpublish",
        entity_type="blog_post",
        entity_id=post_id,
        payload={"slug": row.get("slug")},
    )
    return BlogPostAdminDetailResponse(post=BlogPostAdminDetail.model_validate(row))


@router.delete("/posts/{post_id}", response_model=BlogPostDeleteResponse)
def admin_delete_blog_post(
    post_id: str,
    request: Request,
    response: Response,
) -> BlogPostDeleteResponse:
    admin = require_admin(request, response)
    try:
        blog_service.delete_post(post_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ServiceUnavailableError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    insert_admin_audit_log(
        admin_user_id=str(admin.get("id") or ""),
        action="blog.delete",
        entity_type="blog_post",
        entity_id=post_id,
        payload={},
    )
    return BlogPostDeleteResponse()
