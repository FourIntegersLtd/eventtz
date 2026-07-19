"""Tunable ranking weights for VendorRankingEngine (single source of truth)."""

from __future__ import annotations

# Sum ≈ 1.0. Missing signals score as neutral (0.5) so new vendors are not hard-zeroed.
RANKING_WEIGHTS: dict[str, float] = {
    "rating_quality": 0.22,  # avg × log1p(review_count)
    "completed_bookings": 0.18,
    "conversion_rate": 0.12,
    "response_speed": 0.12,  # inverse of avg_response_seconds
    "budget_fit": 0.16,  # min_list_price vs per-need budget band
    "location_fit": 0.10,  # city / related city (no lat/lng in v1)
    "event_experience": 0.06,  # event_types overlap in payload
    "recency": 0.04,  # updated_at freshness
}
