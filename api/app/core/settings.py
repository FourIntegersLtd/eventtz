"""Settings read from environment variables, falling back to `api/.env`.

Every field is documented in `api/.env.example`. Add a field here only when a
slice actually reads it; unused settings are how config drifts.

Environment variables always win over the `.env` file (pydantic-settings rule),
which is what lets the acceptance harness point the API at local Supabase.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# The `api/` folder. Used to find `.env` and to write `openapi.json`.
API_ROOT = Path(__file__).resolve().parents[2]

# Any localhost / 127.0.0.1 / [::1] origin on any port. The baseline allows these
# in every environment so a developer's local web app can call a deployed API.
LOCAL_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?"


class Settings(BaseSettings):
    """Typed view of the API's configuration. Field names map to UPPER_CASE env vars."""

    model_config = SettingsConfigDict(env_file=API_ROOT / ".env", env_file_encoding="utf-8", extra="ignore")

    # Supabase project the API reads and writes with the service-role key (bypasses RLS).
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Comma-separated browser origins allowed to call the API with cookies.
    cors_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Public URL of the web app; used in email links and always allowed by CORS.
    frontend_url: str = "http://localhost:3000"
    # Production switches cookies to SameSite=None + Secure and compacts logs.
    is_production: bool = False
    log_level: str = "INFO"
    # Empty disables Sentry entirely.
    sentry_dsn: str = ""

    # Comma-separated emails treated as super admins when `users.admin_role` is not set.
    super_admin_emails: str = ""

    @property
    def super_admin_emails_list(self) -> list[str]:
        """`super_admin_emails` split, trimmed and lower-cased, ready for membership checks."""
        return [email.strip().lower() for email in self.super_admin_emails.split(",") if email.strip()]

    @property
    def cors_origins_list(self) -> list[str]:
        """Allowed CORS origins: the configured list plus `frontend_url` if it is missing."""
        origins = [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]
        frontend_origin = self.frontend_url.strip().rstrip("/")
        if frontend_origin and frontend_origin not in origins:
            origins.append(frontend_origin)
        return origins


@lru_cache
def get_settings() -> Settings:
    """The process-wide settings, read once. Tests call `get_settings.cache_clear()` to reload."""
    return Settings()
