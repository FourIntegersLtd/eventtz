"""Shared types returned after a successful image upload."""

from pydantic import BaseModel


class ImageUploadResponse(BaseModel):
    bucket: str
    path: str
    public_url: str

