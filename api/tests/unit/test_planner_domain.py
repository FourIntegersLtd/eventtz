"""Planner domain rules with no I/O: the suggested next steps shown beside a plan."""

from __future__ import annotations

from app.features.planner.domain import NeedOutcome, suggested_next_steps

OPEN_PROFILE_STEP = "Open a vendor profile to request a booking - nothing is booked until you confirm."
WIDEN_STEP = "Widen location or budget for categories with no matches, then Replace."
BUDGET_STEP = "Compare estimated costs against your budget before enquiring."


def test_names_the_first_required_need_with_a_pick_and_asks_to_widen_empty_ones() -> None:
    needs = [
        NeedOutcome(label="Photography", has_primary=True, optional=True),
        NeedOutcome(label="Catering", has_primary=True, optional=False),
        NeedOutcome(label="DJ", has_primary=False, optional=False),
    ]
    assert suggested_next_steps(needs, budget_stated=True) == [
        "Review catering first - it often books out earliest.",
        WIDEN_STEP,
        OPEN_PROFILE_STEP,
        BUDGET_STEP,
    ]


def test_without_picks_or_a_budget_only_the_widen_and_profile_steps_remain() -> None:
    needs = [NeedOutcome(label="Catering", has_primary=False, optional=False)]
    assert suggested_next_steps(needs, budget_stated=False) == [WIDEN_STEP, OPEN_PROFILE_STEP]


def test_an_empty_plan_still_points_at_vendor_profiles() -> None:
    assert suggested_next_steps([], budget_stated=False) == [OPEN_PROFILE_STEP]
