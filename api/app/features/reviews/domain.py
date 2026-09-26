"""Pure rules for booking reviews: no I/O, no FastAPI, no database.

A review is a client's one-time rating and comment on a completed booking. This
module holds the two baseline rules that do not touch the database: how a
reviewer is named in public (from their email, never their real name), and
which photo URLs a review is allowed to keep.
"""

from __future__ import annotations

import re

# A review the client did not name is shown under this label.
ANONYMOUS_REVIEWER = "Verified client"

# A review may carry at most this many photos (baseline `MAX_REVIEW_IMAGES`).
MAX_REVIEW_IMAGES = 5

_DISALLOWED_LOCAL_PART_CHARACTERS = re.compile(r"[^a-zA-Z0-9._-]")


def reviewer_display_from_email(email: str | None) -> str:
    """How a reviewer is named in public: their email's local part, capitalised and clipped.

    Mirrors the baseline's `_reviewer_display_from_email` exactly: the part
    before `@`, stripped of anything but letters, digits, `.`, `_` and `-`,
    capitalised, and cut to 18 characters. A blank or missing email reads as
    `ANONYMOUS_REVIEWER`.
    """
    if not email:
        return ANONYMOUS_REVIEWER
    local_part = _DISALLOWED_LOCAL_PART_CHARACTERS.sub("", email.split("@", 1)[0].strip())
    if not local_part:
        return ANONYMOUS_REVIEWER
    if len(local_part) == 1:
        return local_part.upper()
    return local_part[:1].upper() + local_part[1:18]


def normalized_review_image_urls(raw_urls: object) -> list[str]:
    """Up to `MAX_REVIEW_IMAGES` distinct http(s) URLs from whatever the request sent.

    A non-list, a non-string entry, a blank string or a non-http(s) URL is
    silently dropped rather than rejected (baseline quirk kept on purpose).
    """
    if not isinstance(raw_urls, list):
        return []
    normalized: list[str] = []
    for raw_url in raw_urls:
        url = str(raw_url or "").strip()
        if not url or not url.startswith(("https://", "http://")) or url in normalized:
            continue
        normalized.append(url)
        if len(normalized) >= MAX_REVIEW_IMAGES:
            break
    return normalized
