"""Request and response shapes for the media routes (names kept from the baseline contract)."""

from __future__ import annotations

from pydantic import BaseModel


class ImageUploadResponse(BaseModel):
    """Where an upload was stored. Both upload routes return this (the name predates `/files`)."""

    bucket: str
    path: str
    public_url: str
