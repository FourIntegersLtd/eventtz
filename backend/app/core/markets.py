"""Supported marketplace countries — single source of truth for location and currency defaults."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DistanceUnit = Literal["mi", "km"]

DEFAULT_COUNTRY_CODE = "GB"
DEFAULT_CURRENCY = "GBP"


@dataclass(frozen=True)
class MarketConfig:
    country_code: str
    currency: str
    distance_unit: DistanceUnit
    stripe_connect_country: str
    label: str
    enabled: bool
    default: bool


MARKETS: dict[str, MarketConfig] = {
    "GB": MarketConfig(
        country_code="GB",
        currency="GBP",
        distance_unit="mi",
        stripe_connect_country="GB",
        label="United Kingdom",
        enabled=True,
        default=True,
    ),
}


def normalize_country_code(raw: str | None) -> str:
    code = (raw or "").strip().upper()
    if code in MARKETS:
        return code
    return DEFAULT_COUNTRY_CODE


def get_market(country_code: str | None) -> MarketConfig:
    code = normalize_country_code(country_code)
    return MARKETS[code]


def default_market() -> MarketConfig:
    for market in MARKETS.values():
        if market.default:
            return market
    return MARKETS[DEFAULT_COUNTRY_CODE]


def enabled_markets() -> list[MarketConfig]:
    return [m for m in MARKETS.values() if m.enabled]


def is_market_enabled(country_code: str | None) -> bool:
    code = (country_code or "").strip().upper()
    market = MARKETS.get(code)
    return bool(market and market.enabled)


def market_location_fallback(country_code: str | None) -> str:
    return get_market(country_code).label
