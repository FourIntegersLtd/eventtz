"""Shared types for AI-parsed marketplace search queries."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, Field

MatchTier = Literal["exact", "related", "fallback"]


class MarketplaceQueryParseResult(BaseModel):
    """Keywords and filters extracted from a natural-language vendor search query."""

    keywords: list[str] = Field(default_factory=list, max_length=16)
    location: str | None = Field(default=None, max_length=120)
    types: list[str] = Field(default_factory=list)
    event_types: list[str] = Field(default_factory=list)
    # Looser match hints (related results, not exact matches)
    related_keywords: list[str] = Field(default_factory=list, max_length=16)
    related_types: list[str] = Field(default_factory=list)
    related_locations: list[str] = Field(default_factory=list, max_length=12)
    intent_summary: str | None = Field(default=None, max_length=160)


@dataclass
class MarketplaceSearchResult:
    """Marketplace search result: vendors ordered exact match, then related, then fallback."""

    vendors: list[dict[str, Any]] = field(default_factory=list)
    match_notice: str | None = None
    has_exact: bool = False
    has_related: bool = False
    total_count: int = 0
