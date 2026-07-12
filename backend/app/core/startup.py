"""Startup configuration validation."""

from __future__ import annotations

from app.core.config import Settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def validate_settings(settings: Settings) -> None:
    """Fail fast or warn on missing integration keys."""
    if not settings.local_auth_mode:
        if not settings.supabase_url.strip():
            raise RuntimeError(
                "SUPABASE_URL is required when LOCAL_AUTH_MODE is false. "
                "Set it in backend/.env or enable LOCAL_AUTH_MODE for local dev."
            )
        if not settings.supabase_service_role_key.strip():
            raise RuntimeError(
                "SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) is required when "
                "LOCAL_AUTH_MODE is false."
            )

    if settings.is_production:
        if not settings.stripe_secret_key.strip():
            logger.warning(
                "STRIPE_SECRET_KEY is not set — payment routes will fail at runtime."
            )
        if not settings.stripe_webhook_secret.strip():
            logger.warning(
                "STRIPE_WEBHOOK_SECRET is not set — Stripe webhooks will be rejected."
            )

    # UK address lookup disabled — clients enter venue as free text (see uk_address.py).
    # if not settings.os_places_api_key.strip() and not settings.getaddress_api_key.strip():
    #     logger.warning(
    #         "Neither OS_PLACES_API_KEY nor GETADDRESS_API_KEY is set — "
    #         "UK address lookup will return empty results."
    #     )
    # elif settings.getaddress_api_key.strip() and not settings.os_places_api_key.strip():
    #     from app.features.geo.getaddress import getaddress_autocomplete
    #
    #     _, provider_ok = getaddress_autocomplete("ab")
    #     if not provider_ok:
    #         logger.error(
    #             "GETADDRESS_API_KEY is set but getAddress.io rejected it (401/403). "
    #             "Use the API Key (not Administration Key). If the key is correct, check "
    #             "getAddress → Security → IP whitelist, or regenerate the key at https://getaddress.io/."
    #         )
