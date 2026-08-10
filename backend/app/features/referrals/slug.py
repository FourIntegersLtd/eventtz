"""URL-safe slug helpers for referral partners."""

from __future__ import annotations

import re
import unicodedata

_SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def normalize_slug(raw: str) -> str:
    s = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^\w\s-]", "", s.lower())
    s = re.sub(r"[-\s]+", "-", s).strip("-")
    return s or "creator"


def slugify_display_name(display_name: str) -> str:
    return normalize_slug(display_name.strip())


def is_valid_slug(slug: str) -> bool:
    return bool(slug and _SLUG_RE.fullmatch(slug))
