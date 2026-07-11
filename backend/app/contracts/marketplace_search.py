"""Structured LLM output for marketplace free-text query parsing."""

from __future__ import annotations

from pydantic import BaseModel, Field


class MarketplaceQueryParseResult(BaseModel):
    """Keywords and filters extracted from a natural-language vendor search query."""

    keywords: list[str] = Field(default_factory=list, max_length=16)
    location: str | None = Field(default=None, max_length=120)
    types: list[str] = Field(default_factory=list)
    event_types: list[str] = Field(default_factory=list)
