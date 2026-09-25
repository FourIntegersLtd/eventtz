"""Upload routes: parse the multipart file, call one service, return where it was stored."""

from __future__ import annotations

from fastapi import APIRouter, UploadFile

from app.core.auth import AUTH_ERRORS, CurrentUser
from app.core.errors import error_responses
from app.core.ports import StorageDependency
from app.features.media import service
from app.features.media.errors import FileEmpty, FileTooLarge, FileTypeUnsupported, ImageOnly, UploadFailed
from app.features.media.schemas import ImageUploadResponse

router = APIRouter(prefix="/media", tags=["media"])


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
