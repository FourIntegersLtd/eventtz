"""Types for vendor ranking."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class RankingContext:
    """Context for scoring a need against a vendor pool."""

    service_key: str
    location: str | None = None
    related_locations: list[str] = field(default_factory=list)
    event_types: list[str] = field(default_factory=list)
    budget_band_gbp: float | None = None  # soft per-need allocation
    keywords: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ScoreBreakdown:
    """Per-signal normalized features and weighted contributions."""

    features: dict[str, float]
    contributions: dict[str, float]
    total: float

    def as_dict(self) -> dict[str, Any]:
        return {
            "features": dict(self.features),
            "contributions": dict(self.contributions),
            "total": round(self.total, 6),
        }


@dataclass(frozen=True)
class RankedVendor:
    user_id: str
    score: float
    breakdown: ScoreBreakdown
    row: dict[str, Any]
