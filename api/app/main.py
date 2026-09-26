"""The FastAPI app. The only place `include_router` is called.

`uvicorn app.main:app` imports this module: it sets up logging and Sentry, then
builds the app. Tests call `create_app()` directly to get a fresh instance.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.adapters.http_webhooks import BackgroundWebhooks
from app.adapters.openai_language_model import OpenAILanguageModel
from app.adapters.resend_mailer import ResendMailer
from app.adapters.s3_storage import S3Storage
from app.core.auth import bind_account_lookup
from app.core.db import dispose_engine
from app.core.errors import register_error_handlers
from app.core.logging import RequestContextMiddleware, configure_logging
from app.core.observability import configure_sentry
from app.core.ports import language_model_port, mailer_port, storage_port, webhooks_port
from app.core.redis import close_redis
from app.core.settings import LOCAL_ORIGIN_REGEX, get_settings
from app.features.bookings import router_client as bookings_client_router
from app.features.bookings import router_vendor as bookings_vendor_router
from app.features.content import router as content_router
from app.features.content import router_admin as content_admin_router
from app.features.disputes import router_admin as disputes_admin_router
from app.features.disputes import router_client as disputes_client_router
from app.features.disputes import router_vendor as disputes_vendor_router
from app.features.identity import router as identity_router
from app.features.identity import router_settings as identity_settings_router
from app.features.identity import service_accounts as identity_accounts
from app.features.marketplace import router as marketplace_router
from app.features.marketplace import router_client as marketplace_client_router
from app.features.marketplace import router_vendor as marketplace_vendor_router
from app.features.media import router as media_router
from app.features.messaging import router as messaging_router
from app.features.messaging import router_admin as messaging_admin_router
from app.features.notifications import router_client as notifications_client_router
from app.features.notifications import router_vendor as notifications_vendor_router
from app.features.referrals import router as referrals_router
from app.features.referrals import router_admin as referrals_admin_router
from app.features.reviews import router_admin as reviews_admin_router
from app.features.reviews import router_client as reviews_client_router
from app.features.reviews import router_vendor as reviews_vendor_router
from app.features.vendors import router as vendors_router
from app.features.vendors import router_admin as vendors_admin_router

# Every product route lives under this prefix; the web app and the baseline use the same one.
API_PREFIX = "/api/v1"


def _routers() -> list[APIRouter]:
    """Every slice router, in mount order. Add a slice's router here when it is rebuilt."""
    return [
        bookings_client_router.router,
        bookings_vendor_router.router,
        content_router.router,
        content_admin_router.router,
        disputes_client_router.router,
        disputes_vendor_router.router,
        disputes_admin_router.router,
        identity_router.router,
        identity_settings_router.router,
        marketplace_router.router,
        marketplace_client_router.router,
        marketplace_vendor_router.router,
        media_router.router,
        messaging_router.router,
        messaging_admin_router.router,
        notifications_client_router.router,
        notifications_vendor_router.router,
        referrals_router.router,
        referrals_admin_router.router,
        reviews_client_router.router,
        reviews_vendor_router.router,
        reviews_admin_router.router,
        vendors_router.router,
        vendors_admin_router.router,
    ]


def _plug_in_adapters(app: FastAPI) -> None:
    """Give the ports in `app.core.ports` their real implementations (tests override these with fakes)."""
    app.dependency_overrides[language_model_port] = OpenAILanguageModel
    app.dependency_overrides[mailer_port] = ResendMailer
    app.dependency_overrides[webhooks_port] = BackgroundWebhooks
    app.dependency_overrides[storage_port] = S3Storage


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Close the database pool and the Redis client when the server stops."""
    yield
    await dispose_engine()
    await close_redis()


def create_app() -> FastAPI:
    """Build the app: error rendering, CORS for the web app, slice routers and `/health`."""
    settings = get_settings()
    # `core.auth` reads the signed-in account's row through identity, which it cannot import.
    bind_account_lookup(identity_accounts.lookup_account)
    app = FastAPI(title="Eventtz API", version="1.0.0", lifespan=_lifespan)
    register_error_handlers(app)
    _plug_in_adapters(app)
    # Added before CORS so CORS wraps it: preflight answers carry no request id, every other one does.
    app.add_middleware(RequestContextMiddleware)
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


configure_logging(get_settings())
configure_sentry(get_settings())
app = create_app()
