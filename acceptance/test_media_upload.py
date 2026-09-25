"""Freeze: signed-in uploads (`POST /media/images` and `POST /media/files`).

Owned by the `media` slice. The acceptance servers run with S3 switched off (no
AWS keys), so a file that passes every check ends in the "upload failed" 503.
That keeps these tests from ever writing to a real bucket. The successful
upload path is covered in api/ by unit tests against a fake storage port.
"""

from __future__ import annotations

import httpx
import pytest

from conftest import API

SIGN_IN_REQUIRED = "Please sign in to continue."
IMAGE_ONLY = "Only image uploads are supported."
FILE_TYPE_UNSUPPORTED = "Only image, PDF, or video uploads are supported."
UPLOAD_FAILED = "Could not upload file."

IMAGES_URL = f"{API}/media/images"
FILES_URL = f"{API}/media/files"
# A few bytes are enough: nothing checks the content, only the declared type and name.
SAMPLE_BYTES = b"not really an image"


def upload(browser: httpx.Client, url: str, filename: str, content_type: str) -> httpx.Response:
    """Send one multipart upload in the `file` field."""
    return browser.post(url, files={"file": (filename, SAMPLE_BYTES, content_type)})


@pytest.mark.parametrize("url", [IMAGES_URL, FILES_URL])
def test_uploads_need_a_signed_in_user(anonymous: httpx.Client, url: str) -> None:
    """Anonymous uploads are refused before the file is looked at."""
    response = upload(anonymous, url, "photo.png", "image/png")
    assert response.status_code == 401
    assert response.json()["detail"] == SIGN_IN_REQUIRED


@pytest.mark.parametrize("url", [IMAGES_URL, FILES_URL])
def test_a_request_without_a_file_is_a_validation_error(as_client: httpx.Client, url: str) -> None:
    """The multipart `file` field is required."""
    response = as_client.post(url, data={"note": "no file"})
    assert response.status_code == 422


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("notes.txt", "text/plain"),
        ("document.pdf", "application/pdf"),
        ("clip.mp4", "video/mp4"),
        ("unknown.bin", "application/octet-stream"),
        ("no-extension", ""),
    ],
)
def test_image_upload_rejects_anything_that_is_not_an_image(
    as_client: httpx.Client, filename: str, content_type: str
) -> None:
    """Only `image/*`, or an untyped file with an image extension, gets past the type check."""
    response = upload(as_client, IMAGES_URL, filename, content_type)
    assert response.status_code == 400
    assert response.json()["detail"] == IMAGE_ONLY


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("photo.png", "image/png"),
        ("PHOTO.JPG", "IMAGE/JPEG"),
        ("photo.heic", "application/octet-stream"),
        ("photo.webp", ""),
    ],
)
def test_image_upload_accepts_images_then_fails_without_storage(
    as_vendor: httpx.Client, filename: str, content_type: str
) -> None:
    """A real image (by type, or by extension when untyped) reaches storage, which is off here."""
    response = upload(as_vendor, IMAGES_URL, filename, content_type)
    assert response.status_code == 503
    assert response.json()["detail"] == UPLOAD_FAILED


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("notes.txt", "text/plain"),
        ("sheet.csv", "text/csv"),
        ("archive.zip", "application/zip"),
        ("photo.png", "application/octet-stream"),
        ("no-type", ""),
    ],
)
def test_file_upload_rejects_other_types(as_vendor: httpx.Client, filename: str, content_type: str) -> None:
    """General uploads go by declared type only: an untyped file is refused even with an image name."""
    response = upload(as_vendor, FILES_URL, filename, content_type)
    assert response.status_code == 400
    assert response.json()["detail"] == FILE_TYPE_UNSUPPORTED


@pytest.mark.parametrize(
    ("filename", "content_type"),
    [
        ("photo.png", "image/png"),
        ("certificate.pdf", "application/pdf"),
        ("CERT.PDF", "Application/PDF"),
        ("portfolio.mp4", "video/mp4"),
    ],
)
def test_file_upload_accepts_images_pdfs_and_videos_then_fails_without_storage(
    as_client: httpx.Client, filename: str, content_type: str
) -> None:
    """Images, PDFs and videos reach storage, which is off here."""
    response = upload(as_client, FILES_URL, filename, content_type)
    assert response.status_code == 503
    assert response.json()["detail"] == UPLOAD_FAILED
