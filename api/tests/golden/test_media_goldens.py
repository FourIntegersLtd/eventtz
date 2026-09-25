"""The media slice reproduces the baseline's upload type rules and S3 URL helpers.

Goldens were captured from the baseline `backend/` by `acceptance/capture/media_goldens.py`,
with the default bucket (`eventtz`) and region (`eu-west-2`) that these tests also run with.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.adapters.s3_storage import is_our_url, object_key_from_url, public_object_url
from app.features.media.domain import guess_image_type, image_allowed, normalise_content_type

GOLDEN_ROOT = Path(__file__).parent / "media"


def load_golden(name: str) -> Any:
    """The recorded cases in `tests/golden/media/<name>.json`."""
    return json.loads((GOLDEN_ROOT / f"{name}.json").read_text(encoding="utf-8"))


OBJECT_URLS = load_golden("object_urls")


@pytest.mark.parametrize(
    "case", load_golden("upload_rules"), ids=lambda case: f"{case['content_type']}|{case['filename']}"
)
def test_image_rules_match_baseline(case: dict[str, Any]) -> None:
    """Which uploads count as images, and the type guessed for untyped ones."""
    # The baseline lower-cases and trims the declared type before checking it.
    content_type = normalise_content_type(case["content_type"])
    assert image_allowed(content_type, case["filename"]) == case["image_allowed"]
    assert guess_image_type(case["filename"]) == case["guessed_image_type"]


@pytest.mark.parametrize("case", OBJECT_URLS["public_urls"], ids=lambda case: case["key"])
def test_public_urls_match_baseline(case: dict[str, str]) -> None:
    """Object keys become the same public URLs."""
    assert public_object_url(case["key"]) == case["url"]


@pytest.mark.parametrize("case", OBJECT_URLS["parsed_urls"], ids=lambda case: case["url"] or "<empty>")
def test_url_parsing_matches_baseline(case: dict[str, Any]) -> None:
    """URLs are recognised as ours, and mapped back to keys, the same way."""
    assert is_our_url(case["url"]) == case["is_ours"]
    assert object_key_from_url(case["url"]) == case["key"]
