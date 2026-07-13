"""Tests for marketplace LLM parse sanitization and tiered search."""

from __future__ import annotations

from unittest.mock import patch

from app.features.vendors.search import search_approved_vendors
from app.features.vendors.search_ai import (
    fallback_parse_marketplace_query,
    sanitize_marketplace_parse_result,
)


def test_sanitize_related_fields_dedupes_and_filters_types():
    result = sanitize_marketplace_parse_result(
        {
            "keywords": ["small", "chops", "small"],
            "related_keywords": ["chops", "canapes", "finger food"],
            "location": "Leeds",
            "related_locations": ["Leeds", "Bradford", "Wakefield"],
            "types": ["catering", "not_a_real_type"],
            "related_types": ["catering", "baking"],
            "event_types": ["weddings", "nonsense"],
            "intent_summary": "Caterers in Leeds for small chops",
        },
    )
    assert result.keywords == ["small", "chops"]
    assert "chops" not in result.related_keywords
    assert "canapes" in result.related_keywords
    assert result.location == "Leeds"
    assert "leeds" not in result.related_locations
    assert "bradford" in result.related_locations
    assert result.types == ["catering"]
    assert result.related_types == ["baking"]
    assert result.event_types == ["weddings"]
    assert result.intent_summary == "Caterers in Leeds for small chops"


def test_fallback_parse_maps_baker_to_baking():
    result = fallback_parse_marketplace_query("baker in manchester")
    assert "baking" in result.types
    assert "baker" in result.keywords
    assert result.intent_summary


def _vendor(
    user_id: str,
    *,
    city: str,
    services: list[str],
    bio: str = "",
    weekdays: list[int] | None = None,
    blocked: list[str] | None = None,
) -> dict:
    return {
        "user_id": user_id,
        "email": f"{user_id}@example.com",
        "status": "complete",
        "approval_status": "approved",
        "updated_at": "2026-01-01T12:00:00+00:00",
        "payload": {
            "baseCity": city,
            "businessName": f"Biz {user_id}",
            "servicesOffered": services,
            "eventTypes": ["weddings"],
            "aiBioDraft": bio,
            "availableWeekdays": weekdays if weekdays is not None else [0, 1, 2, 3, 4, 5, 6],
            "blockedDates": blocked or [],
            "packages": [{"title": "Standard", "price": "500"}],
        },
    }


def test_search_tiers_exact_related_fallback():
    rows = [
        _vendor("exact1", city="Leeds", services=["catering"], bio="small chops and jollof"),
        _vendor("related1", city="Bradford", services=["catering"], bio="party catering"),
        _vendor("other1", city="London", services=["photography"], bio="portraits"),
    ]
    parsed = sanitize_marketplace_parse_result(
        {
            "keywords": ["small chops"],
            "related_keywords": ["party food"],
            "location": "Leeds",
            "related_locations": ["Bradford"],
            "types": ["catering"],
            "related_types": [],
            "event_types": [],
            "intent_summary": "Caterers in Leeds for small chops",
        },
    )

    with (
        patch("app.features.vendors.search.list_approved_vendors_for_explore", return_value=rows),
        patch("app.features.vendors.search.parse_marketplace_query", return_value=parsed),
        patch(
            "app.features.bookings.reviews.merge_review_stats_into_vendor_rows",
            side_effect=lambda xs: xs,
        ),
    ):
        result = search_approved_vendors(q="someone in leeds selling small chops")

    tiers = {r["user_id"]: r["match_tier"] for r in result.vendors}
    assert tiers["exact1"] == "exact"
    assert tiers["related1"] == "related"
    assert "other1" not in tiers or tiers.get("other1") != "exact"
    assert result.has_exact is True
    assert result.has_related is True
    assert result.vendors[0]["user_id"] == "exact1"


def test_search_fallback_when_no_exact_or_related():
    rows = [
        _vendor("photo1", city="Bristol", services=["photography"], bio="studio"),
        _vendor("bake1", city="Bath", services=["baking"], bio="wedding cakes"),
    ]
    parsed = sanitize_marketplace_parse_result(
        {
            "keywords": ["zzzznotfound"],
            "related_keywords": [],
            "location": "Leeds",
            "related_locations": [],
            "types": ["catering"],
            "related_types": [],
            "event_types": [],
            "intent_summary": "Caterers in Leeds",
        },
    )

    with (
        patch("app.features.vendors.search.list_approved_vendors_for_explore", return_value=rows),
        patch("app.features.vendors.search.parse_marketplace_query", return_value=parsed),
        patch(
            "app.features.bookings.reviews.merge_review_stats_into_vendor_rows",
            side_effect=lambda xs: xs,
        ),
    ):
        result = search_approved_vendors(q="caterer in leeds zzzznotfound")

    assert result.vendors, "should never return empty when approved vendors exist"
    assert all(r["match_tier"] == "fallback" for r in result.vendors)
    assert result.has_exact is False
    assert result.match_notice


def test_date_miss_lands_in_related():
    # 2026-07-13 is a Monday (weekday 0)
    rows = [
        _vendor(
            "busy1",
            city="Leeds",
            services=["catering"],
            bio="small chops",
            weekdays=[5, 6],  # weekends only
        ),
        _vendor(
            "free1",
            city="Leeds",
            services=["catering"],
            bio="small chops",
            weekdays=[0, 1, 2, 3, 4, 5, 6],
        ),
    ]
    parsed = sanitize_marketplace_parse_result(
        {
            "keywords": ["small chops"],
            "related_keywords": [],
            "location": "Leeds",
            "related_locations": [],
            "types": ["catering"],
            "related_types": [],
            "event_types": [],
            "intent_summary": "Caterers in Leeds",
        },
    )

    with (
        patch("app.features.vendors.search.list_approved_vendors_for_explore", return_value=rows),
        patch("app.features.vendors.search.parse_marketplace_query", return_value=parsed),
        patch(
            "app.features.bookings.reviews.merge_review_stats_into_vendor_rows",
            side_effect=lambda xs: xs,
        ),
    ):
        result = search_approved_vendors(q="small chops leeds", dates="2026-07-13", flexible=False)

    tiers = {r["user_id"]: r["match_tier"] for r in result.vendors}
    assert tiers["free1"] == "exact"
    assert tiers["busy1"] == "related"
