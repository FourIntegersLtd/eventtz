"""Sentry error/tracing init. Empty ``SENTRY_DSN`` is a no-op."""

from __future__ import annotations

from typing import Any

import sentry_sdk

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def traces_sampler(sampling_context: dict[str, Any]) -> float:
    """Skip health checks; otherwise sample all locally and 10% in production."""
    path = ""
    asgi = sampling_context.get("asgi_scope")
    if isinstance(asgi, dict):
        path = str(asgi.get("path") or "")
    name = ""
    tx = sampling_context.get("transaction_context")
    if isinstance(tx, dict):
        name = str(tx.get("name") or "")
    normalized = path.rstrip("/") or name.rstrip("/")
    if normalized.endswith("/health"):
        return 0.0
    parent = sampling_context.get("parent_sampled")
    if parent is not None:
        return 1.0 if parent else 0.0
    return 0.1 if get_settings().is_production else 1.0


def init_sentry() -> None:
    settings = get_settings()
    dsn = settings.sentry_dsn.strip()
    if not dsn:
        return
    environment = "production" if settings.is_production else "development"
    sentry_sdk.init(
        dsn=dsn,
        environment=environment,
        send_default_pii=False,
        traces_sampler=traces_sampler,
    )
    logger.info("Sentry initialized (environment=%s)", environment)


def bind_sentry_user(*, user_id: str, user_type: str | None = None) -> None:
    if not get_settings().sentry_dsn.strip() or not user_id:
        return
    sentry_sdk.set_user({"id": user_id})
    if user_type:
        sentry_sdk.set_tag("user_type", user_type)
