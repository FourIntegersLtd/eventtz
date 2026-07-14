"""Blog post CRUD, publish, and public listing."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from app.core.config import get_settings
from app.core.db import apply_recent_first_order, get_db as get_client
from app.core.errors import NotFoundError, ServiceUnavailableError
from app.core.logging import get_logger
from app.features.blog.sanitize import sanitize_blog_html

logger = get_logger(__name__)

_SLUG_RE = re.compile(r"[^a-z0-9]+")
_LOCAL_POSTS: dict[str, dict[str, Any]] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _str_id(v: Any) -> str:
    return str(v) if v is not None else ""


def slugify(title: str) -> str:
    base = _SLUG_RE.sub("-", (title or "").strip().lower()).strip("-")
    return (base or "post")[:180]


def _row_to_list_item(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _str_id(row.get("id")),
        "slug": str(row.get("slug") or ""),
        "title": str(row.get("title") or ""),
        "subtitle": row.get("subtitle"),
        "cover_image_url": row.get("cover_image_url"),
        "excerpt": row.get("excerpt"),
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
        if get_settings().local_auth_mode:
            clash = any(
                p.get("slug") == candidate and p.get("id") != exclude_id
                for p in _LOCAL_POSTS.values()
            )
            if not clash:
                return candidate
        else:
            try:
                res = (
                    get_client()
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
        "published_at": None,
        "created_at": now,
        "updated_at": now,
    }
    if get_settings().local_auth_mode:
        _LOCAL_POSTS[row["id"]] = dict(row)
        return _row_to_admin_detail(row)

    try:
        ins = (
            get_client()
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
        raise ServiceUnavailableError("Could not create post.") from e
    data = getattr(ins, "data", None) or []
    if not data or not isinstance(data[0], dict):
        raise ServiceUnavailableError("Could not create post.")
    return _row_to_admin_detail(data[0])


def list_posts_for_admin() -> list[dict[str, Any]]:
    if get_settings().local_auth_mode:
        rows = sorted(
            _LOCAL_POSTS.values(),
            key=lambda r: str(r.get("updated_at") or ""),
            reverse=True,
        )
        return [_row_to_list_item(r) for r in rows]
    try:
        res = (
            apply_recent_first_order(
                get_client().table("blog_posts").select(
                    "id,slug,title,subtitle,cover_image_url,excerpt,status,published_at,created_at,updated_at",
                ),
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
    if get_settings().local_auth_mode:
        row = _LOCAL_POSTS.get(post_id)
        return _row_to_admin_detail(row) if row else None
    try:
        res = (
            get_client()
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
        raise NotFoundError("Post not found.")

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
    if "slug" in fields and fields["slug"]:
        patch["slug"] = _unique_slug(str(fields["slug"]).strip(), exclude_id=post_id)
    if "body_json" in fields and fields["body_json"] is not None:
        patch["body_json"] = fields["body_json"]
    if "body_html" in fields and fields["body_html"] is not None:
        patch["body_html"] = sanitize_blog_html(str(fields["body_html"]))

    if get_settings().local_auth_mode:
        row = _LOCAL_POSTS[post_id]
        row.update(patch)
        _LOCAL_POSTS[post_id] = row
        return _row_to_admin_detail(row)

    try:
        res = (
            get_client()
            .table("blog_posts")
            .update(patch)
            .eq("id", post_id)
            .execute()
        )
    except Exception as e:
        logger.exception("blog: update failed")
        raise ServiceUnavailableError("Could not update post.") from e
    data = getattr(res, "data", None) or []
    if data and isinstance(data[0], dict):
        return _row_to_admin_detail(data[0])
    updated = get_post_for_admin(post_id)
    if not updated:
        raise NotFoundError("Post not found.")
    return updated


def publish_post(post_id: str) -> dict[str, Any]:
    existing = get_post_for_admin(post_id)
    if not existing:
        raise NotFoundError("Post not found.")
    now = _now_iso()
    patch = {
        "status": "published",
        "published_at": existing.get("published_at") or now,
        "updated_at": now,
    }
    if get_settings().local_auth_mode:
        row = _LOCAL_POSTS[post_id]
        row.update(patch)
        return _row_to_admin_detail(row)
    try:
        get_client().table("blog_posts").update(patch).eq("id", post_id).execute()
    except Exception as e:
        logger.exception("blog: publish failed")
        raise ServiceUnavailableError("Could not publish post.") from e
    out = get_post_for_admin(post_id)
    if not out:
        raise NotFoundError("Post not found.")
    return out


def unpublish_post(post_id: str) -> dict[str, Any]:
    existing = get_post_for_admin(post_id)
    if not existing:
        raise NotFoundError("Post not found.")
    patch = {"status": "draft", "updated_at": _now_iso()}
    if get_settings().local_auth_mode:
        row = _LOCAL_POSTS[post_id]
        row.update(patch)
        return _row_to_admin_detail(row)
    try:
        get_client().table("blog_posts").update(patch).eq("id", post_id).execute()
    except Exception as e:
        logger.exception("blog: unpublish failed")
        raise ServiceUnavailableError("Could not unpublish post.") from e
    out = get_post_for_admin(post_id)
    if not out:
        raise NotFoundError("Post not found.")
    return out


def delete_post(post_id: str) -> None:
    existing = get_post_for_admin(post_id)
    if not existing:
        raise NotFoundError("Post not found.")
    if get_settings().local_auth_mode:
        _LOCAL_POSTS.pop(post_id, None)
        return
    try:
        get_client().table("blog_posts").delete().eq("id", post_id).execute()
    except Exception as e:
        logger.exception("blog: delete failed")
        raise ServiceUnavailableError("Could not delete post.") from e


def list_published_posts(*, limit: int = 50) -> list[dict[str, Any]]:
    lim = max(1, min(limit, 100))
    if get_settings().local_auth_mode:
        rows = [r for r in _LOCAL_POSTS.values() if r.get("status") == "published"]
        rows.sort(key=lambda r: str(r.get("published_at") or ""), reverse=True)
        return [_row_to_list_item(r) for r in rows[:lim]]
    try:
        res = (
            get_client()
            .table("blog_posts")
            .select(
                "id,slug,title,subtitle,cover_image_url,excerpt,status,published_at,created_at,updated_at",
            )
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
    if get_settings().local_auth_mode:
        for r in _LOCAL_POSTS.values():
            if r.get("slug") == s and r.get("status") == "published":
                return _row_to_public_detail(r)
        return None
    try:
        res = (
            get_client()
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


def clear_local_posts_for_tests() -> None:
    _LOCAL_POSTS.clear()
