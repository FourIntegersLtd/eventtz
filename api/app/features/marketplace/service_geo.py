"""UK address lookup. Switched off, as in the baseline: clients type venue addresses as free text.

The routes still answer, reporting that no provider is configured, so the web keeps
working. Wiring in OS Places or getAddress means an adapter behind a port in `core`.
"""

from __future__ import annotations

from app.features.marketplace.errors import AddressNotResolved, InvalidAddressId
from app.features.marketplace.schemas import (
    AddressAutocompleteResponse,
    AddressFindResponse,
    AddressResolveResponse,
)

# Longer ids are rejected before any lookup.
MAX_ADDRESS_ID_LENGTH = 500


def find_by_postcode(postcode: str) -> AddressFindResponse:
    """Every address at a postcode: none, since no provider is configured."""
    return AddressFindResponse(addresses=[], provider_configured=False)


def autocomplete(term: str) -> AddressAutocompleteResponse:
    """Address suggestions: none, since no provider is configured."""
    return AddressAutocompleteResponse(suggestions=[], provider_configured=False)


def resolve(address_id: str) -> AddressResolveResponse:
    """One address's parts; always not found, since no provider is configured."""
    if len(address_id) > MAX_ADDRESS_ID_LENGTH:
        raise InvalidAddressId()
    raise AddressNotResolved()
