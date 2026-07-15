"""Supabase client, PostgREST helpers, and shared DB utilities."""

from __future__ import annotations

from typing import Any
from urllib.parse import urlparse

import httpx
from postgrest.exceptions import APIError
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_service_client: Client | None = None
_auth_client: Client | None = None

# In-memory vendor rows for LOCAL_AUTH_MODE
local_vendors: dict[str, dict[str, Any]] = {}


def _create_supabase_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        logger.error(
            "Supabase env missing: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
            "(service role secret — backend only, never expose to clients)",
        )
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
        )
    # HTTP/2 over a shared httpx pool can raise Errno 35 under concurrent PostgREST calls on macOS.
    httpx_client = httpx.Client(
        http2=False,
        timeout=httpx.Timeout(30.0),
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    )
    options = SyncClientOptions(httpx_client=httpx_client)
    client = create_client(
        settings.supabase_url,
        settings.supabase_service_role_key.strip(),
        options=options,
    )
    host = urlparse(settings.supabase_url).netloc or settings.supabase_url
    logger.info("Supabase client ready (host=%s)", host)
    return client


def get_supabase() -> Client:
    """Service-role client for DB, Storage, and other backend-only operations."""
    global _service_client
    if _service_client is None:
        _service_client = _create_supabase_client()
    return _service_client


def get_supabase_auth_client() -> Client:
    """Isolated client for Supabase Auth flows (sign-in mutates Authorization)."""
    global _auth_client
    if _auth_client is None:
        _auth_client = _create_supabase_client()
    return _auth_client


def get_db() -> Client:
    return get_supabase()


def get_client() -> Client:
    """Deprecated alias — prefer ``get_db()``."""
    return get_db()


def apply_recent_first_order(
    q: Any,
    *,
    column: str = "updated_at",
    tie_breaker: str = "created_at",
    final_tie_breaker: str = "id",
) -> Any:
    """Apply descending order for list endpoints (most recent first)."""
    q = q.order(column, desc=True)
    if tie_breaker and tie_breaker != column:
        q = q.order(tie_breaker, desc=True)
    if final_tie_breaker and final_tie_breaker not in {column, tie_breaker}:
        q = q.order(final_tie_breaker, desc=True)
    return q


def rows(res: Any) -> list[dict[str, Any]]:
    """Return ``data`` from a PostgREST execute result, or an empty list."""
    raw = getattr(res, "data", None)
    if not isinstance(raw, list):
        return []
    return [r for r in raw if isinstance(r, dict)]


def one_row(res: Any) -> dict[str, Any] | None:
    items = rows(res)
    return items[0] if items else None


def is_missing_approval_status_column(err: Exception) -> bool:
    if not isinstance(err, APIError):
        return False
    code = getattr(err, "code", None)
    msg = str(err)
    return code == "42703" and "approval_status" in msg


def is_approval_status_check_violation(err: Exception) -> bool:
    if not isinstance(err, APIError):
        return False
    code = getattr(err, "code", None)
    msg = str(err)
    return code == "23514" and "vendors_approval_status_chk" in msg
