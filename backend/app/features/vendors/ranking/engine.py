"""Deterministic vendor ranking for the AI Event Planner (and future explore use)."""

from __future__ import annotations

from typing import Any

from app.features.vendors.ranking.signals import extract_features
from app.features.vendors.ranking.types import RankedVendor, RankingContext, ScoreBreakdown
from app.features.vendors.ranking.weights import RANKING_WEIGHTS


class VendorRankingEngine:
    """Score and rank vendor rows using fixed weights + normalized signals."""

    def __init__(self, weights: dict[str, float] | None = None) -> None:
        self.weights = dict(weights or RANKING_WEIGHTS)

    def score_one(self, row: dict[str, Any], ctx: RankingContext) -> RankedVendor:
        features = extract_features(row, ctx)
        contributions: dict[str, float] = {}
        total = 0.0
        for key, weight in self.weights.items():
            feat = float(features.get(key, 0.5))
            contrib = weight * feat
            contributions[key] = round(contrib, 6)
            total += contrib
        rounded_total = round(total, 6)
        breakdown = ScoreBreakdown(
            features={k: round(v, 6) for k, v in features.items()},
            contributions=contributions,
            total=rounded_total,
        )
        return RankedVendor(
            user_id=str(row.get("user_id") or ""),
            score=rounded_total,
            breakdown=breakdown,
            row=row,
        )

    def score_many(
        self,
        rows: list[dict[str, Any]],
        ctx: RankingContext,
    ) -> list[RankedVendor]:
        return [self.score_one(r, ctx) for r in rows if isinstance(r, dict) and r.get("user_id")]

    def rank(
        self,
        rows: list[dict[str, Any]],
        ctx: RankingContext,
        *,
        limit: int | None = None,
        exclude_user_ids: set[str] | None = None,
    ) -> list[RankedVendor]:
        """Score then sort by score DESC, user_id ASC for stable ties."""
        excluded = exclude_user_ids or set()
        scored = [
            rv
            for rv in self.score_many(rows, ctx)
            if rv.user_id and rv.user_id not in excluded
        ]
        scored.sort(key=lambda rv: (-rv.score, rv.user_id))
        if limit is not None:
            return scored[: max(0, limit)]
        return scored
