"""Allocate celebration budget and estimate per-need costs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from app.contracts.planner import BudgetBreakdown, BudgetLine
from app.features.planner.category_planner import normalize_event_type
from app.features.planner.defaults import (
    BUDGET_SPLIT_BY_EVENT,
    DEFAULT_GUEST_COUNT,
    MAX_GUEST_ESTIMATE,
    MIN_GUEST_ESTIMATE,
    TEMPLATE_CATERING_PER_GUEST_GBP,
    TEMPLATE_COST_FLAT_GBP,
)


@dataclass(frozen=True)
class CostEstimate:
    amount_gbp: float
    assumption: str
    source: Literal["vendor_list_price", "template"]


def _guest_scale(guest_count: int | None) -> tuple[int, bool]:
    """Return (guests used for estimate, whether we assumed the default)."""
    if guest_count is None:
        return DEFAULT_GUEST_COUNT, True
    n = max(MIN_GUEST_ESTIMATE, min(MAX_GUEST_ESTIMATE, int(guest_count)))
    return n, False


def template_estimate(
    service_key: str,
    *,
    guest_count: int | None,
) -> CostEstimate:
    key = (service_key or "").strip().lower()
    guests, used_default_guests = _guest_scale(guest_count)

    if key == "catering":
        amount = round(TEMPLATE_CATERING_PER_GUEST_GBP * guests, 2)
        guest_note = (
            f"assumed {guests} guests (none stated)"
            if used_default_guests
            else f"{guests} guests"
        )
        return CostEstimate(
            amount_gbp=amount,
            assumption=(
                f"Estimate: £{TEMPLATE_CATERING_PER_GUEST_GBP:.0f}/guest × {guest_note} "
                f"— vendor has no list price yet"
            ),
            source="template",
        )

    flat = float(TEMPLATE_COST_FLAT_GBP.get(key, 200.0))
    label = {
        "baking": "celebration cake",
        "photography": "photography",
        "makeup": "makeup",
        "rentals": "decor & hire",
    }.get(key, key or "this service")
    return CostEstimate(
        amount_gbp=round(flat, 2),
        assumption=f"Typical starting estimate for {label} — vendor has no list price yet",
        source="template",
    )


def allocate_budget_bands(
    needs: list[dict[str, Any]],
    *,
    event_type: str | None,
    event_kind: str = "standard",
    user_budget_gbp: float | None,
) -> dict[str, float | None]:
    """Per-need soft allocation from user budget (None values if no user budget)."""
    if user_budget_gbp is None or user_budget_gbp <= 0:
        return {str(n.get("id") or ""): None for n in needs}

    canonical = normalize_event_type(event_type, event_kind=event_kind)
    splits = BUDGET_SPLIT_BY_EVENT.get(canonical) or BUDGET_SPLIT_BY_EVENT["birthdays"]

    weights: dict[str, float] = {}
    for need in needs:
        nid = str(need.get("id") or "")
        sk = str(need.get("service_key") or "")
        w = float(splits.get(sk, 0.1))
        weights[nid] = w
    total_w = sum(weights.values()) or 1.0
    return {
        nid: round(user_budget_gbp * (w / total_w), 2) for nid, w in weights.items()
    }


def estimate_need_cost(
    *,
    service_key: str,
    guest_count: int | None,
    primary_min_list_price: float | None,
    vendor_name: str | None = None,
) -> CostEstimate:
    if primary_min_list_price is not None:
        try:
            p = float(primary_min_list_price)
            if p >= 0:
                name = (vendor_name or "Recommended vendor").strip() or "Recommended vendor"
                return CostEstimate(
                    amount_gbp=round(p, 2),
                    assumption=f"From {name}'s lowest listed package/rate on Eventtz",
                    source="vendor_list_price",
                )
        except (TypeError, ValueError):
            pass
    return template_estimate(service_key, guest_count=guest_count)


def build_budget_breakdown(
    *,
    needs: list[dict[str, Any]],
    cost_by_need: dict[str, float | None],
    allocated_by_need: dict[str, float | None],
    user_budget_gbp: float | None,
    assumption_by_need: dict[str, str | None] | None = None,
    guest_count: int | None = None,
) -> BudgetBreakdown:
    lines: list[BudgetLine] = []
    total = 0.0
    has_any = False
    assumptions_map = assumption_by_need or {}
    for need in needs:
        nid = str(need.get("id") or "")
        label = str(need.get("label") or nid)
        amount = cost_by_need.get(nid)
        if amount is None:
            continue
        has_any = True
        total += float(amount)
        raw_assumption = assumptions_map.get(nid)
        lines.append(
            BudgetLine(
                need_id=nid,
                label=label,
                amount_gbp=round(float(amount), 2),
                allocated_gbp=allocated_by_need.get(nid),
                assumption=(str(raw_assumption).strip() if raw_assumption else None) or None,
            ),
        )

    remaining = None
    over = False
    if user_budget_gbp is not None and has_any:
        remaining = round(float(user_budget_gbp) - total, 2)
        over = remaining < 0

    global_assumptions: list[str] = [
        "Each line is the estimated cost for the recommended vendor — not a forced split of your budget.",
    ]
    if guest_count is None and any(
        str(n.get("service_key") or "") == "catering" for n in needs
    ):
        global_assumptions.append(
            f"Guest count wasn’t stated, so catering estimates assume {DEFAULT_GUEST_COUNT} guests.",
        )
    elif guest_count is not None:
        guests, _ = _guest_scale(guest_count)
        if guests != int(guest_count):
            global_assumptions.append(
                f"Guest count was adjusted to {guests} for estimates (we use {MIN_GUEST_ESTIMATE}–{MAX_GUEST_ESTIMATE}).",
            )
    if user_budget_gbp is not None and over:
        global_assumptions.append(
            "Your budget is a target. We still recommend strong vendors and flag when estimates exceed it.",
        )
    if user_budget_gbp is None:
        global_assumptions.append(
            "No total budget was stated — figures are vendor prices or typical starting estimates only.",
        )

    return BudgetBreakdown(
        lines=lines,
        total_estimated_gbp=round(total, 2) if has_any else None,
        remaining_budget_gbp=remaining,
        user_budget_gbp=user_budget_gbp,
        over_budget=over,
        assumptions=global_assumptions,
    )
