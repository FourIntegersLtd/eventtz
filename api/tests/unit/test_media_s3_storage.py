"""`S3Storage.presigned_post` signs a POST policy locally (no network): target, fields and limits."""

from __future__ import annotations

import base64
import json

import pytest

from app.adapters.s3_storage import S3Storage
from app.core.settings import get_settings


@pytest.fixture(autouse=True)
def _s3_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    """Fake AWS keys, so boto3 can sign a policy without ever contacting S3."""
    settings = get_settings()
    monkeypatch.setattr(settings, "aws_access_key", "AKIATESTKEY")
    monkeypatch.setattr(settings, "aws_secret_access_key", "test-secret")
    monkeypatch.setattr(settings, "aws_s3_bucket_name", "test-bucket")
    monkeypatch.setattr(settings, "aws_region", "eu-west-2")


def test_presigned_post_targets_our_bucket_and_returns_the_public_url() -> None:
    """The browser posts to the bucket host; the saved link is the object's public URL."""
    key = "users/user-1/images/abc123.png"
    post = S3Storage().presigned_post(key=key, content_type=" image/png ", max_bytes=5_000_000)
    assert post.bucket == "test-bucket"
    assert post.key == key
    assert post.public_url == f"https://test-bucket.s3.eu-west-2.amazonaws.com/{key}"
    assert post.upload_url.startswith("https://")
    assert "test-bucket" in post.upload_url
    assert post.fields["key"] == key
    assert post.fields["Content-Type"] == "image/png"
    assert post.fields["Cache-Control"] == "public, max-age=3600"
    assert post.fields["x-amz-credential"].startswith("AKIATESTKEY/")
    assert post.fields["x-amz-signature"]


def test_presigned_post_policy_pins_size_type_and_expiry() -> None:
    """The signed policy is what S3 enforces: size range, exact type, cache header and key."""
    key = "users/user-1/files/clip.mp4"
    post = S3Storage().presigned_post(key=key, content_type="video/mp4", max_bytes=1234)
    policy = json.loads(base64.b64decode(post.fields["policy"]))
    conditions = policy["conditions"]
    assert ["content-length-range", 1, 1234] in conditions
    assert {"Content-Type": "video/mp4"} in conditions
    assert {"Cache-Control": "public, max-age=3600"} in conditions
    assert {"bucket": "test-bucket"} in conditions
    assert {"key": key} in conditions
    assert policy["expiration"]
