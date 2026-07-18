"""Help Center DB reads."""

from __future__ import annotations

from typing import Any

from app.core.db import get_client
from app.core.logging import get_logger

logger = get_logger(__name__)

_CAT_COLS = "id,slug,title,description,icon_key,sort_order,audience,published"
_ART_LIST_COLS = (
    "id,category_id,slug,title,summary,audience,sort_order,published,related_slugs"
)
_ART_DETAIL_COLS = _ART_LIST_COLS + ",body_md"


def _audience_filter(audience: str) -> list[str]:
    # Admin docs are isolated (do not mix in client/vendor "both" articles).
    if audience == "admin":
        return ["admin"]
    return [audience, "both"]


def list_categories(*, audience: str) -> list[dict[str, Any]]:
    try:
        res = (
            get_client()
            .table("help_categories")
            .select(_CAT_COLS)
            .eq("published", True)
            .in_("audience", _audience_filter(audience))
            .order("sort_order")
            .execute()
        )
        rows = list(getattr(res, "data", None) or [])
    except Exception:
        logger.exception("help: list_categories failed audience=%s", audience)
        return []

    # Attach article counts
    try:
        art = (
            get_client()
            .table("help_articles")
            .select("id,category_id")
            .eq("published", True)
            .in_("audience", _audience_filter(audience))
            .execute()
        )
        arts = list(getattr(art, "data", None) or [])
    except Exception:
        arts = []
    counts: dict[str, int] = {}
    for a in arts:
        cid = str(a.get("category_id") or "")
        if cid:
            counts[cid] = counts.get(cid, 0) + 1
    for row in rows:
        row["article_count"] = counts.get(str(row.get("id") or ""), 0)
        row["id"] = str(row.get("id") or "")
    return rows


def list_articles(
    *,
    audience: str,
    category_slug: str | None = None,
) -> list[dict[str, Any]]:
    category_id: str | None = None
    cat_title: str | None = None
    cat_slug: str | None = None
    if category_slug:
        try:
            cres = (
                get_client()
                .table("help_categories")
                .select("id,slug,title")
                .eq("slug", category_slug)
                .eq("published", True)
                .limit(1)
                .execute()
            )
            crow = (getattr(cres, "data", None) or [None])[0]
            if not crow:
                return []
            category_id = str(crow["id"])
            cat_title = str(crow.get("title") or "")
            cat_slug = str(crow.get("slug") or "")
        except Exception:
            logger.exception("help: category lookup failed slug=%s", category_slug)
            return []

    try:
        q = (
            get_client()
            .table("help_articles")
            .select(_ART_LIST_COLS)
            .eq("published", True)
            .in_("audience", _audience_filter(audience))
        )
        if category_id:
            q = q.eq("category_id", category_id)
        res = q.order("sort_order").execute()
        rows = list(getattr(res, "data", None) or [])
    except Exception:
        logger.exception("help: list_articles failed audience=%s", audience)
        return []

    # Enrich with category titles when listing all
    cat_map: dict[str, dict[str, str]] = {}
    if not category_id:
        try:
            cres = (
                get_client()
                .table("help_categories")
                .select("id,slug,title")
                .eq("published", True)
                .execute()
            )
            for c in getattr(cres, "data", None) or []:
                cat_map[str(c["id"])] = {
                    "slug": str(c.get("slug") or ""),
                    "title": str(c.get("title") or ""),
                }
        except Exception:
            pass

    out: list[dict[str, Any]] = []
    for row in rows:
        cid = str(row.get("category_id") or "")
        meta = cat_map.get(cid, {})
        out.append(
            {
                **row,
                "id": str(row.get("id") or ""),
                "category_id": cid,
                "category_slug": cat_slug or meta.get("slug"),
                "category_title": cat_title or meta.get("title"),
                "related_slugs": list(row.get("related_slugs") or []),
            },
        )
    return out


def get_article_by_slug(*, slug: str, audience: str) -> dict[str, Any] | None:
    try:
        res = (
            get_client()
            .table("help_articles")
            .select(_ART_DETAIL_COLS)
            .eq("slug", slug)
            .eq("published", True)
            .in_("audience", _audience_filter(audience))
            .limit(1)
            .execute()
        )
        rows = getattr(res, "data", None) or []
        row = rows[0] if rows else None
    except Exception:
        logger.exception("help: get_article failed slug=%s", slug)
        return None
    if not row:
        return None

    cat_slug = None
    cat_title = None
    try:
        cres = (
            get_client()
            .table("help_categories")
            .select("slug,title")
            .eq("id", row["category_id"])
            .limit(1)
            .execute()
        )
        crow = (getattr(cres, "data", None) or [None])[0]
        if crow:
            cat_slug = str(crow.get("slug") or "")
            cat_title = str(crow.get("title") or "")
    except Exception:
        pass

    return {
        **row,
        "id": str(row.get("id") or ""),
        "category_id": str(row.get("category_id") or ""),
        "category_slug": cat_slug,
        "category_title": cat_title,
        "related_slugs": list(row.get("related_slugs") or []),
        "body_md": str(row.get("body_md") or ""),
    }


def list_all_published_for_audience(*, audience: str) -> list[dict[str, Any]]:
    """Full published set for retrieval (title, summary, body excerpt)."""
    try:
        res = (
            get_client()
            .table("help_articles")
            .select("slug,title,summary,body_md,audience,related_slugs")
            .eq("published", True)
            .in_("audience", _audience_filter(audience))
            .execute()
        )
        rows = list(getattr(res, "data", None) or [])
    except Exception:
        logger.exception("help: list_all_published failed audience=%s", audience)
        return []
    for row in rows:
        row["related_slugs"] = list(row.get("related_slugs") or [])
    return rows
