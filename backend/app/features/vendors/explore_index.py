"""Keep explore search fields on the vendor row in sync when the profile is saved."""

from __future__ import annotations

from typing import Any

from app.core.logging import get_logger
from app.features.vendors.markets import get_market, normalize_country_code
from app.features.vendors.list_pricing import min_listing_price_gbp

logger = get_logger(__name__)


def _services_offered_keys(payload: dict[str, Any]) -> list[str]:
    raw = payload.get("servicesOffered")
    if not isinstance(raw, list):
        return []
    return [str(x).strip() for x in raw if str(x).strip()]


def explore_search_patch_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Search columns to write on the vendor row when the profile is saved."""
    country_code = normalize_country_code(
        str(payload.get("countryCode") or payload.get("country_code") or ""),
    )
    market = get_market(country_code)
    min_price = min_listing_price_gbp(payload)
    base_city = payload.get("baseCity")
    city_norm = base_city.strip().lower() if isinstance(base_city, str) and base_city.strip() else None
    services = _services_offered_keys(payload)
    return {
        "country_code": country_code,
        "currency": market.currency,
        "min_list_price_gbp": round(float(min_price), 2) if min_price is not None else None,
        "base_city_normalized": city_norm,
        "services_offered": services or None,
    }
