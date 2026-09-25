"""Pure upload rules: which files each route accepts, their stored type, and their object key."""

from __future__ import annotations

import re
from typing import Protocol

# Untyped uploads (phones often send `application/octet-stream`) count as images by extension.
IMAGE_FILENAME = re.compile(r"\.(avif|gif|heic|heif|jpe?g|png|webp)$", re.IGNORECASE)
# The content type stored for an untyped image, by extension; anything else is stored as JPEG.
IMAGE_TYPES_BY_EXTENSION = {
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".avif": "image/avif",
}
DEFAULT_IMAGE_TYPE = "image/jpeg"
# Declared types that mean "we don't know" and so fall back to the file name.
UNTYPED_CONTENT_TYPES = ("", "application/octet-stream")
# Declared type prefixes `/media/files` accepts.
GENERAL_FILE_TYPE_PREFIXES = ("image/", "video/", "application/pdf")
# Stored extensions are cut to this many characters after the dot.
MAX_EXTENSION_LENGTH = 10
IMAGES_FOLDER = "images"
FILES_FOLDER = "files"


class IncomingFile(Protocol):
    """An uploaded file as the router receives it (FastAPI's `UploadFile` fits this)."""

    @property
    def filename(self) -> str | None:
        """The name the browser sent, if any."""
        ...

    @property
    def content_type(self) -> str | None:
        """The declared MIME type, if any."""
        ...

    async def read(self) -> bytes:
        """The whole file body."""
        ...


def normalise_content_type(declared_type: str | None) -> str:
    """The declared type trimmed and lower-cased ("" when missing)."""
    return (declared_type or "").strip().lower()


def looks_like_image_filename(filename: str | None) -> bool:
    """True when the file name ends in a known image extension."""
    return bool(IMAGE_FILENAME.search((filename or "").strip()))


def image_allowed(content_type: str, filename: str | None) -> bool:
    """True for `image/*`, or an untyped upload whose name looks like an image."""
    if content_type.startswith("image/"):
        return True
    return content_type in UNTYPED_CONTENT_TYPES and looks_like_image_filename(filename)


def guess_image_type(filename: str | None) -> str:
    """The image type implied by the file name's extension (JPEG when unknown)."""
    lowered_name = (filename or "").strip().lower()
    for extension, image_type in IMAGE_TYPES_BY_EXTENSION.items():
        if lowered_name.endswith(extension):
            return image_type
    return DEFAULT_IMAGE_TYPE


def stored_image_type(content_type: str, filename: str | None) -> str:
    """The type to store an accepted image as: its own `image/*` type, or one guessed from its name."""
    return content_type if content_type.startswith("image/") else guess_image_type(filename)


def general_file_allowed(content_type: str) -> bool:
    """True for images, videos and PDFs (by declared type only)."""
    return content_type.startswith(GENERAL_FILE_TYPE_PREFIXES)


def file_extension(filename: str | None) -> str:
    """The lower-cased extension with its dot (at most 10 characters after it), or "" when none."""
    name = (filename or "upload").strip()
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1].lower()[:MAX_EXTENSION_LENGTH]


def object_key(*, user_id: str, folder: str, unique_token: str, filename: str | None) -> str:
    """Where an upload is stored: `users/<user id>/<folder>/<unique token><.ext>`."""
    return f"users/{user_id}/{folder}/{unique_token}{file_extension(filename)}"


def size_limit_in_megabytes(max_bytes: int) -> int:
    """The limit as whole megabytes for the error message (never below 1)."""
    return max(1, round(max_bytes / 1_000_000))
