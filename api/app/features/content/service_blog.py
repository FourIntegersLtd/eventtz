"""Blog use cases: staff draft, edit, publish and delete posts; anyone reads published ones.

Every staff change is written to the admin audit log (entity type `blog_post`).
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from app.core.logging import get_logger
from app.features.content import repository
from app.features.content.domain_blog import (
    DEFAULT_TITLE,
    LAST_NUMBERED_SLUG,
    NEW_POST_BODY,
    is_uuid,
    numbered_slug,
    post_changes,
    random_slug,
    slugify,
)
from app.features.content.errors import PostNotFound, PostWriteFailed
from app.features.content.models import BlogPostRow
from app.features.content.schemas import (
    BlogPostAdminDetail,
    BlogPostCreateBody,
    BlogPostListItem,
    BlogPostPublicDetail,
    BlogPostUpdateBody,
)
from app.features.staff import service as staff_service

log = get_logger(__name__)

# The audit log's entity type for every blog action.
AUDIT_ENTITY = "blog_post"
# User-facing copy when a write fails, per action (verbatim from the baseline).
CREATE_FAILED = "Could not create post."
UPDATE_FAILED = "Could not update post."
PUBLISH_FAILED = "Could not publish post."
UNPUBLISH_FAILED = "Could not unpublish post."
DELETE_FAILED = "Could not delete post."


def _now() -> str:
    """The current UTC time as an ISO-8601 string, the format the timestamps are stored in."""
    return datetime.now(UTC).isoformat()


# --- row → response ------------------------------------------------------------------------


def _list_item_fields(row: BlogPostRow) -> dict[str, Any]:
    """The list-level fields of a post, with a blank author shown as none."""
    author_name = row.author_name.strip() if row.author_name and row.author_name.strip() else None
    return {
        "id": row.id,
        "slug": row.slug,
        "title": row.title,
        "subtitle": row.subtitle,
        "cover_image_url": row.cover_image_url,
        "excerpt": row.excerpt,
        "author_name": author_name,
        "status": row.status or "draft",
        "published_at": row.published_at,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _list_item(row: BlogPostRow) -> BlogPostListItem:
    """A post for a list."""
    return BlogPostListItem(**_list_item_fields(row))


def _admin_detail(row: BlogPostRow) -> BlogPostAdminDetail:
    """A post for the editor. A missing or malformed editor document is sent as `{}`."""
    return BlogPostAdminDetail(
        **_list_item_fields(row),
        body_json=row.body_json if isinstance(row.body_json, dict) else {},
        body_html=row.body_html or "",
        author_admin_user_id=row.author_admin_user_id or None,
    )


def _public_detail(row: BlogPostRow) -> BlogPostPublicDetail:
    """A published post for the public page."""
    return BlogPostPublicDetail(**_list_item_fields(row), body_html=row.body_html or "")


# --- helpers -----------------------------------------------------------------------------------------


def _existing_post(post_id: str) -> BlogPostRow:
    """The post with this id, or `PostNotFound` (also for ids that are not UUIDs)."""
    post = repository.find_post(post_id) if is_uuid(post_id) else None
    if post is None:
        raise PostNotFound()
    return post


def _unique_slug(desired: str, *, exclude_post_id: str | None = None) -> str:
    """A free slug based on `desired`: `base`, then `base-2` … `base-49`, then a random suffix.

    A slug used by the post being edited (`exclude_post_id`) counts as free. If
    the lookup itself fails, a random suffix is used rather than failing the save.
    """
    base = slugify(desired)
    candidate = base
    for number in range(2, LAST_NUMBERED_SLUG + 1):
        try:
            owner_id = repository.post_id_with_slug(candidate)
        except Exception:
            log.exception("blog: slug check failed")
            return random_slug(base)
        if owner_id is None or owner_id == exclude_post_id:
            return candidate
        candidate = numbered_slug(base, number)
    return random_slug(base)


def _audit(admin_user_id: str, action: str, post_id: str, details: dict[str, Any]) -> None:
    """Record a staff action on a post."""
    staff_service.record_admin_action(
        admin_user_id=admin_user_id,
        action=action,
        entity_type=AUDIT_ENTITY,
        entity_id=post_id,
        details=details,
    )


def _write(
    action_failed_message: str, write: Callable[..., BlogPostRow | None], *arguments: Any
) -> BlogPostRow | None:
    """Run a repository write, turning any database failure into `PostWriteFailed(message)`."""
    try:
        written = write(*arguments)
    except Exception as error:
        log.exception("blog: %s", action_failed_message)
        raise PostWriteFailed(action_failed_message) from error
    return written


# --- staff use cases ---------------------------------------------------------------------------------


def list_posts_for_staff() -> list[BlogPostListItem]:
    """Every post, draft or published, most recently edited first."""
    return [_list_item(row) for row in repository.list_posts_newest_first()]


def get_post_for_staff(post_id: str) -> BlogPostAdminDetail:
    """One post for the editor."""
    return _admin_detail(_existing_post(post_id))


def create_draft(admin_user_id: str, body: BlogPostCreateBody) -> BlogPostAdminDetail:
    """Start a new empty draft, slugged from `slug` if given, else from the title."""
    title = body.title.strip() or DEFAULT_TITLE
    requested_slug = body.slug.strip() if body.slug and body.slug.strip() else title
    values = {
        "slug": _unique_slug(requested_slug),
        "title": title,
        "subtitle": (body.subtitle.strip() if body.subtitle else None) or None,
        "body_json": NEW_POST_BODY,
        "body_html": "",
        "status": "draft",
        "author_admin_user_id": admin_user_id,
    }
    created = _write(CREATE_FAILED, repository.insert_post, values)
    if created is None:
        raise PostWriteFailed(CREATE_FAILED)
    _audit(admin_user_id, "blog.create", created.id, {"slug": created.slug})
    return _admin_detail(created)


def update_post(admin_user_id: str, post_id: str, body: BlogPostUpdateBody) -> BlogPostAdminDetail:
    """Apply an edit. Only the fields the editor sent change; the audit lists which ones."""
    fields = body.model_dump(exclude_unset=True)
    _existing_post(post_id)
    changes: dict[str, Any] = {"updated_at": _now(), **post_changes(fields)}
    if fields.get("slug"):
        changes["slug"] = _unique_slug(str(fields["slug"]).strip(), exclude_post_id=post_id)
    updated = _write(UPDATE_FAILED, repository.update_post, post_id, changes) or _existing_post(post_id)
    _audit(admin_user_id, "blog.update", post_id, {"fields": list(fields.keys())})
    return _admin_detail(updated)


def publish_post(admin_user_id: str, post_id: str) -> BlogPostAdminDetail:
    """Make a post public. Re-publishing keeps the original publication date."""
    existing = _existing_post(post_id)
    now = _now()
    changes = {"status": "published", "published_at": existing.published_at or now, "updated_at": now}
    _write(PUBLISH_FAILED, repository.update_post, post_id, changes)
    published = _existing_post(post_id)
    _audit(admin_user_id, "blog.publish", post_id, {"slug": published.slug})
    return _admin_detail(published)


def unpublish_post(admin_user_id: str, post_id: str) -> BlogPostAdminDetail:
    """Take a post back to draft (its publication date is kept for a later re-publish)."""
    _existing_post(post_id)
    _write(UNPUBLISH_FAILED, repository.update_post, post_id, {"status": "draft", "updated_at": _now()})
    unpublished = _existing_post(post_id)
    _audit(admin_user_id, "blog.unpublish", post_id, {"slug": unpublished.slug})
    return _admin_detail(unpublished)


def delete_post(admin_user_id: str, post_id: str) -> None:
    """Delete a post for good."""
    _existing_post(post_id)
    _write(DELETE_FAILED, repository.delete_post, post_id)
    _audit(admin_user_id, "blog.delete", post_id, {})


# --- public use cases --------------------------------------------------------------------------------


def list_published_posts(limit: int) -> list[BlogPostListItem]:
    """The public blog index, newest first."""
    return [_list_item(row) for row in repository.list_published_posts(limit)]


def get_published_post(slug: str) -> BlogPostPublicDetail:
    """A published post by slug; drafts and unknown slugs are `PostNotFound`."""
    trimmed_slug = (slug or "").strip()
    post = repository.find_published_post(trimmed_slug) if trimmed_slug else None
    if post is None:
        raise PostNotFound()
    return _public_detail(post)
