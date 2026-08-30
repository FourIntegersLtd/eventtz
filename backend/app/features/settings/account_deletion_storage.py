"""Remove user-owned objects from S3."""

from __future__ import annotations

from app.core.db import get_db, rows_from_query_result
from app.core.logging import get_logger
from app.features.media.s3 import delete_object_by_url, delete_prefix, is_our_s3_url

logger = get_logger(__name__)


def delete_user_storage(user_id: str) -> None:
    if not user_id or "/" in user_id or user_id in (".", ".."):
        return
    delete_prefix(f"users/{user_id}/")


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
    for url in urls:
        if is_our_s3_url(url):
            delete_object_by_url(url)
    for rid in review_ids:
        try:
            get_db().table("booking_reviews").update({"image_urls": []}).eq("id", rid).execute()
        except Exception:
            logger.warning("account_deletion: clear review image_urls failed id=%s", rid)
