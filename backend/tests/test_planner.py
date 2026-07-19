"""Tests for AI Event Planner parse, needs, budget, and generate path."""

from __future__ import annotations

from unittest.mock import patch

import pytest

from app.contracts.marketplace_search import MarketplaceQueryParseResult
from app.core.errors import ValidationError
from app.features.planner.budget import build_budget_breakdown, estimate_need_cost
from app.features.planner.category_planner import needs_for_event
from app.features.planner import db as planner_db
from app.features.planner.plan_service import generate_plan
from app.features.planner.prompt_parser import parse_celebration_prompt


def test_baking_in_leeds_is_simple_intent():
    with patch(
        "app.features.planner.prompt_parser.parse_marketplace_query",
        return_value=MarketplaceQueryParseResult(
            mode="simple",
            keywords=["baking", "leeds"],
            types=["baking"],
            location="Leeds",
        ),
    ):
        with pytest.raises(ValidationError) as exc:
            parse_celebration_prompt("baking in Leeds")
    assert exc.value.code == "simple_intent"


def test_plan_baking_in_leeds_is_simple_single_service():
    with patch(
        "app.features.planner.prompt_parser.parse_marketplace_query",
        return_value=MarketplaceQueryParseResult(
            mode="plan",
            keywords=["plan", "baking", "leeds"],
            types=["baking"],
            location="Leeds",
            event_types=["birthdays"],
        ),
    ):
        with pytest.raises(ValidationError) as exc:
            parse_celebration_prompt("plan baking in Leeds")
    assert exc.value.code == "simple_intent"


def test_birthday_plan_parses_brief():
    with (
        patch(
            "app.features.planner.prompt_parser.parse_marketplace_query",
            return_value=MarketplaceQueryParseResult(
                mode="plan",
                keywords=["birthday", "london"],
                types=["baking", "catering"],
                location="London",
                event_types=["birthdays"],
            ),
        ),
        patch("app.features.planner.prompt_parser.try_openai_client", return_value=None),
    ):
        brief = parse_celebration_prompt(
            "Help me plan my 30th birthday in London for 120 guests, £5000",
        )
    assert brief.event_type == "birthdays"
    assert brief.location and "London" in brief.location
    assert brief.guest_count == 120
    assert brief.budget_gbp == 5000


def test_nonsense_prompt_rejected():
    with pytest.raises(ValidationError) as exc:
        parse_celebration_prompt("🎉🎉🎉")
    assert exc.value.code == "invalid_prompt"


def test_funeral_needs_no_cake():
    needs = needs_for_event("funeral", event_kind="funeral")
    keys = {n["service_key"] for n in needs}
    assert "catering" in keys
    assert "photography" in keys
    assert "baking" not in keys
    assert "makeup" not in keys


def test_corporate_needs_no_forced_cake():
    needs = needs_for_event("corporate", event_kind="corporate")
    keys = {n["service_key"] for n in needs}
    assert keys == {"catering", "photography", "rentals"} or (
        "catering" in keys and "photography" in keys and "baking" not in keys
    )


def test_no_makeup_drops_need():
    needs = needs_for_event("weddings", excluded_needs=["makeup"])
    assert all(n["id"] != "glam" for n in needs)
    assert all(n["service_key"] != "makeup" for n in needs)


def test_budget_overspend_fields():
    needs = [
        {"id": "food", "label": "Food", "service_key": "catering"},
        {"id": "cake", "label": "Cake", "service_key": "baking"},
    ]
    budget = build_budget_breakdown(
        needs=needs,
        cost_by_need={"food": 4000.0, "cake": 500.0},
        allocated_by_need={"food": 700.0, "cake": 300.0},
        user_budget_gbp=1000.0,
    )
    assert budget.total_estimated_gbp == 4500.0
    assert budget.remaining_budget_gbp == -3500.0
    assert budget.over_budget is True


def test_catering_estimate_scales_with_guests():
    small = estimate_need_cost(
        service_key="catering",
        guest_count=20,
        primary_min_list_price=None,
    )
    large = estimate_need_cost(
        service_key="catering",
        guest_count=200,
        primary_min_list_price=None,
    )
    assert large.amount_gbp > small.amount_gbp
    assert "£18/guest" in small.assumption
    assert small.source == "template"


def test_budget_breakdown_includes_assumptions():
    needs = [{"id": "food", "label": "Food", "service_key": "catering"}]
    budget = build_budget_breakdown(
        needs=needs,
        cost_by_need={"food": 1440.0},
        allocated_by_need={"food": 350.0},
        user_budget_gbp=1000.0,
        assumption_by_need={
            "food": "Estimate: £18/guest × assumed 80 guests (none stated) — vendor has no list price yet",
        },
        guest_count=None,
    )
    assert budget.over_budget is True
    assert budget.lines[0].assumption
    assert any("not a forced split" in a for a in budget.assumptions)
    assert any("80 guests" in a for a in budget.assumptions)


def _vendor(
    user_id: str,
    *,
    city: str,
    services: list[str],
    price: float | None = 300,
) -> dict:
    return {
        "user_id": user_id,
        "email": f"{user_id}@example.com",
        "status": "complete",
        "approval_status": "approved",
        "updated_at": "2026-07-01T12:00:00+00:00",
        "review_average": 4.7,
        "review_count": 12,
        "completed_bookings": 8,
        "avg_response_seconds": 3600,
        "conversion_rate": 0.35,
        "min_list_price_gbp": price,
        "payload": {
            "baseCity": city,
            "businessName": f"Biz {user_id}",
            "servicesOffered": services,
            "eventTypes": ["birthdays", "weddings"],
            "packages": [{"title": "Standard", "price": str(price or "")}],
        },
    }


def test_generate_birthday_plan_end_to_end():
    planner_db.clear_local_store()
    pool = [
        _vendor("cat1", city="London", services=["catering"], price=800),
        _vendor("cat2", city="London", services=["catering"], price=900),
        _vendor("cat3", city="London", services=["catering"], price=950),
        _vendor("bake1", city="London", services=["baking"], price=150),
        _vendor("bake2", city="London", services=["baking"], price=180),
        _vendor("bake3", city="London", services=["baking"], price=200),
        _vendor("photo1", city="London", services=["photography"], price=500),
        _vendor("photo2", city="London", services=["photography"], price=550),
        _vendor("rent1", city="London", services=["rentals"], price=400),
    ]
    with (
        patch(
            "app.features.planner.prompt_parser.parse_marketplace_query",
            return_value=MarketplaceQueryParseResult(
                mode="plan",
                keywords=["birthday"],
                types=["baking", "catering"],
                location="London",
                event_types=["birthdays"],
            ),
        ),
        patch("app.features.planner.prompt_parser.try_openai_client", return_value=None),
        patch("app.features.planner.explain.try_openai_client", return_value=None),
        patch(
            "app.features.planner.plan_service.load_enriched_vendor_pool",
            return_value=pool,
        ),
        patch("app.core.config.get_settings") as gs,
    ):
        settings = gs.return_value
        settings.local_auth_mode = True
        # Also patch planner_db settings lookups
        with patch("app.features.planner.db.get_settings", return_value=settings):
            plan = generate_plan(
                "client-1",
                "Help me plan my birthday in London for 80 guests, budget £2000",
            )

    assert plan.plan_id
    assert plan.celebration.event_type == "birthdays"
    assert plan.recommendations
    assert any(r.service_key == "catering" for r in plan.recommendations)
    assert any(r.primary is not None for r in plan.recommendations)
    assert 0 <= plan.confidence.score <= 100
    # Unrealistic low budget vs estimates → overspend surfaced
    if plan.budget.user_budget_gbp is not None and plan.budget.total_estimated_gbp is not None:
        if plan.budget.total_estimated_gbp > plan.budget.user_budget_gbp:
            assert plan.budget.over_budget is True
