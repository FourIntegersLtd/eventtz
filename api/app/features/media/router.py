"""Upload routes: parse the multipart file, call one service, return where it was stored."""

from __future__ import annotations

from fastapi import APIRouter, UploadFile

from app.core.auth import AUTH_ERRORS, CurrentUser
from app.core.errors import error_responses
from app.core.ports import StorageDependency
from app.features.media import service
from app.features.media.errors import FileEmpty, FileTooLarge, FileTypeUnsupported, ImageOnly, UploadFailed
from app.features.media.schemas import CreateUploadUrlBody, ImageUploadResponse, PresignedUploadResponse

router = APIRouter(prefix="/media", tags=["media"])


@router.post(
    "/upload-urls",
    response_model=PresignedUploadResponse,
    responses=error_responses(
        *AUTH_ERRORS,
        ImageOnly,
        FileTypeUnsupported,
        FileEmpty,
        FileTooLarge,
        UploadFailed,
    ),
)
async def create_upload_url(
    principal: CurrentUser, body: CreateUploadUrlBody, storage: StorageDependency
) -> PresignedUploadResponse:
    """Mint a presigned S3 POST so the browser uploads file bytes without proxying through the web app."""
    return await service.create_upload_url(principal, body, storage)


@router.post(
    "/images",
    response_model=ImageUploadResponse,
    responses=error_responses(*AUTH_ERRORS, ImageOnly, FileEmpty, UploadFailed),
)
async def upload_image(
    principal: CurrentUser, file: UploadFile, storage: StorageDependency
) -> ImageUploadResponse:
    """Upload a photo (any size) for use anywhere in the app."""
    return await service.upload_image(principal, file, storage)


@router.post(
    "/files",
    response_model=ImageUploadResponse,
    responses=error_responses(*AUTH_ERRORS, FileTypeUnsupported, FileEmpty, FileTooLarge, UploadFailed),
)
async def upload_file(
    principal: CurrentUser, file: UploadFile, storage: StorageDependency
) -> ImageUploadResponse:
    """Upload an image, portfolio video or certificate PDF (up to the configured size limit)."""
    return await service.upload_file(principal, file, storage)
