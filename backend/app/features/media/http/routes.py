"""HTTP routes for uploading images and other media while signed in."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, UploadFile

from app.features.auth.http.dependencies import get_current_user_dep
from app.contracts.media import ImageUploadResponse
from app.features.media.upload import upload_user_file, upload_user_image

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/images", response_model=ImageUploadResponse)
async def upload_image(
    file: UploadFile,
    user: Annotated[dict[str, Any], Depends(get_current_user_dep)],
) -> ImageUploadResponse:
    uploaded = await upload_user_image(user_id=str(user.get("id") or ""), file=file)
    return ImageUploadResponse(
        bucket=uploaded.bucket,
        path=uploaded.path,
        public_url=uploaded.public_url,
    )


@router.post("/files", response_model=ImageUploadResponse)
async def upload_file(
    file: UploadFile,
    user: Annotated[dict[str, Any], Depends(get_current_user_dep)],
) -> ImageUploadResponse:
    """Accepts images, PDFs, and videos — for portfolio video and profile
    certificates (food hygiene, indemnity/insurance) where image-only checks
    would be too strict."""
    uploaded = await upload_user_file(user_id=str(user.get("id") or ""), file=file)
    return ImageUploadResponse(
        bucket=uploaded.bucket,
        path=uploaded.path,
        public_url=uploaded.public_url,
    )

