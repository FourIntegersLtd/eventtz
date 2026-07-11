"""
UK address lookup — routes to one provider.

**OS Places API** (``OS_PLACES_API_KEY``) — Ordnance Survey address search. This is **not** the OS Maps API;
you must add the **OS Places API** product to your OS Data Hub project (APIs → search "Places").

**getAddress.io** (``GETADDRESS_API_KEY``) — alternative if you do not use OS Places.

If ``OS_PLACES_API_KEY`` is set, it takes priority; otherwise getAddress is used when configured.
"""

from __future__ import annotations

from typing import Any

from app.core.config import get_settings
from app.features.geo.getaddress import (
    getaddress_autocomplete,
    getaddress_find_by_postcode,
    getaddress_get_by_id,
)
from app.features.geo.os_places import (
    os_places_autocomplete,
    os_places_find_by_postcode,
    os_places_get_by_uprn,
)


def _use_os_places() -> bool:
    return bool((get_settings().os_places_api_key or "").strip())


def _use_getaddress() -> bool:
    return bool((get_settings().getaddress_api_key or "").strip())


def uk_address_provider_configured() -> bool:
    """Whether a real address-lookup provider (OS Places or getAddress.io) is set up."""
    return _use_os_places() or _use_getaddress()


def uk_address_autocomplete(term: str) -> tuple[list[dict[str, str]], bool]:
    """Returns (suggestions, provider_usable). provider_usable is False when credentials are rejected."""
    if _use_os_places():
        return os_places_autocomplete(term), True
    if _use_getaddress():
        return getaddress_autocomplete(term)
    return [], False


def uk_address_find_by_postcode(postcode: str) -> tuple[list[str], bool]:
    if _use_os_places():
        return os_places_find_by_postcode(postcode), True
    if _use_getaddress():
        return getaddress_find_by_postcode(postcode)
    return [], False


def uk_address_resolve(address_id: str) -> dict[str, Any] | None:
    """
    Resolve a selection from autocomplete.

    OS Places uses numeric UPRN ids; getAddress uses opaque string ids from their API.
    """
    s = address_id.strip()
    if not s:
        return None
    if s.isdigit() and _use_os_places():
        row = os_places_get_by_uprn(s)
        if row:
            return row
    if _use_getaddress():
        return getaddress_get_by_id(s)
    return None
