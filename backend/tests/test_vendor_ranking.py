"""Tests for VendorRankingEngine — deterministic scores and order."""

from __future__ import annotations

from app.features.vendors.ranking import RankingContext, VendorRankingEngine
from app.features.vendors.ranking.weights import RANKING_WEIGHTS


def _row(
    user_id: str,
    *,
    city: str = "Leeds",
    review_average: float | None = 4.8,
    review_count: int = 20,
    completed_bookings: int = 10,
    avg_response_seconds: float | None = 1800,
    conversion_rate: float | None = 0.4,
    min_list_price_gbp: float | None = 400,
    event_types: list[str] | None = None,
    updated_at: str = "2026-07-01T12:00:00+00:00",
) -> dict:
    return {
        "user_id": user_id,
        "review_average": review_average,
        "review_count": review_count,
        "completed_bookings": completed_bookings,
        "avg_response_seconds": avg_response_seconds,
        "conversion_rate": conversion_rate,
        "min_list_price_gbp": min_list_price_gbp,
        "updated_at": updated_at,
        "payload": {
            "businessName": f"Biz {user_id}",
            "baseCity": city,
            "servicesOffered": ["catering"],
            "eventTypes": event_types or ["birthdays"],
        },
    }


def test_ranking_weights_sum_near_one():
    assert abs(sum(RANKING_WEIGHTS.values()) - 1.0) < 1e-6


def test_ranking_deterministic_order():
    engine = VendorRankingEngine()
    ctx = RankingContext(
        service_key="catering",
        location="Leeds",
        event_types=["birthdays"],
        budget_band_gbp=500,
    )
    strong = _row("a-strong", review_average=4.9, review_count=40, completed_bookings=25)
    weak = _row(
        "b-weak",
        review_average=3.2,
        review_count=1,
        completed_bookings=0,
        avg_response_seconds=200000,
        conversion_rate=0.05,
        min_list_price_gbp=900,
        city="London",
    )
    mid = _row("c-mid", review_average=4.2, review_count=8, completed_bookings=5)

    ranked = engine.rank([weak, mid, strong], ctx)
    assert [r.user_id for r in ranked] == ["a-strong", "c-mid", "b-weak"]
    assert ranked[0].score > ranked[1].score > ranked[2].score
    assert "rating_quality" in ranked[0].breakdown.features
    assert ranked[0].breakdown.total == ranked[0].score


def test_ranking_tie_break_by_user_id():
    engine = VendorRankingEngine()
    ctx = RankingContext(service_key="catering", location=None)
    # Identical metrics → stable sort by user_id ASC
    rows = [
        _row("z-vendor"),
        _row("a-vendor"),
        _row("m-vendor"),
    ]
    ranked = engine.rank(rows, ctx)
    assert [r.user_id for r in ranked] == ["a-vendor", "m-vendor", "z-vendor"]


def test_ranking_exclude_user_ids():
    engine = VendorRankingEngine()
    ctx = RankingContext(service_key="catering")
    rows = [_row("keep"), _row("drop")]
    ranked = engine.rank(rows, ctx, exclude_user_ids={"drop"})
    assert [r.user_id for r in ranked] == ["keep"]
