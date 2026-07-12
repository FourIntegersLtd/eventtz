"""
UK address lookup — DISABLED (getAddress.io / OS Places commented out).

Venue addresses are free text on the client. These stubs remain so geo routes
do not break if called.
"""

from __future__ import annotations

from typing import Any

# from app.core.config import get_settings
# from app.features.geo.getaddress import (
#     getaddress_autocomplete,
#     getaddress_find_by_postcode,
#     getaddress_get_by_id,
# )
# from app.features.geo.os_places import (
#     os_places_autocomplete,
#     os_places_find_by_postcode,
#     os_places_get_by_uprn,
# )


def uk_address_provider_configured() -> bool:
    return False


def uk_address_autocomplete(_term: str) -> tuple[list[dict[str, str]], bool]:
    return [], False


def uk_address_find_by_postcode(_postcode: str) -> tuple[list[str], bool]:
    return [], False


def uk_address_resolve(_address_id: str) -> dict[str, Any] | None:
    return None
