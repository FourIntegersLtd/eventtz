"""Structured logging (copied from OSCE `platform-api`).

JSON lines when deployed, coloured console locally. `RequestContextMiddleware`
binds the request id, method and path into a context variable, so every log
line written while handling a request carries them without being passed around.

Railway collects stdout, so there are no log files.
"""

from __future__ import annotations

import logging
import sys
import uuid
from collections.abc import Awaitable, Callable

import structlog
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.settings import Settings

REQUEST_ID_HEADER = "X-Request-ID"


def configure_logging(settings: Settings) -> None:
    """Set up structlog and stdlib logging: JSON lines when deployed, coloured console locally."""
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        # Eventtz log calls use %-style arguments (`log.info("sent user_id=%s", user_id)`);
        # this fills them in. OSCE's calls pass keyword arguments instead.
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
    ]
    renderer: structlog.types.Processor = (
        structlog.processors.JSONRenderer() if settings.log_json else structlog.dev.ConsoleRenderer()
    )
    # The console renderer prints tracebacks itself; JSON needs them turned into a string field.
    exception_processors: list[structlog.types.Processor] = (
        [structlog.processors.format_exc_info] if settings.log_json else []
    )

    structlog.configure(
        processors=[*shared_processors, structlog.stdlib.ProcessorFormatter.wrap_for_formatter],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Route stdlib loggers (uvicorn, sqlalchemy, alembic) through the same renderer.
    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            *exception_processors,
            renderer,
        ],
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(level)
    # The HTTP libraries log every request at INFO; that drowns out our own lines.
    for noisy_logger in ("httpx", "httpcore", "uvicorn.access"):
        logging.getLogger(noisy_logger).setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """A named logger; call with `__name__` so log lines show which module wrote them."""
    return structlog.get_logger(name)  # type: ignore[no-any-return]


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Binds a request id (and the method and path) into every log line the request emits."""

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        """Stamp a request id onto the request and its response, and bind it for structlog."""
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        request.state.request_id = request_id
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id, method=request.method, path=request.url.path
        )
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
