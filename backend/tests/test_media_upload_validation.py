"""Tests for media upload validation."""

from __future__ import annotations

from io import BytesIO

import pytest
from starlette.datastructures import UploadFile

from app.core.errors import ValidationError
from app.features.media import messages as media_messages
from app.features.media.upload import upload_user_image


@pytest.mark.asyncio
async def test_upload_user_image_rejects_pdf():
    upload = UploadFile(filename="doc.pdf", file=BytesIO(b"%PDF-"), headers={"content-type": "application/pdf"})
    with pytest.raises(ValidationError, match=media_messages.IMAGE_ONLY):
        await upload_user_image(user_id="user-1", file=upload)


@pytest.mark.asyncio
async def test_upload_user_image_accepts_heic_with_empty_content_type(monkeypatch):
    from app.features.media.upload import UploadedImage

    async def fake_upload(**kwargs):
        return UploadedImage(bucket="b", path="p", public_url="https://example.com/x.heic")

    monkeypatch.setattr("app.features.media.upload._upload_user_object", fake_upload)
    upload = UploadFile(filename="IMG_0001.HEIC", file=BytesIO(b"fake"), headers={"content-type": ""})
    result = await upload_user_image(user_id="user-1", file=upload)
    assert result.public_url.endswith(".heic")
