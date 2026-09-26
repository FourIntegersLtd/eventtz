"""The one hard rule this whole package obeys: never touch a database that isn't local.

Every command in `cli.py` calls `assert_local_only` before it opens a single
connection. The real cut-over against the hosted Supabase and Railway databases
is the user's decision, made later by hand from `docs/runbooks/cutover.md`; this
tool only rehearses against Postgres containers on the same machine.
"""

from __future__ import annotations

from urllib.parse import urlsplit

# Hostnames that count as "this machine". `127.0.0.1` and `::1` are the loopback
# addresses; `localhost` resolves to one of them almost everywhere. Nothing else
# is accepted, so a typo'd Railway or Supabase hostname is refused rather than
# silently dialled.
_LOCAL_HOSTNAMES = frozenset({"localhost", "127.0.0.1", "::1"})


class NotLocalDatabaseError(RuntimeError):
    """Raised when a command is asked to touch a database that isn't on this machine."""

    def __init__(self, url: str) -> None:
        """Build the error message from `url`, redacting its password half."""
        # The message never repeats the password half of the URL.
        super().__init__(
            f"refusing to run against a non-local database ({redact_url(url)}); "
            "pass --i-have-approval-for-hosted if this is really wanted."
        )


def redact_url(url: str) -> str:
    """`url` with its password removed, safe to put in a log line or an error message."""
    parts = urlsplit(url)
    if parts.password is None:
        return url
    netloc = parts.netloc.replace(f":{parts.password}@", ":***@")
    return parts._replace(netloc=netloc).geturl()


def is_local_url(url: str) -> bool:
    """Whether `url`'s host is one of the loopback names this tool is allowed to touch."""
    hostname = urlsplit(url).hostname
    return hostname is not None and hostname.lower() in _LOCAL_HOSTNAMES


def assert_local_only(*urls: str, approved_for_hosted: bool) -> None:
    """Refuse to continue unless every URL is local, or the caller passed the override flag.

    Called once per CLI command with every URL that command will open, so a
    command that forgets to check one connection cannot slip through.
    """
    if approved_for_hosted:
        return
    for url in urls:
        if not is_local_url(url):
            raise NotLocalDatabaseError(url)
