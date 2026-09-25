"""The Supabase clients. Only repositories (and `core.auth`) use them.

Two clients because signing a user in replaces the Authorization header on the
instance: `service_client()` is for data and `auth.admin`, `auth_client()` only
validates or issues user sessions.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import httpx
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from app.core.settings import get_settings


def _client(*, session_free: bool) -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
    http = httpx.Client(
        http2=False,
        timeout=httpx.Timeout(30.0),
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    )
    options = (
        SyncClientOptions(httpx_client=http, persist_session=False, auto_refresh_token=False)
        if session_free
        else SyncClientOptions(httpx_client=http)
    )
    return create_client(settings.supabase_url, settings.supabase_service_role_key.strip(), options=options)


@lru_cache
def service_client() -> Client:
    return _client(session_free=False)


@lru_cache
def auth_client() -> Client:
    return _client(session_free=True)


def rows(result: Any) -> list[dict[str, Any]]:
    """The rows of a PostgREST response, or `[]`."""
    data = getattr(result, "data", None)
    return [r for r in data if isinstance(r, dict)] if isinstance(data, list) else []


def first(result: Any) -> dict[str, Any] | None:
    found = rows(result)
    return found[0] if found else None


def is_upstream_unavailable(exc: BaseException) -> bool:
    """True when Supabase did not answer (timeout or network), not a refusal."""
    return isinstance(exc, httpx.TimeoutException | httpx.NetworkError)
