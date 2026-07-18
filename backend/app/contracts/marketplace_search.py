"""Shared types for AI-parsed marketplace search queries."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, Field

MatchTier = Literal["exact", "related", "fallback"]
SearchMode = Literal["simple", "plan"]


class MarketplacePlanNeed(BaseModel):
    """One checklist item in an event-planning search (maps to a marketplace service)."""

    id: str = Field(max_length=64)
    label: str = Field(max_length=80)
    service_key: str = Field(max_length=40)
    keywords: list[str] = Field(default_factory=list, max_length=8)
    optional: bool = False
    # Parse/AI source copy. HTTP sections expose the same text as ``why``.
    rationale: str | None = Field(default=None, max_length=160)


class MarketplaceQueryParseResult(BaseModel):
    """Keywords and filters extracted from a natural-language vendor search query."""

    mode: SearchMode = "simple"
    keywords: list[str] = Field(default_factory=list, max_length=16)
    location: str | None = Field(default=None, max_length=120)
    types: list[str] = Field(default_factory=list)
    event_types: list[str] = Field(default_factory=list)
    # Looser match hints (related results, not exact matches)
    related_keywords: list[str] = Field(default_factory=list, max_length=16)
    related_types: list[str] = Field(default_factory=list)
    related_locations: list[str] = Field(default_factory=list, max_length=12)
    intent_summary: str | None = Field(default=None, max_length=160)
    plan_title: str | None = Field(default=None, max_length=160)
    needs: list[MarketplacePlanNeed] = Field(default_factory=list, max_length=6)


@dataclass
class MarketplaceSearchSection:
    need_id: str
    label: str
    service_key: str
    optional: bool = False
    vendors: list[dict[str, Any]] = field(default_factory=list)
    # Full unclaimed matching pool size (may exceed len(vendors) when capped).
    total_count: int = 0
    # Client-facing sentence (from need.rationale / why_for_need).
    why: str | None = None


@dataclass
class MarketplaceSearchPlan:
    title: str
    event_types: list[str] = field(default_factory=list)
    needs: list[MarketplacePlanNeed] = field(default_factory=list)
    intent_summary: str | None = None


@dataclass
class MarketplaceSearchResult:
    """Marketplace search result: vendors ordered exact match, then related, then fallback."""

    vendors: list[dict[str, Any]] = field(default_factory=list)
    match_notice: str | None = None
    has_exact: bool = False
    has_related: bool = False
    total_count: int = 0
    search_mode: SearchMode = "simple"
    intent_summary: str | None = None
    plan: MarketplaceSearchPlan | None = None
    sections: list[MarketplaceSearchSection] = field(default_factory=list)
