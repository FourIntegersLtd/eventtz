"""Tiered referral discounts off the Eventtz service fee (not vendor portion)."""

from __future__ import annotations

from typing import Any

# Best qualifying tier wins (sorted highest min spend first).
REFERRAL_FEE_TIERS: tuple[dict[str, float], ...] = (
    {"min_spend_gbp": 600.0, "fee_discount_gbp": 15.0},
    {"min_spend_gbp": 400.0, "fee_discount_gbp": 10.0},
)


def qualifying_tier(vendor_portion_gbp: float) -> dict[str, float] | None:
    spend = max(0.0, float(vendor_portion_gbp or 0))
    for tier in REFERRAL_FEE_TIERS:
        if spend >= float(tier["min_spend_gbp"]):
            return tier
    return None


def referral_fee_discount_for_spend(vendor_portion_gbp: float) -> float:
    tier = qualifying_tier(vendor_portion_gbp)
    if not tier:
        return 0.0
    return float(tier["fee_discount_gbp"])


def referral_tier_min_spend(vendor_portion_gbp: float) -> float | None:
    tier = qualifying_tier(vendor_portion_gbp)
    if not tier:
        return None
    return float(tier["min_spend_gbp"])


def referral_tiers_for_display() -> list[dict[str, Any]]:
    return [
        {
            "min_spend_gbp": float(t["min_spend_gbp"]),
            "fee_discount_gbp": float(t["fee_discount_gbp"]),
        }
        for t in REFERRAL_FEE_TIERS
    ]
