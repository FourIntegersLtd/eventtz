"""Sentry. An empty `SENTRY_DSN` is a no-op."""

from __future__ import annotations

from typing import Any

import sentry_sdk

from app.core.settings import get_settings


def traces_sampler(ctx: dict[str, Any]) -> float:
    scope = ctx.get("asgi_scope")
    path = str(scope.get("path") or "") if isinstance(scope, dict) else ""
    if path.rstrip("/").endswith("/health"):
        return 0.0
    parent = ctx.get("parent_sampled")
    if parent is not None:
        return 1.0 if parent else 0.0
    return 0.1 if get_settings().is_production else 1.0


def init_sentry() -> None:
    settings = get_settings()
    if not settings.sentry_dsn.strip():
        return
    sentry_sdk.init(
        dsn=settings.sentry_dsn.strip(),
        environment="production" if settings.is_production else "development",
        send_default_pii=False,
        traces_sampler=traces_sampler,
    )
