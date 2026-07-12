"""Client-only UK address helpers — DISABLED (lookup commented out in uk_address.py)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.features.auth.http.guards import require_client
from app.contracts.geo_address import (
    AddressAutocompleteItem,
    AddressAutocompleteResponse,
    AddressFindResponse,
    AddressResolveResponse,
)
from app.features.geo.uk_address import (
    uk_address_autocomplete,
    uk_address_find_by_postcode,
    uk_address_provider_configured,
    uk_address_resolve,
)

router = APIRouter(prefix="/client", tags=["client-geo"])


@router.get("/geo/address-find", response_model=AddressFindResponse)
def get_address_find(
    request: Request,
    response: Response,
    postcode: str = Query(
        ...,
        min_length=4,
        max_length=16,
        description="UK postcode — returns all street-level addresses at that postcode",
    ),
) -> AddressFindResponse:
    _ = require_client(request, response)
    lines, provider_ok = uk_address_find_by_postcode(postcode)
    configured = uk_address_provider_configured() and provider_ok
    return AddressFindResponse(addresses=lines, provider_configured=configured)


@router.get("/geo/address-autocomplete", response_model=AddressAutocompleteResponse)
def get_address_autocomplete(
    request: Request,
    response: Response,
    term: str = Query(..., min_length=2, max_length=200, description="Postcode or partial address"),
) -> AddressAutocompleteResponse:
    _ = require_client(request, response)
    items, provider_ok = uk_address_autocomplete(term)
    configured = uk_address_provider_configured() and provider_ok
    return AddressAutocompleteResponse(
        suggestions=[
            AddressAutocompleteItem(id=x["id"], address=x["address"]) for x in items
        ],
        provider_configured=configured,
    )


@router.get("/geo/address-resolve/{address_id}", response_model=AddressResolveResponse)
def get_address_resolve(
    request: Request,
    response: Response,
    address_id: str,
) -> AddressResolveResponse:
    _ = require_client(request, response)
    if len(address_id) > 500:
        raise HTTPException(status_code=400, detail="Invalid address id.")
    row = uk_address_resolve(address_id)
    if not row:
        raise HTTPException(
            status_code=404,
            detail=(
                "Could not resolve that address. Configure OS_PLACES_API_KEY (OS Places API on "
                "OS Data Hub — not Maps) or GETADDRESS_API_KEY, then try again."
            ),
        )
    return AddressResolveResponse(
        postcode=row["postcode"],
        formatted_line=row["formatted_line"],
        line_1=row.get("line_1"),
        town_or_city=row.get("town_or_city"),
        county=row.get("county"),
    )
