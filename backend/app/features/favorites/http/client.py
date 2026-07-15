"""Client favourites HTTP routes."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response

from app.contracts.favorites import ClientFavoritesListResponse, ClientFavoritesMergeBody
from app.features.auth.http.guards import require_client
from app.features.favorites.service import (
    add_saved_vendor,
    list_saved_vendor_ids,
    merge_saved_vendors,
    remove_saved_vendor,
)

router = APIRouter(prefix="/client", tags=["client"])


@router.get("/favorites", response_model=ClientFavoritesListResponse)
def get_client_favorites(request: Request, response: Response) -> ClientFavoritesListResponse:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    return ClientFavoritesListResponse(success=True, vendor_user_ids=list_saved_vendor_ids(uid))


@router.put("/favorites/{vendor_user_id}")
def put_client_favorite(
    vendor_user_id: str,
    request: Request,
    response: Response,
) -> dict[str, bool]:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    ok = add_saved_vendor(client_user_id=uid, vendor_user_id=vendor_user_id)
    return {"success": ok}


@router.delete("/favorites/{vendor_user_id}")
def delete_client_favorite(
    vendor_user_id: str,
    request: Request,
    response: Response,
) -> dict[str, bool]:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    ok = remove_saved_vendor(client_user_id=uid, vendor_user_id=vendor_user_id)
    return {"success": ok}


@router.post("/favorites/merge")
def post_merge_client_favorites(
    body: ClientFavoritesMergeBody,
    request: Request,
    response: Response,
) -> dict[str, int | bool]:
    user = require_client(request, response)
    uid = str(user.get("id") or "")
    count = merge_saved_vendors(client_user_id=uid, vendor_user_ids=body.vendor_user_ids)
    return {"success": True, "merged": count}
