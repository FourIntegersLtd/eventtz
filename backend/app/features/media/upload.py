"""Save uploaded images and files to S3 and return a public link."""

from __future__ import annotations

import re
from dataclasses import dataclass
from uuid import uuid4

from fastapi import UploadFile

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.errors import ForbiddenError, PayloadTooLargeError, ServiceUnavailableError, ValidationError
from app.features.media import messages as media_messages
from app.features.media.s3 import s3_configured, upload_bytes

logger = get_logger(__name__)

_IMAGE_EXT = re.compile(r"\.(avif|gif|heic|heif|jpe?g|png|webp)$", re.I)


def _looks_like_image_filename(filename: str) -> bool:
    return bool(_IMAGE_EXT.search((filename or "").strip()))


def _image_content_type_allowed(content_type: str, filename: str) -> bool:
    if content_type.startswith("image/"):
        return True
    if content_type in ("", "application/octet-stream") and _looks_like_image_filename(filename):
        return True
    return False


@dataclass(frozen=True)
class UploadedImage:
    bucket: str
    path: str
    public_url: str


async def _upload_user_object(
    *,
    user_id: str,
    file: UploadFile,
    subdir: str,
    allowed_prefixes: tuple[str, ...],
    max_bytes: int | None,
    error_hint: str,
    content_type_override: str | None = None,
) -> UploadedImage:
    if not user_id:
        raise ForbiddenError(media_messages.SIGN_IN_TO_UPLOAD)

    content_type = (content_type_override or file.content_type or "").strip().lower()
    if not any(content_type.startswith(p) for p in allowed_prefixes):
        raise ValidationError(error_hint)

    if not s3_configured():
        raise ServiceUnavailableError(media_messages.UPLOAD_FAILED)

    settings = get_settings()
    bucket = settings.aws_s3_bucket_name.strip() or "eventtz"

    raw = await file.read()
    if not raw:
        raise ValidationError(media_messages.FILE_EMPTY)
    if max_bytes is not None and len(raw) > max_bytes:
        mb = max(1, round(max_bytes / 1_000_000))
        raise PayloadTooLargeError(media_messages.file_too_large_detail(mb))

    name = (file.filename or "upload").strip()
    ext = ""
    if "." in name:
        ext = "." + name.rsplit(".", 1)[-1].lower()[:10]

    object_path = f"users/{user_id}/{subdir}/{uuid4().hex}{ext}"

    try:
        public_url = upload_bytes(key=object_path, body=raw, content_type=content_type)
    except ServiceUnavailableError:
        raise
    except Exception as e:
        logger.exception(
            "storage upload failed bucket=%s path=%s content_type=%s size=%s",
            bucket,
            object_path,
            content_type,
            len(raw),
        )
        raise ServiceUnavailableError(media_messages.UPLOAD_FAILED) from e

    return UploadedImage(
        bucket=bucket,
        path=object_path,
        public_url=public_url,
    )


def _guess_image_content_type(filename: str) -> str:
    lower = (filename or "").strip().lower()
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".gif"):
        return "image/gif"
    if lower.endswith(".heic"):
        return "image/heic"
    if lower.endswith(".heif"):
        return "image/heif"
    if lower.endswith(".avif"):
        return "image/avif"
    return "image/jpeg"


async def upload_user_image(*, user_id: str, file: UploadFile) -> UploadedImage:
    # No app-level size cap for images (infra/proxy limits may still apply).
    content_type = (file.content_type or "").strip().lower()
    filename = (file.filename or "").strip()
    if not _image_content_type_allowed(content_type, filename):
        raise ValidationError(media_messages.IMAGE_ONLY)
    content_type_override = (
        _guess_image_content_type(filename) if not content_type.startswith("image/") else None
    )
    return await _upload_user_object(
        user_id=user_id,
        file=file,
        subdir="images",
        allowed_prefixes=("image/",),
        max_bytes=None,
        error_hint=media_messages.IMAGE_ONLY,
        content_type_override=content_type_override,
    )


async def upload_user_file(*, user_id: str, file: UploadFile) -> UploadedImage:
    """General upload for portfolio videos and profile documents or certificates."""
    settings = get_settings()
    return await _upload_user_object(
        user_id=user_id,
        file=file,
        subdir="files",
        allowed_prefixes=("image/", "video/", "application/pdf"),
        max_bytes=settings.media_max_file_upload_bytes,
        error_hint=media_messages.FILE_TYPE_UNSUPPORTED,
    )
