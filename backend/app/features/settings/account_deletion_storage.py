"""Remove user-owned objects from Supabase Storage."""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.core.db import get_db, get_supabase, rows_from_query_result
from app.core.logging import get_logger

logger = get_logger(__name__)


def _item_name(item: Any) -> str:
    if isinstance(item, dict):
        return str(item.get("name") or "")
    return str(getattr(item, "name", "") or "")


def _item_is_folder(item: Any) -> bool:
    if isinstance(item, dict):
        return item.get("id") is None and item.get("metadata") is None
    return False


def _collect_storage_paths(sb: Any, *, bucket: str, folder: str) -> list[str]:
    """List files under folder, recursing into subfolders."""
    try:
        items = sb.storage.from_(bucket).list(folder) or []
    except Exception:
        logger.warning("account_deletion: storage list failed path=%s", folder)
        return []
    paths: list[str] = []
    for item in items:
        name = _item_name(item)
        if not name or name in (".", ".."):
            continue
        child = f"{folder}/{name}"
        if _item_is_folder(item):
            paths.extend(_collect_storage_paths(sb, bucket=bucket, folder=child))
        else:
            paths.append(child)
    return paths


def delete_user_storage(user_id: str) -> None:
    if not user_id or "/" in user_id or user_id in (".", ".."):
        return
    bucket = get_settings().media_images_bucket.strip() or "eventtz-images"
    try:
        sb = get_supabase()
    except Exception:
        logger.warning("account_deletion: storage client failed user=%s", user_id)
        return
    prefix = f"users/{user_id}"
    paths = _collect_storage_paths(sb, bucket=bucket, folder=prefix)
    if not paths:
        return
    chunk = 100
    for i in range(0, len(paths), chunk):
        try:
            sb.storage.from_(bucket).remove(paths[i : i + chunk])
        except Exception:
            logger.warning(
                "account_deletion: storage remove failed user=%s chunk=%s",
                user_id,
                i // chunk,
            )


def delete_review_images(user_id: str) -> None:
    try:
        res = (
            get_db()
            .table("booking_reviews")
            .select("id,image_urls")
            .eq("client_user_id", user_id)
            .execute()
        )
    except Exception:
        logger.warning("account_deletion: list review images failed user=%s", user_id)
        return
    urls: list[str] = []
    review_ids: list[str] = []
    for row in rows_from_query_result(res):
        rid = str(row.get("id") or "")
        if rid:
            review_ids.append(rid)
        raw = row.get("image_urls") or []
        if isinstance(raw, list):
            urls.extend(str(u) for u in raw if u)
    bucket = get_settings().media_images_bucket.strip() or "eventtz-images"
    marker = f"/object/public/{bucket}/"
    paths: list[str] = []
    storage_prefix = f"users/{user_id}/"
    for url in urls:
        if marker not in url:
            continue
        path = url.split(marker, 1)[-1].split("?", 1)[0]
        if path.startswith(storage_prefix):
            paths.append(path)
    if paths:
        try:
            get_supabase().storage.from_(bucket).remove(paths)
        except Exception:
            logger.warning("account_deletion: remove review images failed user=%s", user_id)
    for rid in review_ids:
        try:
            get_db().table("booking_reviews").update({"image_urls": []}).eq("id", rid).execute()
        except Exception:
            logger.warning("account_deletion: clear review image_urls failed id=%s", rid)
