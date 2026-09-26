"""The public website's address, for links that leave the API (emails, share links, referral links).

These links always point at production, whichever environment built them, so a
link copied from a staging email or a local test still works for a real person.
"""

from __future__ import annotations

PUBLIC_WEBSITE = "https://www.eventtz.com"


def public_url(path: str) -> str:
    """An absolute link on the public website for a path such as `/login`."""
    normalized = path.strip()
    if not normalized:
        return PUBLIC_WEBSITE
    return f"{PUBLIC_WEBSITE}{normalized if normalized.startswith('/') else f'/{normalized}'}"
