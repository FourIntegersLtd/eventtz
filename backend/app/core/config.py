"""Application settings (env / .env).

Pydantic Settings maps ``snake_case`` fields to ``SCREAMING_SNAKE`` env vars automatically
(e.g. ``frontend_url`` ← ``FRONTEND_URL``). ``AliasChoices`` is only used when a field
must accept *more than one* historical env name.
"""

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    #: Comma-separated browser Origins allowed to call the API (credentials/cookies).
    #: Production: set via env on Railway — do not hardcode domains here.
    #: ``FRONTEND_URL`` is merged into the effective list automatically (see ``cors_origins_list``).
    cors_allowed_origins: str = (
        "http://localhost:3000, http://127.0.0.1:3000"
    )
    supabase_url: str = ""
    #: Prefer ``SUPABASE_SERVICE_ROLE_KEY``; ``SUPABASE_KEY`` kept as a legacy alias.
    supabase_service_role_key: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_KEY"),
    )
    local_auth_mode: bool = False
    log_level: str = "INFO"
    # Logging: production uses compact lines; dev uses multi-line blocks (see core/logging.py)
    is_production: bool = False
    log_dir: str = "logs"
    log_file_name: str = "eventtz.log"
    log_max_bytes: int = 10_000_000
    log_backup_count: int = 3

    booking_max_adjustment_gbp: float = 50_000.0
    booking_max_adjustment_pct_of_subtotal: float = 200.0

    # Media (Supabase Storage)
    media_images_bucket: str = "eventtz-images"
    #: Cap for video/document uploads (portfolio video, certificates). Images have no app size limit.
    media_max_file_upload_bytes: int = 50_000_000

    # OpenAI (vendor onboarding + marketplace search) — key only; model ids in core/constants.py
    openai_api_key: str = ""
    marketplace_search_ai_cache_ttl_seconds: int = 3600
    marketplace_search_ai_cache_max_entries: int = 500

    #: UK address lookup — Ordnance Survey **OS Places API** (not OS Maps). See ``uk_address_service``.
    #: ``OS_DATA_HUB_API_KEY`` accepted as a legacy alias for the same Places key.
    os_places_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("OS_PLACES_API_KEY", "OS_DATA_HUB_API_KEY"),
    )
    #: Alternative: getAddress.io when OS Places is not used (``OS_PLACES_API_KEY`` empty).
    getaddress_api_key: str = ""

    #: Base URL of the deployed frontend — used to build Stripe return/refresh/success/cancel URLs.
    frontend_url: str = "http://localhost:3000"

    # Stripe Connect (vendor payouts) + Checkout (client payments)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    #: Hours after the event (end of event day UTC) before the vendor payout is
    #: released automatically when the client has paid and no dispute is open.
    booking_payout_auto_release_hours_after_event: int = 48

    #: Comma-separated emails treated as super_admin when DB admin_role is not set yet.
    super_admin_emails: str = "hello@fourintegers.com"
    resend_api_key: str = ""

    @property
    def super_admin_emails_list(self) -> list[str]:
        return [e.strip().lower() for e in self.super_admin_emails.split(",") if e.strip()]

    @property
    def cors_origins_list(self) -> list[str]:
        origins: list[str] = [
            origin.strip()
            for origin in self.cors_allowed_origins.split(",")
            if origin.strip()
        ]
        frontend = self.frontend_url.strip().rstrip("/")
        if frontend and frontend not in origins:
            origins.append(frontend)
        return origins

    @property
    def cors_allow_origin_regex(self) -> str | None:
        """Allow any localhost port (incl. [::1]) — browsers vary Origin on dev machines."""
        return r"https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?"


@lru_cache
def get_settings() -> Settings:
    return Settings()
