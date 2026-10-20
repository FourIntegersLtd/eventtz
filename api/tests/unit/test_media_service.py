"""Media use cases against a fake storage: what gets stored, where, as what type, and each refusal."""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from app.core.auth import Principal
from app.features.media import service
from app.features.media.domain import file_extension, object_key, size_limit_in_megabytes
from app.features.media.errors import FileEmpty, FileTooLarge, FileTypeUnsupported, ImageOnly, UploadFailed
from app.features.media.schemas import CreateUploadUrlBody, MediaUploadUrlKind
from tests.support.fakes import FakeStorage

UPLOADER = Principal(id="user-123", email="vendor@example.com", user_type="vendor")


@dataclass
class UploadedFile:
    """A stand-in for FastAPI's `UploadFile`."""

    filename: str | None
    content_type: str | None
    body: bytes = b"file bytes"

    async def read(self) -> bytes:
        """The whole body."""
        return self.body


async def test_presigned_image_uses_images_folder_and_cap() -> None:
    """Presign checks type rules and passes the image byte cap into storage."""
    storage = FakeStorage()
    body = CreateUploadUrlBody(
        kind=MediaUploadUrlKind.image,
        filename="Photo.PNG",
        content_type="Image/PNG",
        content_length=1024,
    )
    presigned = await service.create_upload_url(UPLOADER, body, storage)
    [recorded] = storage.presigned
    assert recorded["content_type"] == "image/png"
    assert recorded["max_bytes"] == 50_000_000
    assert presigned.path.startswith("users/user-123/images/")
    assert presigned.path.endswith(".png")
    assert presigned.upload_url.startswith("https://")
    assert presigned.fields["Content-Type"] == "image/png"


async def test_presigned_file_over_limit_is_refused_before_storage(monkeypatch: pytest.MonkeyPatch) -> None:
    """Declared size is checked before minting a POST policy."""
    from app.core.settings import get_settings

    monkeypatch.setattr(get_settings(), "media_max_file_upload_bytes", 5)
    body = CreateUploadUrlBody(
        kind=MediaUploadUrlKind.file,
        filename="clip.mp4",
        content_type="video/mp4",
        content_length=6,
    )
    with pytest.raises(FileTooLarge):
        await service.create_upload_url(UPLOADER, body, FakeStorage())
    assert FakeStorage().presigned == []


async def test_presigned_upload_fails_when_storage_is_off() -> None:
    """Same as multipart: storage must be configured."""
    body = CreateUploadUrlBody(
        kind=MediaUploadUrlKind.image,
        filename="photo.png",
        content_type="image/png",
        content_length=1,
    )
    with pytest.raises(UploadFailed):
        await service.create_upload_url(UPLOADER, body, FakeStorage(configured=False))


async def test_image_is_stored_under_the_users_images_folder() -> None:
    """A typed image keeps its type, its lower-cased extension and gets a fresh key."""
    storage = FakeStorage()
    stored = await service.upload_image(UPLOADER, UploadedFile("Photo.PNG", "Image/PNG"), storage)
    [saved] = storage.saved
    assert saved.key.startswith("users/user-123/images/")
    assert saved.key.endswith(".png")
    assert saved.content_type == "image/png"
    assert saved.body == b"file bytes"
    assert stored.path == saved.key
    assert stored.bucket == "fake-bucket"
    assert stored.public_url == f"https://files.example/{saved.key}"


async def test_untyped_image_is_stored_with_a_type_guessed_from_its_name() -> None:
    """Phones often send HEIC photos as octet-stream."""
    storage = FakeStorage()
    await service.upload_image(UPLOADER, UploadedFile("photo.heic", "application/octet-stream"), storage)
    assert storage.saved[0].content_type == "image/heic"


async def test_every_upload_gets_a_new_key() -> None:
    """Keys are never reused, so public caching is safe."""
    storage = FakeStorage()
    for _attempt in range(2):
        await service.upload_image(UPLOADER, UploadedFile("photo.png", "image/png"), storage)
    assert storage.saved[0].key != storage.saved[1].key


async def test_general_files_go_in_the_files_folder_with_their_declared_type() -> None:
    """PDF certificates and videos are stored as declared."""
    storage = FakeStorage()
    await service.upload_file(UPLOADER, UploadedFile("cert.pdf", "application/pdf"), storage)
    assert storage.saved[0].key.startswith("users/user-123/files/")
    assert storage.saved[0].content_type == "application/pdf"


async def test_image_route_refuses_non_images() -> None:
    """A PDF is not an image."""
    with pytest.raises(ImageOnly):
        await service.upload_image(UPLOADER, UploadedFile("cert.pdf", "application/pdf"), FakeStorage())


async def test_file_route_refuses_other_types() -> None:
    """Text files are neither images, videos nor PDFs."""
    with pytest.raises(FileTypeUnsupported):
        await service.upload_file(UPLOADER, UploadedFile("notes.txt", "text/plain"), FakeStorage())


async def test_storage_switched_off_fails_before_reading() -> None:
    """Even an empty file gets the storage error first (baseline order)."""
    with pytest.raises(UploadFailed):
        await service.upload_image(
            UPLOADER, UploadedFile("photo.png", "image/png", b""), FakeStorage(configured=False)
        )


async def test_empty_files_are_refused() -> None:
    """Nothing is stored for a zero-byte upload."""
    storage = FakeStorage()
    with pytest.raises(FileEmpty):
        await service.upload_file(UPLOADER, UploadedFile("cert.pdf", "application/pdf", b""), storage)
    assert storage.saved == []


async def test_general_files_over_the_limit_are_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    """The message names the limit in whole megabytes."""
    from app.core.settings import get_settings

    monkeypatch.setattr(get_settings(), "media_max_file_upload_bytes", 5)
    with pytest.raises(FileTooLarge) as raised:
        await service.upload_file(UPLOADER, UploadedFile("clip.mp4", "video/mp4", b"123456"), FakeStorage())
    assert raised.value.message == "File is too large (max 1MB)."
    assert raised.value.status == 413


async def test_storage_errors_become_upload_failed() -> None:
    """A boto3 failure is logged and reported as the generic upload error."""
    with pytest.raises(UploadFailed):
        await service.upload_image(
            UPLOADER, UploadedFile("photo.png", "image/png"), FakeStorage(error=RuntimeError("S3 down"))
        )


@pytest.mark.parametrize(
    ("filename", "extension"),
    [
        ("photo.PNG", ".png"),
        ("archive.tar.gz", ".gz"),
        ("no-extension", ""),
        (None, ""),
        ("", ""),
        ("  spaced.pdf  ", ".pdf"),
        ("odd.abcdefghijklmnop", ".abcdefghij"),
    ],
)
def test_file_extension(filename: str | None, extension: str) -> None:
    """The stored extension is lower-cased and at most ten characters."""
    assert file_extension(filename) == extension


def test_object_key_layout() -> None:
    """`users/<user id>/<folder>/<token><ext>`."""
    key = object_key(user_id="user-1", folder="images", unique_token="abc", filename="x.JPG")
    assert key == "users/user-1/images/abc.jpg"


@pytest.mark.parametrize(("max_bytes", "megabytes"), [(50_000_000, 50), (400_000, 1), (1_600_000, 2)])
def test_size_limit_in_megabytes(max_bytes: int, megabytes: int) -> None:
    """Rounded, and never shown as 0MB."""
    assert size_limit_in_megabytes(max_bytes) == megabytes
