"""Golden tests for the marketplace domain maths.

The fixtures under `tests/golden/marketplace/*.json` are captured from the baseline
(`backend/app/features/vendors/search_ai.py`, `search.py` and
`backend/app/features/bookings/reviews.py`) by
`acceptance/capture/marketplace_goldens.py`. Every case here replays the same input
through this port's pure functions (`app/features/marketplace/domain_query.py`,
`domain_search.py`, `domain_metrics.py`) and asserts the recorded output exactly,
so a change here can never drift from what real vendors and clients saw on the
live site.
"""

from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path
from typing import Any

import pytest

from app.features.marketplace import domain_query
from app.features.marketplace.domain_metrics import (
    VendorSignals,
    choose_snippets,
    reviewer_display,
)
from app.features.marketplace.domain_search import (
    SearchFilters,
    SearchResult,
    plan_sections,
    rank_vendors,
)
from app.features.marketplace.rows import SnippetCandidateRow
from app.features.vendors.schemas import ListedVendor

GOLDEN_ROOT = Path(__file__).parent / "marketplace"

# The `SearchFilters` fields, in the order the capture script's `RANK_DEFAULTS` used them.
FILTER_FIELDS = (
    "primary_types",
    "related_types",
    "keywords",
    "related_keywords",
    "location_filter",
    "related_locations",
    "parsed_event_types",
    "date_parts",
    "apply_date_availability",
    "budget_min",
    "budget_max",
    "sort_key",
    "intent_summary",
)

# Mirrors the capture script's `RANK_DEFAULTS`: every ranking case overrides a subset of these.
RANK_DEFAULTS: dict[str, Any] = {
    "primary_types": [],
    "related_types": [],
    "keywords": [],
    "related_keywords": [],
    "location_filter": "",
    "related_locations": [],
    "parsed_event_types": [],
    "date_parts": [],
    "apply_date_availability": False,
    "budget_min": None,
    "budget_max": None,
    "sort_key": "relevance",
    "intent_summary": None,
    "limit": 25,
    "offset": 0,
    "service_match_counts_as_exact": False,
}

# The filters plan-mode cases were captured under: every need supplies its own
# service and keywords, so the shared filters stay at their defaults.
PLAN_BASE_FILTERS = SearchFilters(
    primary_types=[],
    related_types=[],
    keywords=[],
    related_keywords=[],
    location_filter="",
    related_locations=[],
    parsed_event_types=[],
    date_parts=[],
    apply_date_availability=False,
    budget_min=None,
    budget_max=None,
    sort_key="relevance",
    intent_summary=None,
)


def load_golden(name: str) -> dict[str, Any]:
    """The captured golden fixture for one file, by its stem (no `.json`)."""
    loaded: dict[str, Any] = json.loads((GOLDEN_ROOT / f"{name}.json").read_text())
    return loaded


def result_to_json(result: SearchResult) -> dict[str, Any]:
    """A `SearchResult` as plain JSON, matching how the capture script wrote the baseline's.

    `dataclasses.asdict` does not know how to serialise the pydantic `MarketplacePlanNeed`
    models nested in `plan.needs`, so those are dumped separately.
    """
    data = asdict(result)
    if data.get("plan") is not None and result.plan is not None:
        data["plan"]["needs"] = [need.model_dump() for need in result.plan.needs]
    return data


def build_vendors(rows: list[dict[str, Any]]) -> list[ListedVendor]:
    """Captured vendor-pool rows as `ListedVendor` instances."""
    return [ListedVendor(**row) for row in rows]


def build_signals(rows: dict[str, dict[str, Any]]) -> dict[str, VendorSignals]:
    """Captured per-vendor signal dicts as `VendorSignals`."""
    return {vendor_id: VendorSignals(**fields) for vendor_id, fields in rows.items()}


QUERY_GOLDEN = load_golden("query")
RANK_GOLDEN = load_golden("rank")
PLAN_GOLDEN = load_golden("plan")
SNIPPETS_GOLDEN = load_golden("snippets")

RANK_VENDOR_POOL = build_vendors(RANK_GOLDEN["vendor_pool"])
RANK_SIGNALS = build_signals(RANK_GOLDEN["signals"])
PLAN_VENDOR_POOL = build_vendors(PLAN_GOLDEN["vendor_pool"])
PLAN_SIGNALS = build_signals(PLAN_GOLDEN["signals"])


# --- query parsing (search_ai.py) -------------------------------------------------------------


@pytest.mark.parametrize("case", QUERY_GOLDEN["sanitize"], ids=lambda case: case["name"])
def test_sanitize_parse_result_matches_baseline(case: dict[str, Any]) -> None:
    """`sanitize_parse_result` clamps a raw model reply to the taxonomy exactly as the baseline did."""
    result = domain_query.sanitize_parse_result(case["reply"])
    assert result.model_dump() == case["result"]


@pytest.mark.parametrize("case", QUERY_GOLDEN["token_only"], ids=lambda case: case["name"])
def test_token_only_parse_matches_baseline(case: dict[str, Any]) -> None:
    """`token_only_parse` keeps search working on plain keywords when the model is unavailable."""
    result = domain_query.token_only_parse(case["query"])
    assert result.model_dump() == case["result"]


@pytest.mark.parametrize("case", QUERY_GOLDEN["why_for_need"], ids=lambda case: case["name"])
def test_why_for_need_matches_baseline(case: dict[str, Any]) -> None:
    """`why_for_need` returns the model's rationale, or the generic line, exactly as the baseline did."""
    result = domain_query.why_for_need(service_key=case["service_key"], rationale=case["rationale"])
    assert result == case["result"]


# --- ranking (search.py, simple mode) ---------------------------------------------------------


@pytest.mark.parametrize("case", RANK_GOLDEN["cases"], ids=lambda case: case["name"])
def test_rank_vendors_matches_baseline(case: dict[str, Any]) -> None:
    """`rank_vendors` tiers, scores and sorts candidates exactly as the baseline's `_rank_candidates` did."""
    params = {**RANK_DEFAULTS, **case["params"]}
    filters = SearchFilters(**{field_name: params[field_name] for field_name in FILTER_FIELDS})
    result = rank_vendors(
        RANK_VENDOR_POOL,
        filters,
        RANK_SIGNALS,
        limit=params["limit"],
        offset=params["offset"],
        service_match_counts_as_exact=params["service_match_counts_as_exact"],
    )
    actual = result_to_json(result)

    # The baseline's isolated `_rank_candidates` never set `intent_summary` on its result -
    # only `_build_match_notice` read it. The outer `search_marketplace_vendors` orchestrator
    # assigned it to the result right afterwards (`result.intent_summary = intent_summary`),
    # so both ends of a real search always agreed on the value. This port's `rank_vendors`
    # folds that single assignment in (`service_search.py` reads `result.intent_summary`
    # straight off it), which is why the golden - captured from the narrower baseline
    # function alone - shows `None` here while this port already carries the real value.
    # Assert the deliberate difference explicitly, then normalize only that one field
    # before comparing everything else byte-for-byte.
    assert actual["intent_summary"] == filters.intent_summary
    actual["intent_summary"] = case["result"]["intent_summary"]
    assert actual == case["result"]


# --- plan sections (search.py, plan mode) -----------------------------------------------------


@pytest.mark.parametrize("case", PLAN_GOLDEN["cases"], ids=lambda case: case["name"])
def test_plan_sections_matches_baseline(case: dict[str, Any]) -> None:
    """`plan_sections` claims one vendor per need exactly as the baseline's `_search_plan_sections` did."""
    needs = [domain_query._sanitize_needs([need])[0] for need in case["needs"]]
    result = plan_sections(
        PLAN_VENDOR_POOL, PLAN_BASE_FILTERS, PLAN_SIGNALS, needs=needs, plan_title=case["plan_title"]
    )
    assert result_to_json(result) == case["result"]


# --- review quotes (bookings/reviews.py) ------------------------------------------------------


@pytest.mark.parametrize("case", SNIPPETS_GOLDEN["reviewer_display"], ids=lambda case: case["name"])
def test_reviewer_display_matches_baseline(case: dict[str, Any]) -> None:
    """`reviewer_display` names a reviewer exactly as the baseline's `_reviewer_display_from_email` did."""
    assert reviewer_display(case["email"]) == case["display"]


def _snippet_candidates() -> list[SnippetCandidateRow]:
    """The captured review rows as `SnippetCandidateRow` instances, emails joined in."""
    reviews = SNIPPETS_GOLDEN["choose_snippets"]["reviews"]
    client_emails = SNIPPETS_GOLDEN["choose_snippets"]["client_emails"]
    return [
        SnippetCandidateRow(
            vendor_user_id=review["vendor_user_id"],
            rating=review["rating"],
            body=review["body"],
            client_email=client_emails.get(review["client_user_id"]),
        )
        for review in reviews
    ]


@pytest.mark.parametrize("case", SNIPPETS_GOLDEN["choose_snippets"]["cases"], ids=lambda case: case["name"])
def test_choose_snippets_matches_baseline(case: dict[str, Any]) -> None:
    """`choose_snippets` quotes the same review the baseline's `featured_snippets_for_vendor_ids` chose."""
    candidates = _snippet_candidates()
    result = choose_snippets(candidates, case["prefer_terms"])
    assert {vendor_id: review.model_dump() for vendor_id, review in result.items()} == case["result"]
