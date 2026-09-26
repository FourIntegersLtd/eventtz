"""The public website's address, for links that leave the API (emails, share links, referral links).

These links always point at production, whichever environment built them, so a
link copied from a staging email or a local test still works for a real person.
"""

from __future__ import annotations

from urllib.parse import urlparse

PUBLIC_WEBSITE = "https://www.eventtz.com"

# Hosts that a link built elsewhere (a local dev server, or the bare apex domain)
# is rewritten away from, so a link generated in any environment still opens for
# a real person on the production site.
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}
_APEX_HOSTS = {"eventtz.com", "www.eventtz.com"}


def public_url(path: str) -> str:
    """An absolute link on the public website for a path such as `/login`."""
    normalized = path.strip()
    if not normalized:
        return PUBLIC_WEBSITE
    return f"{PUBLIC_WEBSITE}{normalized if normalized.startswith('/') else f'/{normalized}'}"


def ensure_public_url(url: str) -> str:
    """Rewrite a dev host or the bare apex domain in `url` to `PUBLIC_WEBSITE`.

    A verification or reset link is sometimes built against `localhost` (local
    development) or the apex `eventtz.com` domain; outbound email always links to
    `www.eventtz.com` so the link works wherever it is opened. Any other host
    (a third-party URL) is returned unchanged.
    """
    raw = url.strip()
    if not raw:
        return raw
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if host not in _LOCAL_HOSTS and not host.endswith(".local") and host not in _APEX_HOSTS:
        return raw
    suffix = f"?{parsed.query}" if parsed.query else ""
    if parsed.fragment:
        suffix += f"#{parsed.fragment}"
    return f"{PUBLIC_WEBSITE}{parsed.path}{suffix}"
