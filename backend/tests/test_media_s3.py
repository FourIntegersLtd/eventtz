"""S3 public URL helpers and media upload routing."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.features.media import s3 as media_s3
from app.features.media.upload import upload_user_image


def _settings(**extra: object) -> SimpleNamespace:
    base = {
        "aws_access_key": "ak",
        "aws_secret_access_key": "sk",
        "aws_s3_bucket_name": "eventtz",
        "aws_region": "eu-west-2",
        "media_max_file_upload_bytes": 50_000_000,
    }
    base.update(extra)
    return SimpleNamespace(**base)


def test_public_object_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(media_s3, "get_settings", lambda: _settings())
    assert media_s3.public_object_url("users/u1/images/abc.jpg") == (
        "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/images/abc.jpg"
    )


def test_is_our_s3_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(media_s3, "get_settings", lambda: _settings())
    assert media_s3.is_our_s3_url(
        "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/files/a.mp4",
    )
    assert not media_s3.is_our_s3_url(
        "https://other.s3.eu-west-2.amazonaws.com/users/u1/a.jpg",
    )


def test_object_key_from_public_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(media_s3, "get_settings", lambda: _settings())
    assert (
        media_s3.object_key_from_public_url(
            "https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/files/a.mp4",
        )
        == "users/u1/files/a.mp4"
    )


@pytest.mark.asyncio
async def test_upload_user_image_writes_s3(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_upload_bytes(*, key: str, body: bytes, content_type: str) -> str:
        captured["key"] = key
        captured["body"] = body
        captured["content_type"] = content_type
        return f"https://eventtz.s3.eu-west-2.amazonaws.com/{key}"

    monkeypatch.setattr("app.features.media.upload.s3_configured", lambda: True)
    monkeypatch.setattr("app.features.media.upload.upload_bytes", fake_upload_bytes)
    monkeypatch.setattr("app.features.media.upload.get_settings", lambda: _settings())

    class _File:
        filename = "pic.jpg"
        content_type = "image/jpeg"

        async def read(self) -> bytes:
            return b"abc"

    result = await upload_user_image(user_id="u1", file=_File())
    assert result.bucket == "eventtz"
    assert str(result.path).startswith("users/u1/images/")
    assert str(result.public_url).startswith("https://eventtz.s3.eu-west-2.amazonaws.com/users/u1/images/")
    assert captured["body"] == b"abc"
    assert captured["content_type"] == "image/jpeg"
