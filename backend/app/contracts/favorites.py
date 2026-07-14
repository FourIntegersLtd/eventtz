"""Favorites API contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ClientFavoritesListResponse(BaseModel):
    success: bool = True
    vendor_user_ids: list[str] = Field(default_factory=list)


class ClientFavoritesMergeBody(BaseModel):
    vendor_user_ids: list[str] = Field(default_factory=list, max_length=500)
