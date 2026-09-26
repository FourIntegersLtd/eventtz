"""What vendors can offer and where: service and event-type keys, and the supported markets. Pure.

The keys match the web app's onboarding options; anything else a vendor sends is dropped.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

# --- services and event types ------------------------------------------------------------------------

VENDOR_SERVICE_KEYS: frozenset[str] = frozenset(
    {
        "baking",
        "catering",
        "photography",
        "makeup",
        "rentals",
        "event_planning",
        "decor",
        "dj",
        "mc",
        "hair_styling",
    },
)

VENDOR_EVENT_TYPE_KEYS: frozenset[str] = frozenset({"weddings", "birthdays", "showers", "naming_ceremonies"})


def _known_keys(raw_keys: list[str] | None, allowed: frozenset[str]) -> list[str]:
    """The allowed keys from `raw_keys`, trimmed and lower-cased, first occurrence order, no repeats."""
    known: list[str] = []
    for raw_key in raw_keys or []:
        key = str(raw_key).strip().lower()
        if key in allowed and key not in known:
            known.append(key)
    return known


def filter_service_keys(raw_keys: list[str] | None) -> list[str]:
    """The recognised service keys (e.g. `catering`) from what the vendor sent."""
    return _known_keys(raw_keys, VENDOR_SERVICE_KEYS)


def filter_event_type_keys(raw_keys: list[str] | None) -> list[str]:
    """The recognised event-type keys (e.g. `weddings`) from what the vendor sent."""
    return _known_keys(raw_keys, VENDOR_EVENT_TYPE_KEYS)


# --- markets -------------------------------------------------------------------------------------------

DistanceUnit = Literal["mi", "km"]

DEFAULT_COUNTRY_CODE = "GB"
DEFAULT_CURRENCY = "GBP"


@dataclass(frozen=True)
class MarketConfig:
    """A country Eventtz can operate in: its currency, distance unit and Stripe Connect country."""

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


def normalize_country_code(raw_code: str | None) -> str:
    """A supported country code (upper-case), or the default country for anything else."""
    code = (raw_code or "").strip().upper()
    return code if code in MARKETS else DEFAULT_COUNTRY_CODE


def get_market(country_code: str | None) -> MarketConfig:
    """The market for `country_code`, falling back to the default market."""
    return MARKETS[normalize_country_code(country_code)]


def is_market_enabled(country_code: str | None) -> bool:
    """True when the exact code (not a fallback) is a market vendors can sign up in."""
    market = MARKETS.get((country_code or "").strip().upper())
    return bool(market and market.enabled)
