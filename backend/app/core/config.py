"""App settings loaded from environment variables and ``backend/.env``.

Field names use snake_case; matching env vars use UPPER_SNAKE
(e.g. ``frontend_url`` comes from ``FRONTEND_URL``).
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    #: Website addresses allowed to call this API from a browser (comma-separated).
    #: In production, set this in your host env — don't hardcode live domains here.
    #: Your ``FRONTEND_URL`` is always included automatically.
    cors_allowed_origins: str = (
        "http://localhost:3000, http://127.0.0.1:3000"
    )

    #: Database / auth project URL and secret key (server-only — never put in the browser).
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    #: When true, skip real login/database setup for local tinkering.
    local_auth_mode: bool = False

    #: How much detail to write to logs (e.g. INFO, WARNING, DEBUG).
    log_level: str = "INFO"
    #: True on the live server: shorter log lines. False on a laptop: easier-to-read blocks.
    is_production: bool = False
    log_dir: str = "logs"
    log_file_name: str = "eventtz.log"
    #: Start a new log file after this many bytes (keeps disk use under control).
    log_max_bytes: int = 10_000_000
    #: How many old log files to keep.
    log_backup_count: int = 3

    #: Largest single extra cost (travel, add-ons, etc.) a vendor can add before the booking is accepted.
    booking_max_adjustment_gbp: float = 5_000.0
    #: Largest total of those extras, as a percentage of the quoted package prices (discounts don't count here).
    booking_max_adjustment_pct_of_subtotal: float = 100.0

    #: Folder name in storage where images are kept.
    media_images_bucket: str = "eventtz-images"
    #: Max size for videos and documents (e.g. certificates). Photos have no size limit in the app.
    media_max_file_upload_bytes: int = 50_000_000

    #: Key for AI helpers (vendor bio, search). Which AI models we use lives in ``constants.py``.
    openai_api_key: str = ""
    #: How long (seconds) to reuse a marketplace search AI result before asking again.
    marketplace_search_ai_cache_ttl_seconds: int = 3600
    #: Max number of those search results to keep in memory.
    marketplace_search_ai_cache_max_entries: int = 500

    #: Key for looking up UK addresses (Ordnance Survey Places). Leave blank if unused.
    os_places_api_key: str = ""
    #: Backup address lookup key (getAddress.io) if the Places key above is empty.
    getaddress_api_key: str = ""

    #: Public website URL — used for payment “back to site” / success / cancel links.
    frontend_url: str = "http://localhost:3000"

    #: Payment provider keys: secret for server calls; webhook secret to verify payment events.
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""

    #: Hours after the event day ends before we automatically pay the vendor
    #: (only if the client has paid and no problem report is open).
    booking_payout_auto_release_hours_after_event: int = 48

    #: Comma-separated emails that count as top-level admins until roles are set in the database.
    super_admin_emails: str = "hello@fourintegers.com"
    #: Key for sending transactional email.
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
        """On a laptop, allow the site on any local port (browsers send slightly different origins)."""
        return r"https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?"


@lru_cache
def get_settings() -> Settings:
    return Settings()
