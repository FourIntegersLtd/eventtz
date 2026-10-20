"""Request and response shapes for the media routes (names kept from the baseline contract)."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field


class ImageUploadResponse(BaseModel):
    """Where an upload was stored. Both upload routes return this (the name predates `/files`)."""

    bucket: str
    path: str
    public_url: str


class MediaUploadUrlKind(StrEnum):
    """Whether the browser will POST an image or a general file to S3."""

    image = "image"
    file = "file"


class CreateUploadUrlBody(BaseModel):
    """Metadata for minting a presigned POST before the client uploads bytes directly to S3."""

    kind: MediaUploadUrlKind
    filename: str = Field(min_length=1)
    content_type: str = Field(min_length=1)
    content_length: int = Field(ge=1)


class PresignedUploadResponse(ImageUploadResponse):
    """Stored-object location plus the short-lived POST target for the browser."""

    upload_url: str
    fields: dict[str, str]
