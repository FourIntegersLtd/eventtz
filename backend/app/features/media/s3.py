"""Public S3 uploads for user media (OSCE Guide aws_utils pattern, lazy client)."""

from __future__ import annotations

from io import BytesIO
from typing import Any
from urllib.parse import quote, unquote, urlparse

import boto3

from app.core.config import get_settings
from app.core.errors import ServiceUnavailableError
from app.core.logging import get_logger
from app.features.media import messages as media_messages

logger = get_logger(__name__)

_DELETE_CHUNK = 1000


def s3_configured() -> bool:
    settings = get_settings()
    return bool(
        settings.aws_access_key.strip()
        and settings.aws_secret_access_key.strip()
        and settings.aws_s3_bucket_name.strip()
        and settings.aws_region.strip()
    )


def s3_public_host() -> str:
    settings = get_settings()
    bucket = settings.aws_s3_bucket_name.strip()
    region = settings.aws_region.strip()
    return f"{bucket}.s3.{region}.amazonaws.com"


def public_object_url(key: str) -> str:
    encoded = quote(key.lstrip("/"), safe="/")
    return f"https://{s3_public_host()}/{encoded}"


def is_our_s3_url(url: str) -> bool:
    parsed = urlparse(url.strip())
    host = (parsed.netloc or "").lower()
    return host == s3_public_host().lower()


def object_key_from_public_url(url: str) -> str | None:
    if not is_our_s3_url(url):
        return None
    parsed = urlparse(url.strip())
    key = unquote((parsed.path or "").lstrip("/"))
    return key or None


def get_s3_client() -> Any:
    if not s3_configured():
        raise ServiceUnavailableError(media_messages.UPLOAD_FAILED)
    settings = get_settings()
    return boto3.client(
        "s3",
        region_name=settings.aws_region.strip(),
        aws_access_key_id=settings.aws_access_key.strip(),
        aws_secret_access_key=settings.aws_secret_access_key.strip(),
    )


def upload_bytes(*, key: str, body: bytes, content_type: str) -> str:
    settings = get_settings()
    bucket = settings.aws_s3_bucket_name.strip()
    extra: dict[str, str] = {"CacheControl": "public, max-age=3600"}
    ctype = (content_type or "").strip()
    if ctype:
        extra["ContentType"] = ctype
    get_s3_client().upload_fileobj(BytesIO(body), bucket, key, ExtraArgs=extra)
    return public_object_url(key)


def delete_object_by_url(url: str) -> None:
    key = object_key_from_public_url(url)
    if not key or not s3_configured():
        return
    try:
        get_s3_client().delete_object(Bucket=get_settings().aws_s3_bucket_name.strip(), Key=key)
    except Exception:
        logger.warning("s3 delete_object failed key=%s", key)


def delete_prefix(prefix: str) -> None:
    if not prefix or not s3_configured():
        return
    settings = get_settings()
    bucket = settings.aws_s3_bucket_name.strip()
    client = get_s3_client()
    paginator = client.get_paginator("list_objects_v2")
    pending: list[dict[str, str]] = []
    try:
        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents") or []:
                key = str(obj.get("Key") or "")
                if not key:
                    continue
                pending.append({"Key": key})
                if len(pending) >= _DELETE_CHUNK:
                    client.delete_objects(Bucket=bucket, Delete={"Objects": pending, "Quiet": True})
                    pending = []
        if pending:
            client.delete_objects(Bucket=bucket, Delete={"Objects": pending, "Quiet": True})
    except Exception:
        logger.warning("s3 prefix delete failed prefix=%s", prefix)
