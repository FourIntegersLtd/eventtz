"""Application settings (env / .env)."""

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
        "http://localhost:3000,http://127.0.0.1:3000"
    )
    supabase_url: str = ""
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
    #: Platform service fee as % of quoted work (line items + discount adjustments; surcharges excluded).
    booking_service_fee_percent: float = Field(
        default=5.0,
        validation_alias=AliasChoices("BOOKING_SERVICE_FEE_PERCENT"),
    )
    booking_max_adjustment_gbp: float = Field(
        default=50_000.0,
        validation_alias=AliasChoices("BOOKING_MAX_ADJUSTMENT_GBP"),
    )
    booking_max_adjustment_pct_of_subtotal: float = Field(
        default=200.0,
        validation_alias=AliasChoices("BOOKING_MAX_ADJUSTMENT_PCT_OF_SUBTOTAL"),
    )

    # Media (Supabase Storage)
    media_images_bucket: str = Field(
        default="eventtz-images",
        validation_alias=AliasChoices("MEDIA_IMAGES_BUCKET"),
    )
    media_max_upload_bytes: int = Field(
        default=8_000_000,
        validation_alias=AliasChoices("MEDIA_MAX_UPLOAD_BYTES"),
    )
    #: Larger cap for video/document uploads (portfolio video, certificates).
    media_max_file_upload_bytes: int = Field(
        default=50_000_000,
        validation_alias=AliasChoices("MEDIA_MAX_FILE_UPLOAD_BYTES"),
    )

    # OpenAI (vendor onboarding: bio + portfolio image QA)
    openai_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("OPENAI_API_KEY"),
    )
    openai_bio_model: str = Field(
        default="gpt-4o-mini",
        validation_alias=AliasChoices("OPENAI_BIO_MODEL"),
    )
    openai_vision_model: str = Field(
        default="gpt-4o-mini",
        validation_alias=AliasChoices("OPENAI_VISION_MODEL"),
    )
    openai_search_model: str = Field(
        default="gpt-4o-mini",
        validation_alias=AliasChoices("OPENAI_SEARCH_MODEL"),
    )
    marketplace_search_ai_cache_ttl_seconds: int = Field(
        default=3600,
        validation_alias=AliasChoices("MARKETPLACE_SEARCH_AI_CACHE_TTL_SECONDS"),
    )
    marketplace_search_ai_cache_max_entries: int = Field(
        default=500,
        validation_alias=AliasChoices("MARKETPLACE_SEARCH_AI_CACHE_MAX_ENTRIES"),
    )

    #: UK address lookup — Ordnance Survey **OS Places API** (not OS Maps). See ``uk_address_service``.
    os_places_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("OS_PLACES_API_KEY", "OS_DATA_HUB_API_KEY"),
    )
    #: Alternative: getAddress.io when OS Places is not used (``OS_PLACES_API_KEY`` empty).
    getaddress_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("GETADDRESS_API_KEY"),
    )

    #: Base URL of the deployed frontend — used to build Stripe return/refresh/success/cancel URLs.
    frontend_url: str = Field(
        default="http://localhost:3000",
        validation_alias=AliasChoices("FRONTEND_URL"),
    )

    # Stripe Connect (vendor payouts) + Checkout (client payments)
    stripe_secret_key: str = Field(
        default="",
        validation_alias=AliasChoices("STRIPE_SECRET_KEY"),
    )
    stripe_webhook_secret: str = Field(
        default="",
        validation_alias=AliasChoices("STRIPE_WEBHOOK_SECRET"),
    )

    #: Hours after the event (end of event day UTC) before the vendor payout is
    #: released automatically when the client has paid and no dispute is open.
    booking_payout_auto_release_hours_after_event: int = Field(
        default=48,
        validation_alias=AliasChoices("BOOKING_PAYOUT_AUTO_RELEASE_HOURS_AFTER_EVENT"),
    )

    #: Comma-separated emails treated as super_admin when DB admin_role is not set yet.
    super_admin_emails: str = Field(
        default="hello@fourintegers.com",
        validation_alias=AliasChoices("SUPER_ADMIN_EMAILS"),
    )
    #: Comma-separated ops inbox for admin alert emails (defaults to super_admin_emails).
    admin_notify_emails: str = Field(
        default="",
        validation_alias=AliasChoices("ADMIN_NOTIFY_EMAILS"),
    )
    resend_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("RESEND_API_KEY"),
    )
    email_from: str = Field(
        default="Eventtz <hello@eventtz.co.uk>",
        validation_alias=AliasChoices("EMAIL_FROM"),
    )
    email_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("EMAIL_ENABLED"),
    )

    @property
    def super_admin_emails_list(self) -> list[str]:
        return [e.strip().lower() for e in self.super_admin_emails.split(",") if e.strip()]

    @property
    def admin_notify_emails_list(self) -> list[str]:
        raw = self.admin_notify_emails.strip()
        if raw:
            return [e.strip().lower() for e in raw.split(",") if e.strip()]
        return self.super_admin_emails_list

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
