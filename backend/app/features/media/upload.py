from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.errors import ForbiddenError, PayloadTooLargeError, ServiceUnavailableError, ValidationError
from app.core.db import get_supabase

logger = get_logger(__name__)


@dataclass(frozen=True)
class UploadedImage:
    bucket: str
    path: str
    public_url: str


def _public_object_url(*, supabase_url: str, bucket: str, path: str) -> str:
    base = supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/public/{bucket}/{path}"


async def _upload_user_object(
    *,
    user_id: str,
    file: UploadFile,
    subdir: str,
    allowed_prefixes: tuple[str, ...],
    max_bytes: int | None,
    error_hint: str,
) -> UploadedImage:
    if not user_id:
        raise ForbiddenError("Not authenticated.")

    content_type = (file.content_type or "").strip().lower()
    if not any(content_type.startswith(p) for p in allowed_prefixes):
        raise ValidationError(error_hint)

    settings = get_settings()
    bucket = settings.media_images_bucket.strip() or "eventtz-images"

    raw = await file.read()
    if not raw:
        raise ValidationError("Empty upload.")
    if max_bytes is not None and len(raw) > max_bytes:
        mb = max(1, round(max_bytes / 1_000_000))
        raise PayloadTooLargeError(f"File is too large (max {mb}MB).")

    name = (file.filename or "upload").strip()
    ext = ""
    if "." in name:
        ext = "." + name.rsplit(".", 1)[-1].lower()[:10]

    object_path = f"users/{user_id}/{subdir}/{uuid4().hex}{ext}"

    sb = get_supabase()
    try:
        sb.storage.from_(bucket).upload(
            object_path,
            raw,
            file_options={
                "content-type": content_type,
                "cache-control": "3600",
                "upsert": "false",
            },
        )
    except Exception as e:
        logger.exception(
            "storage upload failed bucket=%s path=%s content_type=%s size=%s",
            bucket,
            object_path,
            content_type,
            len(raw),
        )
        raise ServiceUnavailableError("Could not upload file.") from e

    return UploadedImage(
        bucket=bucket,
        path=object_path,
        public_url=_public_object_url(
            supabase_url=settings.supabase_url,
            bucket=bucket,
            path=object_path,
        ),
    )


async def upload_user_image(*, user_id: str, file: UploadFile) -> UploadedImage:
    # No app-level size cap for images (infra/proxy limits may still apply).
    return await _upload_user_object(
        user_id=user_id,
        file=file,
        subdir="images",
        allowed_prefixes=("image/",),
        max_bytes=None,
        error_hint="Only image uploads are supported.",
    )


async def upload_user_file(*, user_id: str, file: UploadFile) -> UploadedImage:
    """Generalised upload for portfolio videos and profile documents/certificates."""
    settings = get_settings()
    return await _upload_user_object(
        user_id=user_id,
        file=file,
        subdir="files",
        allowed_prefixes=("image/", "video/", "application/pdf"),
        max_bytes=settings.media_max_file_upload_bytes,
        error_hint="Only image, PDF, or video uploads are supported.",
    )
