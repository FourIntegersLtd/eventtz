"""Tests for marketplace LLM parse sanitization and tiered search."""

from __future__ import annotations

from unittest.mock import patch

from app.features.vendors.search import search_approved_vendors
from app.features.vendors.search_ai import (
    fallback_parse_marketplace_query,
    sanitize_marketplace_parse_result,
    why_for_need,
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
            "mode": "simple",
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
    assert result.mode == "simple"
    assert result.needs == []


def test_sanitize_plan_needs():
    result = sanitize_marketplace_parse_result(
        {
            "mode": "plan",
            "keywords": ["birthday"],
            "types": ["baking", "catering"],
            "event_types": ["birthdays"],
            "intent_summary": "Birthday vendors",
            "plan_title": "Birthday essentials",
            "needs": [
                {
                    "id": "cake",
                    "label": "Birthday cake",
                    "service_key": "baking",
                    "keywords": ["cake"],
                    "optional": False,
                },
                {
                    "id": "chops",
                    "label": "Small chops",
                    "service_key": "catering",
                    "keywords": ["small chops"],
                    "optional": False,
                },
                {
                    "id": "bad",
                    "label": "DJ",
                    "service_key": "dj",
                    "keywords": ["dj"],
                },
            ],
        },
    )
    assert result.mode == "plan"
    assert result.plan_title == "Birthday essentials"
    assert len(result.needs) == 2
    assert result.needs[0].service_key == "baking"
    assert result.needs[1].label == "Small chops"


def test_fallback_parse_maps_baker_to_baking():
    result = fallback_parse_marketplace_query("baker in manchester")
    assert "baking" in result.types
    assert "baker" in result.keywords
    assert result.intent_summary
    assert result.mode == "simple"


def test_fallback_parse_birthday_plan():
    result = fallback_parse_marketplace_query("help me select vendors for my birthday")
    assert result.mode == "plan"
    assert "birthdays" in result.event_types
    assert len(result.needs) >= 3
    assert any(n.service_key == "baking" for n in result.needs)
    assert any(n.service_key == "catering" for n in result.needs)
    assert result.plan_title


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
        patch(
            "app.features.vendors.public_metrics.merge_public_metrics_into_vendor_rows",
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
    assert result.search_mode == "simple"


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
        patch(
            "app.features.vendors.public_metrics.merge_public_metrics_into_vendor_rows",
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
        patch(
            "app.features.vendors.public_metrics.merge_public_metrics_into_vendor_rows",
            side_effect=lambda xs: xs,
        ),
    ):
        result = search_approved_vendors(q="small chops leeds", dates="2026-07-13", flexible=False)

    tiers = {r["user_id"]: r["match_tier"] for r in result.vendors}
    assert tiers["free1"] == "exact"
    assert tiers["busy1"] == "related"


def test_plan_search_sections_by_need():
    rows = [
        _vendor("bake1", city="Leeds", services=["baking"], bio="birthday cakes"),
        _vendor("cat1", city="Leeds", services=["catering"], bio="jollof and small chops"),
        _vendor(
            "multi1",
            city="Leeds",
            services=["baking", "catering", "photography"],
            bio="cakes catering photos",
        ),
        _vendor("photo1", city="Leeds", services=["photography"], bio="events"),
    ]
    parsed = sanitize_marketplace_parse_result(
        {
            "mode": "plan",
            "keywords": ["birthday"],
            "location": "Leeds",
            "types": ["baking", "catering", "photography"],
            "event_types": ["birthdays"],
            "intent_summary": "Birthday vendors in Leeds",
            "plan_title": "Ideas for your birthday — cake, food, and more",
            "needs": [
                {
                    "id": "cake",
                    "label": "Birthday cake",
                    "service_key": "baking",
                    "keywords": ["cake"],
                },
                {
                    "id": "food",
                    "label": "Food for the party",
                    "service_key": "catering",
                    "keywords": ["small chops", "jollof"],
                },
                {
                    "id": "photos",
                    "label": "Photos",
                    "service_key": "photography",
                    "keywords": ["photography"],
                    "optional": True,
                },
            ],
        },
    )

    with (
        patch("app.features.vendors.search.list_approved_vendors_for_explore", return_value=rows),
        patch("app.features.vendors.search.parse_marketplace_query", return_value=parsed),
        patch(
            "app.features.bookings.reviews.merge_review_stats_into_vendor_rows",
            side_effect=lambda xs: xs,
        ),
        patch(
            "app.features.vendors.public_metrics.merge_public_metrics_into_vendor_rows",
            side_effect=lambda xs: xs,
        ),
        patch(
            "app.features.bookings.reviews.featured_snippets_for_vendor_ids",
            return_value={
                "bake1": {
                    "rating": 5,
                    "body_excerpt": "The cake was beautiful and delicious.",
                    "reviewer_display": "Ada",
                },
            },
        ),
    ):
        result = search_approved_vendors(q="help me select vendors for my birthday")

    assert result.search_mode == "plan"
    assert result.plan is not None
    assert "birthday" in result.plan.title.lower()
    assert len(result.sections) == 3
    by_need = {s.need_id: s for s in result.sections}
    # Multi-service vendor is claimed by the first matching section only.
    assert any(v["user_id"] == "bake1" for v in by_need["cake"].vendors)
    assert any(v["user_id"] == "multi1" for v in by_need["cake"].vendors)
    assert all(v["user_id"] != "multi1" for v in by_need["food"].vendors)
    assert all(v["user_id"] != "multi1" for v in by_need["photos"].vendors)
    assert any(v["user_id"] == "cat1" for v in by_need["food"].vendors)
    assert any(v["user_id"] == "photo1" for v in by_need["photos"].vendors)
    flat_ids = [v["user_id"] for v in result.vendors]
    assert len(flat_ids) == len(set(flat_ids))
    assert by_need["cake"].why
    assert "cake" in by_need["cake"].why.lower()
    assert by_need["cake"].total_count >= len(by_need["cake"].vendors)
    bake_row = next(v for v in by_need["cake"].vendors if v["user_id"] == "bake1")
    assert bake_row.get("featured_review", {}).get("body_excerpt")
    assert bake_row.get("match_hint")


def test_friendly_need_labels_sanitized():
    result = sanitize_marketplace_parse_result(
        {
            "mode": "plan",
            "event_types": ["birthdays"],
            "needs": [
                {
                    "id": "food",
                    "label": "Rice/Jollof Mains",
                    "service_key": "catering",
                    "keywords": ["rice"],
                },
                {
                    "id": "photos",
                    "label": "Photography",
                    "service_key": "photography",
                    "keywords": ["photo"],
                    "optional": True,
                },
            ],
        },
    )
    labels = {n.id: n.label for n in result.needs}
    assert "/" not in labels["food"]
    assert labels["food"] == "Food for the party"
    assert labels["photos"] == "Photos"
    assert result.needs[0].rationale


def test_plan_section_pool_count_exceeds_shown():
    rows = [
        _vendor(f"bake{i}", city="Leeds", services=["baking"], bio="birthday cakes")
        for i in range(12)
    ]
    parsed = sanitize_marketplace_parse_result(
        {
            "mode": "plan",
            "event_types": ["birthdays"],
            "plan_title": "Ideas for your birthday",
            "needs": [
                {
                    "id": "cake",
                    "label": "Birthday cake",
                    "service_key": "baking",
                    "keywords": ["cake"],
                },
            ],
        },
    )
    with (
        patch("app.features.vendors.search.list_approved_vendors_for_explore", return_value=rows),
        patch("app.features.vendors.search.parse_marketplace_query", return_value=parsed),
        patch(
            "app.features.bookings.reviews.merge_review_stats_into_vendor_rows",
            side_effect=lambda xs: xs,
        ),
        patch(
            "app.features.vendors.public_metrics.merge_public_metrics_into_vendor_rows",
            side_effect=lambda xs: xs,
        ),
        patch(
            "app.features.bookings.reviews.featured_snippets_for_vendor_ids",
            return_value={},
        ),
    ):
        result = search_approved_vendors(q="help me plan my birthday")

    assert len(result.sections) == 1
    section = result.sections[0]
    assert len(section.vendors) == 8
    assert section.total_count == 12
    assert section.why


def test_why_for_need_prefers_sanitized_rationale_then_event_copy():
    assert "cake" in why_for_need(
        service_key="baking",
        event_types=["birthdays"],
        rationale="Custom cake blurb for hosts.",
    ).lower()
    assert "Custom cake blurb" in why_for_need(
        service_key="baking",
        event_types=["birthdays"],
        rationale="Custom cake blurb for hosts.",
    )
    # Jargon-only rationale is discarded → canned event/service copy.
    birthday_why = why_for_need(
        service_key="baking",
        event_types=["birthdays"],
        rationale="Baking",
    )
    assert "birthday" in birthday_why.lower()
    generic = why_for_need(service_key="rentals", event_types=[], rationale=None)
    assert "decor" in generic.lower() or "hire" in generic.lower()


def test_plan_needs_collapse_duplicate_service_keys():
    result = sanitize_marketplace_parse_result(
        {
            "mode": "plan",
            "event_types": ["birthdays"],
            "needs": [
                {
                    "id": "mains",
                    "label": "Rice and jollof",
                    "service_key": "catering",
                    "keywords": ["jollof", "rice"],
                },
                {
                    "id": "chops",
                    "label": "Small chops",
                    "service_key": "catering",
                    "keywords": ["small chops", "finger food"],
                },
                {
                    "id": "cake",
                    "label": "Birthday cake",
                    "service_key": "baking",
                    "keywords": ["cake"],
                },
            ],
        },
    )
    assert len(result.needs) == 2
    catering = next(n for n in result.needs if n.service_key == "catering")
    assert "jollof" in catering.keywords
    assert "small chops" in catering.keywords or "chops" in " ".join(catering.keywords)
    assert sum(1 for n in result.needs if n.service_key == "catering") == 1
    assert any(n.service_key == "baking" for n in result.needs)
