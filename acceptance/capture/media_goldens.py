"""Capture the media slice's goldens from the baseline: upload type rules and S3 URL helpers.

Run with `make capture SCRIPT=capture/media_goldens.py` (never directly). Output is
`media/upload_rules.json` and `media/object_urls.json`. The URL cases use the
baseline's default bucket and region (`eventtz`, `eu-west-2`), since the capture
runner has no AWS settings.

Add a case whenever the api/ implementation takes a branch no case covers, then re-capture.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from app.features.media.s3 import (  # type: ignore[import-not-found]
    is_our_s3_url,
    object_key_from_public_url,
    public_object_url,
)
from app.features.media.upload import (  # type: ignore[import-not-found]
    _guess_image_content_type,
    _image_content_type_allowed,
)

# (declared content type, filename) pairs, one branch of the image rules each.
UPLOAD_CASES: list[tuple[str, str]] = [
    ("image/png", "photo.png"),
    ("image/jpeg", "photo"),
    ("", "photo.png"),
    ("", "photo.JPG"),
    ("", "photo.jpeg"),
    ("", "photo.webp"),
    ("", "photo.gif"),
    ("", "photo.heic"),
    ("", "photo.HEIF"),
    ("", "photo.avif"),
    ("", "photo.bmp"),
    ("", "photo"),
    ("", ""),
    ("", "  photo.png  "),
    ("application/octet-stream", "photo.png"),
    ("application/octet-stream", "photo.pdf"),
    ("application/pdf", "photo.png"),
    ("text/plain", "notes.txt"),
    ("video/mp4", "clip.mp4"),
]

# Object keys to turn into public URLs (and back again).
OBJECT_KEYS: list[str] = [
    "users/abc/images/0123.png",
    "/users/abc/images/leading-slash.png",
    "users/abc/files/with space.pdf",
    "users/abc/files/ünïcödé.pdf",
    "users/abc/files/hash#and?query.pdf",
]

# URLs that may or may not point at our bucket.
URL_CASES: list[str] = [
    "https://eventtz.s3.eu-west-2.amazonaws.com/users/abc/images/0123.png",
    "  https://eventtz.s3.eu-west-2.amazonaws.com/users/abc/files/with%20space.pdf  ",
    "https://EVENTTZ.S3.EU-WEST-2.AMAZONAWS.COM/users/abc/x.png",
    "http://eventtz.s3.eu-west-2.amazonaws.com/users/abc/x.png",
    "https://eventtz.s3.eu-west-2.amazonaws.com/",
    "https://eventtz.s3.eu-west-2.amazonaws.com",
    "https://other-bucket.s3.eu-west-2.amazonaws.com/users/abc/x.png",
    "https://example.com/users/abc/x.png",
    "not a url",
    "",
]


def capture_upload_rule(content_type: str, filename: str) -> dict[str, object]:
    """The baseline's verdict on one declared type and filename."""
    return {
        "content_type": content_type,
        "filename": filename,
        "image_allowed": _image_content_type_allowed(content_type, filename),
        "guessed_image_type": _guess_image_content_type(filename),
    }


def capture_object_urls() -> dict[str, object]:
    """Key → URL, and URL → (ours?, key) pairs."""
    return {
        "public_urls": [{"key": key, "url": public_object_url(key)} for key in OBJECT_KEYS],
        "parsed_urls": [
            {"url": url, "is_ours": is_our_s3_url(url), "key": object_key_from_public_url(url)}
            for url in URL_CASES
        ],
    }


def write_json(path: Path, value: object) -> None:
    """Write `value` as stable, readable JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n")


def main(golden_dir: Path) -> None:
    """Write both golden files under `golden_dir/media/`."""
    write_json(
        golden_dir / "media" / "upload_rules.json",
        [capture_upload_rule(content_type, filename) for content_type, filename in UPLOAD_CASES],
    )
    write_json(golden_dir / "media" / "object_urls.json", capture_object_urls())


if __name__ == "__main__":
    main(Path(sys.argv[1]))
