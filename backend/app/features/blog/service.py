"""Blog posts: create, edit, publish, and public listing."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.core.db import apply_recent_first_order, get_db
from app.core.errors import NotFoundError, ServiceUnavailableError
from app.core.logging import get_logger
from app.features.blog import messages as blog_messages
from app.features.blog.sanitize import sanitize_blog_html

logger = get_logger(__name__)

_SLUG_RE = re.compile(r"[^a-z0-9]+")

_LIST_COLS = (
    "id,slug,title,subtitle,cover_image_url,excerpt,author_name,"
    "status,published_at,created_at,updated_at"
)
_LIST_COLS_LEGACY = (
    "id,slug,title,subtitle,cover_image_url,excerpt,"
    "status,published_at,created_at,updated_at"
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _str_id(v: Any) -> str:
    return str(v) if v is not None else ""


def slugify(title: str) -> str:
    base = _SLUG_RE.sub("-", (title or "").strip().lower()).strip("-")
    return (base or "post")[:180]


def _row_to_list_item(row: dict[str, Any]) -> dict[str, Any]:
    author = row.get("author_name")
    author_s = str(author).strip() if isinstance(author, str) and author.strip() else None
    return {
        "id": _str_id(row.get("id")),
        "slug": str(row.get("slug") or ""),
        "title": str(row.get("title") or ""),
        "subtitle": row.get("subtitle"),
        "cover_image_url": row.get("cover_image_url"),
        "excerpt": row.get("excerpt"),
        "author_name": author_s,
        "status": str(row.get("status") or "draft"),
        "published_at": row.get("published_at"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _row_to_admin_detail(row: dict[str, Any]) -> dict[str, Any]:
    body_json = row.get("body_json")
    if not isinstance(body_json, dict):
        body_json = {}
    out = _row_to_list_item(row)
    out["body_json"] = body_json
    out["body_html"] = str(row.get("body_html") or "")
    out["author_admin_user_id"] = _str_id(row.get("author_admin_user_id")) or None
    return out


def _row_to_public_detail(row: dict[str, Any]) -> dict[str, Any]:
    out = _row_to_list_item(row)
    out["body_html"] = str(row.get("body_html") or "")
    return out


def _unique_slug(desired: str, *, exclude_id: str | None = None) -> str:
    base = slugify(desired)
    candidate = base
    n = 2
    while True:
        try:
            res = (
                get_db()
                .table("blog_posts")
                .select("id")
                .eq("slug", candidate)
                .limit(1)
                .execute()
            )
            rows = getattr(res, "data", None) or []
            if not rows:
                return candidate
            if exclude_id and isinstance(rows[0], dict) and _str_id(rows[0].get("id")) == exclude_id:
                return candidate
        except Exception:
            logger.exception("blog: slug check failed")
            return f"{base}-{uuid4().hex[:8]}"
        candidate = f"{base}-{n}"
        n += 1
        if n > 50:
            return f"{base}-{uuid4().hex[:8]}"


def create_draft_post(
    *,
    author_admin_user_id: str,
    title: str = "Untitled",
    subtitle: str | None = None,
    slug: str | None = None,
) -> dict[str, Any]:
    title_s = (title or "Untitled").strip() or "Untitled"
    slug_s = _unique_slug(slug.strip() if slug and slug.strip() else title_s)
    now = _now_iso()
    row = {
        "id": str(uuid4()),
        "slug": slug_s,
        "title": title_s,
        "subtitle": (subtitle.strip() if subtitle else None) or None,
        "cover_image_url": None,
        "body_json": {"type": "doc", "content": [{"type": "paragraph"}]},
        "body_html": "",
        "excerpt": None,
        "status": "draft",
        "author_admin_user_id": author_admin_user_id,
        "author_name": None,
        "published_at": None,
        "created_at": now,
        "updated_at": now,
    }
    try:
        ins = (
            get_db()
            .table("blog_posts")
            .insert(
                {
                    "slug": row["slug"],
                    "title": row["title"],
                    "subtitle": row["subtitle"],
                    "body_json": row["body_json"],
                    "body_html": "",
                    "status": "draft",
                    "author_admin_user_id": author_admin_user_id,
                },
            )
            .execute()
        )
    except Exception as e:
        logger.exception("blog: create draft failed")
        raise ServiceUnavailableError(blog_messages.CREATE_POST_FAILED) from e
    data = getattr(ins, "data", None) or []
    if not data or not isinstance(data[0], dict):
        raise ServiceUnavailableError(blog_messages.CREATE_POST_FAILED)
    return _row_to_admin_detail(data[0])


def list_posts_for_admin() -> list[dict[str, Any]]:
    try:
        try:
            res = (
                apply_recent_first_order(
                    get_db().table("blog_posts").select(_LIST_COLS),
                    column="updated_at",
                )
                .limit(500)
                .execute()
            )
        except Exception as e:
            err = str(e).lower()
            if "author_name" not in err and "42703" not in err:
                raise
            res = (
                apply_recent_first_order(
                    get_db().table("blog_posts").select(_LIST_COLS_LEGACY),
                    column="updated_at",
                )
                .limit(500)
                .execute()
            )
    except Exception:
        logger.exception("blog: list admin failed")
        return []
    return [_row_to_list_item(r) for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]


def get_post_for_admin(post_id: str) -> dict[str, Any] | None:
    try:
        res = (
            get_db()
            .table("blog_posts")
            .select("*")
            .eq("id", post_id)
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("blog: get admin failed")
        return None
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        return None
    return _row_to_admin_detail(data[0])


def update_post(post_id: str, fields: dict[str, Any]) -> dict[str, Any]:
    existing = get_post_for_admin(post_id)
    if not existing:
        raise NotFoundError(blog_messages.POST_NOT_FOUND)

    patch: dict[str, Any] = {"updated_at": _now_iso()}
    if "title" in fields and fields["title"] is not None:
        patch["title"] = str(fields["title"]).strip() or "Untitled"
    if "subtitle" in fields:
        sub = fields["subtitle"]
        patch["subtitle"] = str(sub).strip() if isinstance(sub, str) and sub.strip() else None
    if "cover_image_url" in fields:
        url = fields["cover_image_url"]
        patch["cover_image_url"] = str(url).strip() if isinstance(url, str) and url.strip() else None
    if "excerpt" in fields:
        ex = fields["excerpt"]
        patch["excerpt"] = str(ex).strip() if isinstance(ex, str) and ex.strip() else None
    if "author_name" in fields:
        name = fields["author_name"]
        patch["author_name"] = (
            str(name).strip()[:120] if isinstance(name, str) and name.strip() else None
        )
    if "slug" in fields and fields["slug"]:
        patch["slug"] = _unique_slug(str(fields["slug"]).strip(), exclude_id=post_id)
    if "body_json" in fields and fields["body_json"] is not None:
        patch["body_json"] = fields["body_json"]
    if "body_html" in fields and fields["body_html"] is not None:
        patch["body_html"] = sanitize_blog_html(str(fields["body_html"]))

    try:
        res = (
            get_db()
            .table("blog_posts")
            .update(patch)
            .eq("id", post_id)
            .execute()
        )
    except Exception as e:
        logger.exception("blog: update failed")
        raise ServiceUnavailableError(blog_messages.UPDATE_POST_FAILED) from e
    data = getattr(res, "data", None) or []
    if data and isinstance(data[0], dict):
        return _row_to_admin_detail(data[0])
    updated = get_post_for_admin(post_id)
    if not updated:
        raise NotFoundError(blog_messages.POST_NOT_FOUND)
    return updated


def publish_post(post_id: str) -> dict[str, Any]:
    existing = get_post_for_admin(post_id)
    if not existing:
        raise NotFoundError(blog_messages.POST_NOT_FOUND)
    now = _now_iso()
    patch = {
        "status": "published",
        "published_at": existing.get("published_at") or now,
        "updated_at": now,
    }
    try:
        get_db().table("blog_posts").update(patch).eq("id", post_id).execute()
    except Exception as e:
        logger.exception("blog: publish failed")
        raise ServiceUnavailableError(blog_messages.PUBLISH_POST_FAILED) from e
    out = get_post_for_admin(post_id)
    if not out:
        raise NotFoundError(blog_messages.POST_NOT_FOUND)
    return out


def unpublish_post(post_id: str) -> dict[str, Any]:
    existing = get_post_for_admin(post_id)
    if not existing:
        raise NotFoundError(blog_messages.POST_NOT_FOUND)
    patch = {"status": "draft", "updated_at": _now_iso()}
    try:
        get_db().table("blog_posts").update(patch).eq("id", post_id).execute()
    except Exception as e:
        logger.exception("blog: unpublish failed")
        raise ServiceUnavailableError(blog_messages.UNPUBLISH_POST_FAILED) from e
    out = get_post_for_admin(post_id)
    if not out:
        raise NotFoundError(blog_messages.POST_NOT_FOUND)
    return out


def delete_post(post_id: str) -> None:
    existing = get_post_for_admin(post_id)
    if not existing:
        raise NotFoundError(blog_messages.POST_NOT_FOUND)
    try:
        get_db().table("blog_posts").delete().eq("id", post_id).execute()
    except Exception as e:
        logger.exception("blog: delete failed")
        raise ServiceUnavailableError(blog_messages.DELETE_POST_FAILED) from e


def list_published_posts(*, limit: int = 50) -> list[dict[str, Any]]:
    lim = max(1, min(limit, 100))
    try:
        try:
            res = (
                get_db()
                .table("blog_posts")
                .select(_LIST_COLS)
                .eq("status", "published")
                .order("published_at", desc=True)
                .limit(lim)
                .execute()
            )
        except Exception as e:
            err = str(e).lower()
            if "author_name" not in err and "42703" not in err:
                raise
            res = (
                get_db()
                .table("blog_posts")
                .select(_LIST_COLS_LEGACY)
                .eq("status", "published")
                .order("published_at", desc=True)
                .limit(lim)
                .execute()
            )
    except Exception:
        logger.exception("blog: list public failed")
        return []
    return [_row_to_list_item(r) for r in (getattr(res, "data", None) or []) if isinstance(r, dict)]


def get_published_post_by_slug(slug: str) -> dict[str, Any] | None:
    s = (slug or "").strip()
    if not s:
        return None
    try:
        res = (
            get_db()
            .table("blog_posts")
            .select("*")
            .eq("slug", s)
            .eq("status", "published")
            .limit(1)
            .execute()
        )
    except Exception:
        logger.exception("blog: get by slug failed")
        return None
    data = getattr(res, "data", None) or []
    if not data or not isinstance(data[0], dict):
        return None
    return _row_to_public_detail(data[0])
