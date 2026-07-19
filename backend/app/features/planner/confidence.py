"""Deterministic 0–100 confidence score + short reasons."""

from __future__ import annotations

from app.contracts.planner import CelebrationBrief, ConfidenceBlock, PlannerRecommendation


def compute_confidence(
    *,
    brief: CelebrationBrief,
    recommendations: list[PlannerRecommendation],
    budget_over: bool,
) -> ConfidenceBlock:
    score = 100
    reasons: list[str] = []

    empty = [r for r in recommendations if r.primary is None]
    if empty:
        penalty = min(40, 12 * len(empty))
        score -= penalty
        labels = ", ".join(r.label for r in empty[:3])
        reasons.append(f"No strong matches yet for {labels}.")

    low_reviews = 0
    weak_location = 0
    for r in recommendations:
        if r.primary is None:
            continue
        if int(r.primary.review_count or 0) < 3:
            low_reviews += 1
        loc = (brief.location or "").strip().lower()
        city = (r.primary.base_city or "").strip().lower()
        if loc and city and loc not in city and city not in loc:
            weak_location += 1

    if low_reviews:
        score -= min(18, 6 * low_reviews)
        reasons.append("Some recommended vendors have few reviews yet.")

    if weak_location:
        score -= min(15, 5 * weak_location)
        reasons.append("Some picks are outside your preferred area.")

    if budget_over:
        score -= 15
        reasons.append("Estimated costs are over your stated budget.")

    if brief.guest_count is None:
        score -= 4
        if len(reasons) < 3:
            reasons.append("Guest count was estimated for catering maths.")

    if brief.budget_gbp is None:
        score -= 3

    if brief.preferred_date_invalid:
        score -= 8
        reasons.append("The date in your prompt looks like it has already passed.")

    if brief.event_type in (None, "birthdays") and not any(
        w in (brief.raw_prompt or "").lower()
        for w in ("birthday", "wedding", "shower", "naming", "funeral", "corporate", "engagement")
    ):
        score -= 10
        reasons.append("Assumed a birthday-style celebration — adjust if that is wrong.")

    if brief.currency_assumed_gbp:
        score -= 3
        if len(reasons) < 3:
            reasons.append("Budget treated as GBP for the UK marketplace.")

    quote_only = sum(
        1
        for r in recommendations
        if r.primary is not None and r.primary.price_on_request
    )
    if quote_only:
        score -= min(9, 3 * quote_only)
        if len(reasons) < 3:
            reasons.append("Some vendors are price on request.")

    score = max(0, min(100, int(round(score))))

    # Prefer positive lead reason when score is still high
    if score >= 85 and not reasons:
        reasons.append("Strong matches across your categories.")
    elif score >= 70 and len(reasons) < 1:
        reasons.append("A solid shortlist — review each category before booking.")

    return ConfidenceBlock(score=score, reasons=reasons[:3])
