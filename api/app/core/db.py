"""The Supabase clients. Only repositories (and `core.auth`) may use them.

There are two clients because signing a user in replaces the Authorization
header on the client instance it was called on:

- `service_client()` is for table/RPC/storage access and `auth.admin` calls.
- `auth_client()` only validates or issues user sessions, so it never pollutes
  the service client's headers.

Both are created lazily and cached for the life of the process.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import httpx
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from app.core.settings import get_settings


def _build_client(*, session_free: bool) -> Client:
    """Create a Supabase client authenticated with the service-role key.

    `session_free=True` stops the client storing or refreshing a user session,
    which is what the auth client needs.
    """
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    # HTTP/2 is off: PostgREST behind some proxies drops long-lived h2 streams.
    http_client = httpx.Client(
        http2=False,
        timeout=httpx.Timeout(30.0),
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    )
    options = (
        SyncClientOptions(httpx_client=http_client, persist_session=False, auto_refresh_token=False)
        if session_free
        else SyncClientOptions(httpx_client=http_client)
    )
    return create_client(settings.supabase_url, settings.supabase_service_role_key.strip(), options=options)


@lru_cache
def service_client() -> Client:
    """The data client: `.table()`, `.rpc()`, `.storage` and `auth.admin`."""
    return _build_client(session_free=False)


@lru_cache
def auth_client() -> Client:
    """The session client: `auth.get_user`, `auth.sign_in_with_password`, `auth.refresh_session`."""
    return _build_client(session_free=True)


def rows(result: Any) -> list[dict[str, Any]]:
    """The rows of a PostgREST response, or `[]` when it has none."""
    data = getattr(result, "data", None)
    return [row for row in data if isinstance(row, dict)] if isinstance(data, list) else []


def first(result: Any) -> dict[str, Any] | None:
    """The first row of a PostgREST response, or `None`."""
    found = rows(result)
    return found[0] if found else None


def is_upstream_unavailable(exc: BaseException) -> bool:
    """True when Supabase did not answer (timeout or network), as opposed to refusing the request."""
    return isinstance(exc, httpx.TimeoutException | httpx.NetworkError)
