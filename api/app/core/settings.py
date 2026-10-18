"""Settings read from environment variables, falling back to `api/.env`.

Shaped like OSCE's `platform-api` settings: one `Settings` object, read once.
Local and test processes get working defaults filled in by the validator at the
bottom; a staging or production process refuses to start with any of
`REQUIRED_WHEN_DEPLOYED` missing.

Every field is documented in `api/.env.example`. Add a field here only when a
slice actually reads it; unused settings are how config drifts. Environment
variables always win over the `.env` file (pydantic-settings rule), which is
what lets the acceptance harness point the API at its own database.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Final

from fastapi import Depends
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# The `api/` folder. Used to find `.env`, `alembic.ini` and to write `openapi.json`.
API_ROOT = Path(__file__).resolve().parents[2]

# Any localhost / 127.0.0.1 / [::1] origin on any port. The baseline allows these
# in every environment so a developer's local web app can call a deployed API.
LOCAL_ORIGIN_REGEX = r"https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?"


class AppEnv(StrEnum):
    """Which environment this process is running as."""

    local = "local"
    test = "test"
    staging = "staging"
    production = "production"


# The docker-compose Postgres (`make db-up`). Port 5434 so OSCE's :5433 can run alongside.
_LOCAL_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5434/eventtz"
_LOCAL_JWT_SECRET = "dev-only-jwt-secret-change-me"  # noqa: S105 — local and test only
_LOCAL_FRONTEND_URL = "http://localhost:3000"

# The values a deployed process refuses to start without, named once so the
# validator and `.env.example` cannot disagree about what they are.
REQUIRED_WHEN_DEPLOYED: Final[tuple[str, ...]] = (
    "JWT_SECRET",
    "DATABASE_URL",
    "FRONTEND_URL",
    "RESEND_API_KEY",
)


class Settings(BaseSettings):
    """Typed view of the API's configuration. Field names map to UPPER_CASE env vars."""

    model_config = SettingsConfigDict(env_file=API_ROOT / ".env", env_file_encoding="utf-8", extra="ignore")

    app_env: AppEnv = AppEnv.local

    # --- Persistence (ADR 0002) ---
    database_url: str = ""
    # Per process: up to pool_size + max_overflow connections. In production every one of them is
    # a client of Supabase's session pooler, which caps clients at the plan's pool size (ADR 0002).
    database_pool_size: int = 10
    database_max_overflow: int = 10
    # Logs every SQL statement. Local debugging only.
    database_echo: bool = False

    # --- Ephemeral state (ADR 0009) ---
    # Rate-limit counters and the live-update bus. Optional: with Redis off, limits
    # are not enforced and live updates stay inside one process.
    redis_url: str = "redis://localhost:6381/0"
    redis_disabled: bool = False
    # Set by Railway itself on every deployed service, never by us. When present,
    # the visitor's address comes from the edge's `X-Real-IP` (`rate_limit.client_ip`).
    railway_environment: str = ""

    # --- Sign-in tokens (ADR 0003) ---
    jwt_secret: str = ""
    jwt_issuer: str = "eventtz"
    jwt_access_ttl_seconds: int = 15 * 60
    jwt_refresh_ttl_seconds: int = 30 * 24 * 60 * 60
    # A stream ticket is redeemed the instant it is minted; a minute is for a slow network.
    stream_ticket_ttl_seconds: int = 60

    # --- Background jobs (ADR 0008) ---
    worker_concurrency: int = 4
    # How often an idle worker looks for jobs that have become due (scheduled
    # jobs cannot be notified about, only polled for).
    worker_fetch_job_polling_seconds: float = 5.0

    # --- HTTP ---
    # Comma-separated browser origins allowed to call the API.
    cors_allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    # Public URL of the web app; used in email links and always allowed by CORS.
    frontend_url: str = ""

    # --- Observability ---
    log_level: str = "INFO"
    # Empty disables Sentry entirely.
    sentry_dsn: str = ""

    # --- Staff ---
    # Comma-separated emails treated as super admins when `users.admin_role` is not set.
    super_admin_emails: str = ""
    # Comma-separated staff inboxes for ops alerts (contact form, disputes, stuck payouts).
    admin_alert_emails: str = "hello@eventtz.com"
    # QA vendors hidden from public explore except for one test client each:
    # comma-separated `client-email:vendor-user-id` pairs. Empty = no QA vendors.
    qa_client_vendor_visibility: str = ""

    # --- Bookings ---
    # Largest single vendor surcharge on a booking, in pounds.
    booking_max_adjustment_gbp: float = 5000.0
    # Surcharges together may not exceed this percentage of the quoted line items.
    booking_max_adjustment_pct_of_subtotal: float = 100.0
    # Hours after the event day ends before a paid booking's payout is released automatically.
    booking_payout_auto_release_hours_after_event: int = 48
    # Hours after the vendor accepts that the client has to pay; never later than the start of the
    # event day. An unpaid booking is then cancelled and the vendor's date freed.
    booking_payment_deadline_hours: int = 72
    # Hours a client enquiry may wait for the vendor's first reply before the hourly job marks it
    # VENDOR_NO_RESPONSE (a funnel signal only; the booking stays open). 0 turns the marking off.
    enquiry_response_sla_hours: int = 72

    # --- Terms of Service ---
    # The version (effective date, YYYY-MM-DD) of the Terms people must accept. It must equal
    # `termsVersion` in web/lib/policyConstants.json (a unit test checks). Raising it shows every
    # signed-in person the accept banner and emails them the change notice once.
    terms_version: str = "2026-11-16"

    # --- Marketplace search ---
    # How long a parsed search query is reused before the language model is asked again (0 = never cache).
    marketplace_search_ai_cache_ttl_seconds: int = 3600
    # Most parsed queries kept in memory per process; the oldest is dropped first.
    marketplace_search_ai_cache_max_entries: int = 500

    # --- Providers ---
    # OpenAI key for the help assistant and contact classifier. Empty switches AI features off.
    openai_api_key: str = ""
    # Model for every AI call when set, overriding each feature's constant: the no-deploy switch
    # (change it on Railway and restart). Empty = each feature's own constant (gpt-6-luna).
    openai_chat_model: str = ""
    # Reasoning effort sent to reasoning-family models (gpt-5*, gpt-6*, o*). "none" answers without
    # thinking first, which keeps the interactive paths (help, copilot, search) fast.
    openai_reasoning_effort: str = "none"
    # Resend key for outgoing email. Empty logs and skips every send.
    resend_api_key: str = ""
    # Cursor automation endpoint that triages bug/booking/payment contact messages. Empty = off.
    cursor_automation_webhook_url: str = ""
    cursor_automation_webhook_secret: str = ""

    # Stripe secret key (sk_test_… locally). Empty switches checkout, payouts and refunds off (503).
    stripe_secret_key: str = ""
    # Signing secret of the `/webhooks/stripe` endpoint (whsec_…). Empty rejects every webhook.
    stripe_webhook_secret: str = ""

    # S3 bucket for user uploads (photos, videos, certificates). Empty keys switch uploads off (503).
    aws_access_key: str = ""
    aws_secret_access_key: str = ""
    aws_s3_bucket_name: str = "eventtz"
    aws_region: str = "eu-west-2"
    # Largest general upload (`POST /media/files`) in bytes. Images have no app-level cap.
    media_max_file_upload_bytes: int = 50_000_000

    @property
    def is_deployed(self) -> bool:
        """True on staging and production: secrets are required and logs are JSON."""
        return self.app_env in (AppEnv.staging, AppEnv.production)

    @property
    def is_production(self) -> bool:
        """True only on production (Sentry environment name, stricter defaults)."""
        return self.app_env == AppEnv.production

    @property
    def log_json(self) -> bool:
        """Deployed processes log one JSON object per line; local ones log readable text."""
        return self.is_deployed

    @property
    def admin_alert_emails_list(self) -> list[str]:
        """`admin_alert_emails` split and trimmed, in the order configured."""
        return [email.strip() for email in self.admin_alert_emails.split(",") if email.strip()]

    @property
    def super_admin_emails_list(self) -> list[str]:
        """`super_admin_emails` split, trimmed and lower-cased, ready for membership checks."""
        return [email.strip().lower() for email in self.super_admin_emails.split(",") if email.strip()]

    @property
    def qa_client_vendor_visibility_map(self) -> dict[str, frozenset[str]]:
        """Lower-cased client email to the QA vendor ids only that client may see."""
        vendor_ids_by_email: dict[str, set[str]] = {}
        for pair in self.qa_client_vendor_visibility.split(","):
            client_email, separator, vendor_id = pair.strip().partition(":")
            email_key = client_email.strip().lower()
            if separator and email_key and vendor_id.strip():
                vendor_ids_by_email.setdefault(email_key, set()).add(vendor_id.strip())
        return {email: frozenset(vendor_ids) for email, vendor_ids in vendor_ids_by_email.items()}

    @property
    def qa_scoped_vendor_ids(self) -> frozenset[str]:
        """Every QA vendor id, whichever client may see it."""
        return frozenset(
            vendor_id
            for vendor_ids in self.qa_client_vendor_visibility_map.values()
            for vendor_id in vendor_ids
        )

    @property
    def cors_origins_list(self) -> list[str]:
        """Allowed CORS origins: the configured list plus `frontend_url` if it is missing."""
        origins = [origin.strip() for origin in self.cors_allowed_origins.split(",") if origin.strip()]
        frontend_origin = self.frontend_url.strip().rstrip("/")
        if frontend_origin and frontend_origin not in origins:
            origins.append(frontend_origin)
        return origins

    @model_validator(mode="after")
    def _require_secrets_when_deployed(self) -> Settings:
        """Fill in local/test defaults, or refuse to start a deployed process missing a secret."""
        if not self.is_deployed:
            self.jwt_secret = self.jwt_secret or _LOCAL_JWT_SECRET
            self.database_url = self.database_url or _LOCAL_DATABASE_URL
            self.frontend_url = self.frontend_url or _LOCAL_FRONTEND_URL
            return self
        present = {
            "JWT_SECRET": self.jwt_secret,
            "DATABASE_URL": self.database_url,
            "FRONTEND_URL": self.frontend_url,
            "RESEND_API_KEY": self.resend_api_key,
        }
        missing = [name for name in REQUIRED_WHEN_DEPLOYED if not present[name].strip()]
        if missing:
            raise ValueError(
                f"{self.app_env.value} requires these environment variables: {', '.join(missing)}"
            )
        if len(self.jwt_secret) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters in a deployed environment")
        return self


@lru_cache
def get_settings() -> Settings:
    """The process-wide settings, read once. Tests call `get_settings.cache_clear()` to reload."""
    return Settings()


SettingsDep = Annotated[Settings, Depends(get_settings)]
