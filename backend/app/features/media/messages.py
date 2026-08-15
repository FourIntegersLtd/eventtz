"""User-facing media upload copy."""

from __future__ import annotations

SIGN_IN_TO_UPLOAD = "Please sign in to upload."
IMAGE_ONLY = "Only image uploads are supported."
FILE_TYPE_UNSUPPORTED = "Only image, PDF, or video uploads are supported."
FILE_EMPTY = "That file looks empty. Choose another file and try again."
FILE_TOO_LARGE = "File is too large (max {mb}MB)."
UPLOAD_FAILED = "Could not upload file."


def file_too_large_detail(mb: int) -> str:
    return FILE_TOO_LARGE.format(mb=mb)
