"""The FastAPI app. The only place `include_router` is called.

`uvicorn app.main:app` imports this module: it sets up logging and Sentry, then
builds the app. Tests call `create_app()` directly to get a fresh instance.
"""

from __future__ import annotations

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.errors import register_error_handlers
from app.core.logging import setup_logging
from app.core.observability import init_sentry
from app.core.settings import LOCAL_ORIGIN_REGEX, get_settings

# Every product route lives under this prefix; the web app and the baseline use the same one.
API_PREFIX = "/api/v1"


def _routers() -> list[APIRouter]:
    """Every slice router, in mount order. Add a slice's router here when it is rebuilt."""
    return []


def create_app() -> FastAPI:
    """Build the app: error rendering, CORS for the web app, slice routers and `/health`."""
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
