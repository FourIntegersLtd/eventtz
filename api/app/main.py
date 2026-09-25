"""The FastAPI app. The only place `include_router` is called."""

from __future__ import annotations

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.core.observability import init_sentry
from app.core.settings import LOCAL_ORIGIN_REGEX, get_settings

API_PREFIX = "/api/v1"


def _routers() -> list[APIRouter]:
    return []


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Eventtz API", version="1.0.0")
    register_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_origin_regex=LOCAL_ORIGIN_REGEX,  # baseline parity: local dev may call any deployment
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    for router in _routers():
        app.include_router(router, prefix=API_PREFIX)

    @app.api_route("/health", methods=["GET", "HEAD"], include_in_schema=False)
    def health() -> dict[str, str]:
        """Liveness for Railway and UptimeRobot (which sends HEAD)."""
        return {"status": "ok"}

    return app


setup_logging()
init_sentry()
app = create_app()
