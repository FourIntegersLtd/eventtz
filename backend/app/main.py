"""Main FastAPI app — wires middleware, routes, and startup checks."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import register_error_handlers
from app.core.logging import get_logger, setup_logging
from app.core.startup import validate_settings
from app.http.router import api_router

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    settings = get_settings()
    validate_settings(settings)
    yield


app = FastAPI(
    title="Eventtz API",
    version="0.1.0",
    lifespan=lifespan,
)

register_error_handlers(app)

settings = get_settings()
logger.info(
    "Config loaded (cors_origins=%s, supabase_configured=%s, local_auth_mode=%s, log_level=%s)",
    len(settings.cors_origins_list),
    bool(settings.supabase_url and settings.supabase_service_role_key),
    settings.local_auth_mode,
    settings.log_level,
)
if settings.local_auth_mode:
    logger.warning(
        "LOCAL_AUTH_MODE is enabled. Auth uses in-memory mock users and sessions (no Supabase). "
        "Data resets on backend restart."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=settings.cors_allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health():
    logger.debug("health check")
    return {"status": "ok"}
