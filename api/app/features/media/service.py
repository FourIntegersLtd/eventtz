"""Media use cases: check an upload against its route's rules, then store it under the user's folder."""

from __future__ import annotations

import asyncio
from uuid import uuid4

from app.core.auth import Principal
from app.core.errors import AppError
from app.core.logging import get_logger
from app.core.ports import Storage
from app.core.settings import get_settings
from app.features.media.domain import (
    FILES_FOLDER,
    IMAGES_FOLDER,
    IncomingFile,
    general_file_allowed,
    image_allowed,
    normalise_content_type,
    object_key,
    size_limit_in_megabytes,
    stored_image_type,
)
from app.features.media.errors import FileEmpty, FileTooLarge, FileTypeUnsupported, ImageOnly, UploadFailed
from app.features.media.schemas import (
    CreateUploadUrlBody,
    ImageUploadResponse,
    MediaUploadUrlKind,
    PresignedUploadResponse,
)

log = get_logger(__name__)


async def upload_image(principal: Principal, upload: IncomingFile, storage: Storage) -> ImageUploadResponse:
    """Store a photo. Untyped files with an image name are accepted and typed from the name."""
    content_type = normalise_content_type(upload.content_type)
    if not image_allowed(content_type, upload.filename):
        raise ImageOnly()
    return await _store(
        principal,
        upload,
        storage,
        folder=IMAGES_FOLDER,
        content_type=stored_image_type(content_type, upload.filename),
        max_bytes=None,
    )


async def create_upload_url(
    principal: Principal, body: CreateUploadUrlBody, storage: Storage
) -> PresignedUploadResponse:
    """Validate upload metadata, then mint a presigned POST so the browser sends bytes straight to S3."""
    if not storage.is_configured():
        raise UploadFailed()
    if body.content_length < 1:
        raise FileEmpty()
    content_type = normalise_content_type(body.content_type)
    settings = get_settings()
    if body.kind == MediaUploadUrlKind.image:
        if not image_allowed(content_type, body.filename):
            raise ImageOnly()
        folder = IMAGES_FOLDER
        stored_type = stored_image_type(content_type, body.filename)
        max_bytes = settings.media_max_image_upload_bytes
    else:
        if not general_file_allowed(content_type):
            raise FileTypeUnsupported()
        folder = FILES_FOLDER
        stored_type = content_type
        max_bytes = settings.media_max_file_upload_bytes
    if body.content_length > max_bytes:
        raise FileTooLarge.over_limit(size_limit_in_megabytes(max_bytes))
    key = object_key(user_id=principal.id, folder=folder, unique_token=uuid4().hex, filename=body.filename)
    try:
        presigned = await asyncio.to_thread(
            storage.presigned_post,
            key=key,
            content_type=stored_type,
            max_bytes=max_bytes,
        )
    except AppError:
        raise
    except Exception as error:
        log.exception("presign failed key=%s content_type=%s", key, stored_type)
        raise UploadFailed() from error
    return PresignedUploadResponse(
        bucket=presigned.bucket,
        path=presigned.key,
        public_url=presigned.public_url,
        upload_url=presigned.upload_url,
        fields=presigned.fields,
    )


async def upload_file(principal: Principal, upload: IncomingFile, storage: Storage) -> ImageUploadResponse:
    """Store an image, video or PDF (portfolio videos, certificates), up to the size limit."""
    content_type = normalise_content_type(upload.content_type)
    if not general_file_allowed(content_type):
        raise FileTypeUnsupported()
    return await _store(
        principal,
        upload,
        storage,
        folder=FILES_FOLDER,
        content_type=content_type,
        max_bytes=get_settings().media_max_file_upload_bytes,
    )


async def _store(
    principal: Principal,
    upload: IncomingFile,
    storage: Storage,
    *,
    folder: str,
    content_type: str,
    max_bytes: int | None,
) -> ImageUploadResponse:
    """Check storage is on, read and size-check the body, then save it under a fresh key.

    Storage is checked before the body is read, so a switched-off bucket never
    reads a large upload. The blocking storage call runs on a worker thread.
    """
    if not storage.is_configured():
        raise UploadFailed()
    body = await upload.read()
    if not body:
        raise FileEmpty()
    if max_bytes is not None and len(body) > max_bytes:
        raise FileTooLarge.over_limit(size_limit_in_megabytes(max_bytes))
    key = object_key(user_id=principal.id, folder=folder, unique_token=uuid4().hex, filename=upload.filename)
    try:
        stored = await asyncio.to_thread(storage.save, key=key, body=body, content_type=content_type)
    except AppError:
        raise
    except Exception as error:
        log.exception("upload failed key=%s content_type=%s size=%s", key, content_type, len(body))
        raise UploadFailed() from error
    return ImageUploadResponse(bucket=stored.bucket, path=stored.key, public_url=stored.public_url)
