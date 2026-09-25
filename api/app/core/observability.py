"""Sentry error and performance reporting. An empty `SENTRY_DSN` turns it off."""

from __future__ import annotations

from typing import Any

import sentry_sdk

from app.core.settings import get_settings


def traces_sampler(sampling_context: dict[str, Any]) -> float:
    """Decide what fraction of requests Sentry traces.

    Health checks are never traced (uptime probes would dominate), a trace that
    continues an upstream one keeps its parent's decision, and everything else is
    sampled at 10% in production and 100% locally.
    """
    asgi_scope = sampling_context.get("asgi_scope")
    path = str(asgi_scope.get("path") or "") if isinstance(asgi_scope, dict) else ""
    if path.rstrip("/").endswith("/health"):
        return 0.0
    parent_sampled = sampling_context.get("parent_sampled")
    if parent_sampled is not None:
        return 1.0 if parent_sampled else 0.0
    return 0.1 if get_settings().is_production else 1.0


def init_sentry() -> None:
    """Start the Sentry SDK if a DSN is configured. Never sends personal data."""
    settings = get_settings()
    if not settings.sentry_dsn.strip():
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn.strip(),
        environment="production" if settings.is_production else "development",
        send_default_pii=False,
        traces_sampler=traces_sampler,
    )
