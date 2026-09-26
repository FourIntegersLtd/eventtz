"""Client routes: saved vendors (favourites) and UK address lookup."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.auth import ROLE_ERRORS, CurrentClient
from app.core.db import SessionDep
from app.core.errors import error_responses
from app.features.marketplace import service_favorites, service_geo
from app.features.marketplace.errors import AddressNotResolved, InvalidAddressId
from app.features.marketplace.schemas import (
    AddressAutocompleteResponse,
    AddressFindResponse,
    AddressResolveResponse,
    ClientFavoriteResponse,
    ClientFavoritesListResponse,
    ClientFavoritesMergeBody,
    ClientFavoritesMergeResponse,
)

router = APIRouter(prefix="/client")


@router.get(
    "/favorites",
    tags=["client"],
    response_model=ClientFavoritesListResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def get_client_favorites(session: SessionDep, client: CurrentClient) -> ClientFavoritesListResponse:
    """The client's saved vendors, most recently saved first."""
    return ClientFavoritesListResponse(
        vendor_user_ids=await service_favorites.saved_vendor_ids(session, client)
    )


@router.put(
    "/favorites/{vendor_user_id}",
    tags=["client"],
    response_model=ClientFavoriteResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def put_client_favorite(
    session: SessionDep, client: CurrentClient, vendor_user_id: str
) -> ClientFavoriteResponse:
    """Save a vendor; `success` is false when the id is not a known account."""
    return ClientFavoriteResponse(
        success=await service_favorites.save_vendor(session, client, vendor_user_id)
    )


@router.delete(
    "/favorites/{vendor_user_id}",
    tags=["client"],
    response_model=ClientFavoriteResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def delete_client_favorite(
    session: SessionDep, client: CurrentClient, vendor_user_id: str
) -> ClientFavoriteResponse:
    """Unsave a vendor."""
    return ClientFavoriteResponse(
        success=await service_favorites.unsave_vendor(session, client, vendor_user_id)
    )


@router.post(
    "/favorites/merge",
    tags=["client"],
    response_model=ClientFavoritesMergeResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def post_merge_client_favorites(
    session: SessionDep, client: CurrentClient, body: ClientFavoritesMergeBody
) -> ClientFavoritesMergeResponse:
    """Add the vendors saved while signed out to the account."""
    return ClientFavoritesMergeResponse(
        merged=await service_favorites.merge_saved_vendors(session, client, body.vendor_user_ids)
    )


@router.get(
    "/geo/address-find",
    tags=["client-geo"],
    response_model=AddressFindResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def get_address_find(
    client: CurrentClient,
    postcode: str = Query(
        ...,
        min_length=4,
        max_length=16,
        description="UK postcode - returns all street-level addresses at that postcode",
    ),
) -> AddressFindResponse:
    """Every address at a postcode (no provider is configured, so always empty)."""
    return service_geo.find_by_postcode(postcode)


@router.get(
    "/geo/address-autocomplete",
    tags=["client-geo"],
    response_model=AddressAutocompleteResponse,
    responses=error_responses(*ROLE_ERRORS),
)
async def get_address_autocomplete(
    client: CurrentClient,
    term: str = Query(..., min_length=2, max_length=200, description="Postcode or partial address"),
) -> AddressAutocompleteResponse:
    """Address suggestions (no provider is configured, so always empty)."""
    return service_geo.autocomplete(term)


@router.get(
    "/geo/address-resolve/{address_id}",
    tags=["client-geo"],
    response_model=AddressResolveResponse,
    responses=error_responses(*ROLE_ERRORS, InvalidAddressId, AddressNotResolved),
)
async def get_address_resolve(client: CurrentClient, address_id: str) -> AddressResolveResponse:
    """One address's parts (no provider is configured, so always not found)."""
    return service_geo.resolve(address_id)
