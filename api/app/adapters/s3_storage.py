"""`Storage` backed by a public S3 bucket, plus the helpers that map object keys to URLs.

Objects are public-read through the bucket policy, so a file's URL is just
`https://<bucket>.s3.<region>.amazonaws.com/<key>`. The boto3 client is built
per call from settings, so changing keys needs only a restart and tests never
open a connection.
"""

from __future__ import annotations

from io import BytesIO
from typing import TYPE_CHECKING
from urllib.parse import quote, unquote, urlparse

import boto3

from app.core.ports import StoredFile
from app.core.settings import get_settings

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

# S3's DeleteObjects accepts at most this many keys per request.
DELETE_BATCH_SIZE = 1000

# Browsers and the CDN may cache an uploaded file for an hour; keys are never reused.
CACHE_CONTROL = "public, max-age=3600"


def bucket_name() -> str:
    """The configured bucket, falling back to the production bucket's name."""
    return get_settings().aws_s3_bucket_name.strip() or "eventtz"


def public_host() -> str:
    """The bucket's virtual-hosted S3 host name, e.g. `eventtz.s3.eu-west-2.amazonaws.com`."""
    region = get_settings().aws_region.strip()
    return f"{get_settings().aws_s3_bucket_name.strip()}.s3.{region}.amazonaws.com"


def public_object_url(key: str) -> str:
    """The public URL of the object stored under `key` (percent-encoded, slashes kept)."""
    encoded_key = quote(key.lstrip("/"), safe="/")
    return f"https://{public_host()}/{encoded_key}"


def is_our_url(url: str) -> bool:
    """True when `url` points into our bucket (any scheme, host compared case-insensitively)."""
    host = (urlparse(url.strip()).netloc or "").lower()
    return host == public_host().lower()


def object_key_from_url(url: str) -> str | None:
    """The object key inside one of our bucket's URLs, or None for other URLs or the bare bucket."""
    if not is_our_url(url):
        return None
    object_key = unquote((urlparse(url.strip()).path or "").lstrip("/"))
    return object_key or None


class S3Storage:
    """Uploads to the configured S3 bucket."""

    def is_configured(self) -> bool:
        """True only when the keys, bucket and region are all set."""
        settings = get_settings()
        return all(
            value.strip()
            for value in (
                settings.aws_access_key,
                settings.aws_secret_access_key,
                settings.aws_s3_bucket_name,
                settings.aws_region,
            )
        )

    def public_host(self) -> str:
        """The bucket's virtual-hosted S3 host name."""
        return public_host()

    def save(self, *, key: str, body: bytes, content_type: str) -> StoredFile:
        """Upload `body` as a public, cacheable object; boto3 errors propagate to the caller."""
        extra_arguments = {"CacheControl": CACHE_CONTROL}
        if content_type.strip():
            extra_arguments["ContentType"] = content_type.strip()
        self._client().upload_fileobj(BytesIO(body), bucket_name(), key, ExtraArgs=extra_arguments)
        return StoredFile(bucket=bucket_name(), key=key, public_url=public_object_url(key))

    def delete_object(self, key: str) -> None:
        """Delete one object; S3 answers success for a key that does not exist."""
        self._client().delete_object(Bucket=bucket_name(), Key=key)

    def delete_prefix(self, prefix: str) -> None:
        """List every object under `prefix` and delete them in batches of `DELETE_BATCH_SIZE`."""
        if not prefix:
            return  # an empty prefix would empty the whole bucket
        client = self._client()
        bucket = bucket_name()
        pending_keys: list[str] = []
        for page in client.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
            for stored_object in page.get("Contents") or []:
                object_key = str(stored_object.get("Key") or "")
                if not object_key:
                    continue
                pending_keys.append(object_key)
                if len(pending_keys) >= DELETE_BATCH_SIZE:
                    self._delete_batch(client, bucket, pending_keys)
                    pending_keys = []
        if pending_keys:
            self._delete_batch(client, bucket, pending_keys)

    @staticmethod
    def _delete_batch(client: S3Client, bucket: str, object_keys: list[str]) -> None:
        """One DeleteObjects request for up to `DELETE_BATCH_SIZE` keys."""
        client.delete_objects(
            Bucket=bucket,
            Delete={"Objects": [{"Key": object_key} for object_key in object_keys], "Quiet": True},
        )

    def _client(self) -> S3Client:
        """A boto3 S3 client using the configured keys and region."""
        settings = get_settings()
        return boto3.client(
            "s3",
            region_name=settings.aws_region.strip(),
            aws_access_key_id=settings.aws_access_key.strip(),
            aws_secret_access_key=settings.aws_secret_access_key.strip(),
        )
