"""Errors the media slice raises. Messages are the baseline's user-facing copy, verbatim."""

from __future__ import annotations

from app.core.errors import InvalidInput, PayloadTooLarge, Unavailable


class ImageOnly(InvalidInput):
    """`/media/images` got something that is not an image."""

    code = "media_image_only"
    default_message = "Only image uploads are supported."


class FileTypeUnsupported(InvalidInput):
    """`/media/files` got something other than an image, video or PDF."""

    code = "media_file_type_unsupported"
    default_message = "Only image, PDF, or video uploads are supported."


class FileEmpty(InvalidInput):
    """The uploaded file has no bytes."""

    code = "media_file_empty"
    default_message = "That file looks empty. Choose another file and try again."


class FileTooLarge(PayloadTooLarge):
    """The file is over the general upload limit; the message names the limit in MB."""

    code = "media_file_too_large"
    default_message = "File is too large."

    @classmethod
    def over_limit(cls, megabytes: int) -> FileTooLarge:
        """The error for a limit of `megabytes` MB, worded as the baseline does."""
        return cls(f"File is too large (max {megabytes}MB).")


class UploadFailed(Unavailable):
    """Storage is switched off or refused the file."""

    code = "media_upload_failed"
    default_message = "Could not upload file."
