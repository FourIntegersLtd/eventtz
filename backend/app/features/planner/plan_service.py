"""Orchestrate AI Event Planner generate / list / get / replace / archive."""

from __future__ import annotations

import hashlib
import time
from typing import Any

from app.contracts.planner import (
    ArchivePlanResponse,
    BudgetBreakdown,
    CelebrationBrief,
    CelebrationPlanListItem,
    CelebrationPlanListResponse,
    CelebrationPlanResponse,
    CelebrationSummary,
    ConfidenceBlock,
    PlannerRecommendation,
    PlannerVendorCard,
)
from app.core.errors import NotFoundError, ValidationError
from app.core.logging import get_logger
from app.features.planner import db as planner_db
from app.features.planner.budget import (
    allocate_budget_bands,
    build_budget_breakdown,
    estimate_need_cost,
)
from app.features.planner.category_planner import needs_for_event, normalize_event_type
from app.features.planner.confidence import compute_confidence
from app.features.planner.defaults import DEDUPE_WINDOW_SECONDS
from app.features.planner.explain import build_summary, why_for_vendor
from app.features.planner.marketplace_adapter import (
    filter_candidates_for_need,
    get_enriched_vendor,
    load_enriched_vendor_pool,
)
from app.features.planner.prompt_parser import parse_celebration_prompt
from app.features.vendors.ranking import RankingContext, VendorRankingEngine
from app.features.vendors.ranking.explain_facts import build_fact_card

logger = get_logger(__name__)

_ENGINE = VendorRankingEngine()

# Short-window dedupe: (client_id, prompt_hash) → (expires_monotonic, plan_id)
_RECENT_GENERATES: dict[tuple[str, str], tuple[float, str]] = {}


def _prompt_hash(prompt: str) -> str:
    return hashlib.sha256(prompt.strip().lower().encode("utf-8")).hexdigest()[:24]


def _cover_image_url(row: dict[str, Any]) -> str | None:
    payload = row.get("payload") if isinstance(row.get("payload"), dict) else {}
    names = payload.get("portfolioFileNames")
    if isinstance(names, list) and names:
        first = names[0]
        if isinstance(first, str) and first.strip():
            return first.strip()
    return None


def vendor_card_from_row(
    row: dict[str, Any] | None,
    *,
    unavailable: bool = False,
) -> PlannerVendorCard | None:
    if not row or not row.get("user_id"):
        return None
    fact = build_fact_card(row)
    return PlannerVendorCard(
        user_id=fact.user_id,
        business_name=fact.business_name,
        services=list(fact.services),
        review_average=fact.review_average,
        review_count=fact.review_count,
        completed_bookings=fact.completed_bookings,
        avg_response_seconds=fact.avg_response_seconds,
        conversion_rate=fact.conversion_rate,
        min_list_price_gbp=fact.min_list_price_gbp,
        base_city=fact.base_city,
        cover_image_url=_cover_image_url(row),
        unavailable=unavailable,
        price_on_request=fact.price_on_request,
    )


def _title_for_brief(brief: CelebrationBrief) -> str:
    et = (brief.event_type or "celebration").replace("_", " ").title()
    loc = brief.location or "your city"
    if brief.event_kind == "funeral":
        return f"Memorial gathering · {loc}"
    if brief.event_kind == "corporate":
        return f"Corporate event · {loc}"
    if brief.guest_count:
        return f"{et} · {loc} · {brief.guest_count} guests"
    return f"{et} · {loc}"


def _next_steps(brief: CelebrationBrief, recommendations: list[PlannerRecommendation]) -> list[str]:
    steps: list[str] = []
    primary_needs = [r for r in recommendations if r.primary is not None and not r.optional]
    if primary_needs:
        steps.append(f"Review {primary_needs[0].label.lower()} first — it often books out earliest.")
    empty = [r for r in recommendations if r.primary is None]
    if empty:
        steps.append("Widen location or budget for categories with no matches, then Replace.")
    steps.append("Open a vendor profile to request a booking — nothing is booked until you confirm.")
    if brief.budget_gbp is not None:
        steps.append("Compare estimated costs against your budget before enquiring.")
    return steps[:4]


def _select_for_need(
    *,
    need: dict[str, Any],
    pool: list[dict[str, Any]],
    brief: CelebrationBrief,
    budget_band: float | None,
    claimed_primaries: set[str],
    exclude_user_ids: set[str] | None = None,
) -> tuple[Any | None, list[Any], dict[str, Any] | None, str | None]:
    """Return (primary_ranked, alt_ranked, breakdown_dict, empty_reason)."""
    candidates = filter_candidates_for_need(
        pool,
        service_key=str(need.get("service_key") or ""),
        location=brief.location,
        related_locations=list(brief.related_locations or []),
        budget_band_gbp=budget_band,
        keywords=list(need.get("keywords") or []),
    )
    if not candidates:
        return None, [], None, "No approved vendors offer this service yet."

    ctx = RankingContext(
        service_key=str(need.get("service_key") or ""),
        location=brief.location,
        related_locations=list(brief.related_locations or []),
        event_types=[brief.event_type] if brief.event_type else [],
        budget_band_gbp=budget_band,
        keywords=list(need.get("keywords") or []),
    )
    exclude = set(exclude_user_ids or set())
    ranked = _ENGINE.rank(candidates, ctx, exclude_user_ids=exclude)
    if not ranked:
        return None, [], None, "No more alternatives for this category."

    # First-need-wins for primaries: skip already-claimed vendors for primary slot
    primary = None
    for rv in ranked:
        if rv.user_id not in claimed_primaries:
            primary = rv
            break
    if primary is None:
        # All top vendors claimed — still assign best remaining (overlap allowed for alts only)
        primary = ranked[0]

    alts = [rv for rv in ranked if rv.user_id != primary.user_id][:2]
    return primary, alts, primary.breakdown.as_dict(), None


def _recommendation_from_selection(
    *,
    need: dict[str, Any],
    primary: Any | None,
    alts: list[Any],
    brief: CelebrationBrief,
    empty_reason: str | None,
    breakdown: dict[str, Any] | None,
) -> PlannerRecommendation:
    primary_card = vendor_card_from_row(primary.row if primary else None)
    alt_cards = [c for c in (vendor_card_from_row(a.row) for a in alts) if c is not None]
    cost = None
    cost_assumption: str | None = None
    why = ""
    if primary is not None:
        estimate = estimate_need_cost(
            service_key=str(need.get("service_key") or ""),
            guest_count=brief.guest_count,
            primary_min_list_price=primary_card.min_list_price_gbp if primary_card else None,
            vendor_name=primary_card.business_name if primary_card else None,
        )
        cost = estimate.amount_gbp
        cost_assumption = estimate.assumption
        why = why_for_vendor(
            primary.row,
            need_label=str(need.get("label") or need.get("id") or ""),
            brief=brief,
        )
    return PlannerRecommendation(
        need_id=str(need.get("id") or ""),
        label=str(need.get("label") or ""),
        service_key=str(need.get("service_key") or ""),
        optional=bool(need.get("optional")),
        primary=primary_card,
        alternatives=alt_cards,
        estimated_cost_gbp=cost,
        cost_assumption=cost_assumption,
        why_selected=why,
        empty_reason=empty_reason,
        score_breakdown=breakdown,
    )


def _score_breakdown_with_assumption(
    breakdown: dict[str, Any] | None,
    cost_assumption: str | None,
) -> dict[str, Any] | None:
    """Persist cost_assumption inside score_breakdown (no dedicated DB column)."""
    out: dict[str, Any] = dict(breakdown or {})
    if cost_assumption:
        out["cost_assumption"] = cost_assumption
    return out or None


def _items_payload(recommendations: list[PlannerRecommendation]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for i, rec in enumerate(recommendations):
        items.append(
            {
                "need_id": rec.need_id,
                "label": rec.label,
                "service_key": rec.service_key,
                "optional": rec.optional,
                "primary_vendor_user_id": rec.primary.user_id if rec.primary else None,
                "alternative_vendor_user_ids": [a.user_id for a in rec.alternatives],
                "estimated_cost_gbp": rec.estimated_cost_gbp,
                "cost_assumption": rec.cost_assumption,
                "why_selected": rec.why_selected,
                "score_breakdown": _score_breakdown_with_assumption(
                    rec.score_breakdown,
                    rec.cost_assumption,
                ),
                "sort_order": i,
            },
        )
    return items


def _response_from_parts(
    *,
    plan_id: str,
    status: str,
    brief: CelebrationBrief,
    title: str,
    summary: str,
    confidence: ConfidenceBlock,
    budget: BudgetBreakdown,
    recommendations: list[PlannerRecommendation],
    created_at: str | None = None,
    updated_at: str | None = None,
) -> CelebrationPlanResponse:
    return CelebrationPlanResponse(
        success=True,
        plan_id=plan_id,
        status=status,
        celebration=CelebrationSummary(
            title=title,
            event_type=brief.event_type,
            location=brief.location,
            guest_count=brief.guest_count,
            budget_gbp=brief.budget_gbp,
            preferred_date=brief.preferred_date,
            summary=summary,
        ),
        brief=brief,
        confidence=confidence,
        budget=budget,
        recommendations=recommendations,
        next_steps=_next_steps(brief, recommendations),
        created_at=created_at,
        updated_at=updated_at,
    )


def generate_plan(client_user_id: str, prompt: str) -> CelebrationPlanResponse:
    text = (prompt or "").strip()
    if not text:
        raise ValidationError("Describe your celebration in a few words.")

    # Double-submit dedupe (short window)
    ph = _prompt_hash(text)
    key = (client_user_id, ph)
    now = time.monotonic()
    hit = _RECENT_GENERATES.get(key)
    if hit and hit[0] > now:
        existing = planner_db.get_plan_for_client(hit[1], client_user_id)
        if existing:
            return get_plan(client_user_id, hit[1])

    brief = parse_celebration_prompt(text)
    event_type = normalize_event_type(brief.event_type, event_kind=brief.event_kind)
    brief.event_type = event_type

    needs = needs_for_event(
        event_type,
        event_kind=brief.event_kind,
        excluded_needs=list(brief.excluded_needs or []),
        cuisine_notes=brief.cuisine_notes,
    )
    if not needs:
        raise ValidationError("We could not build a plan from that description. Try adding the event type and city.")

    allocated = allocate_budget_bands(
        needs,
        event_type=event_type,
        event_kind=brief.event_kind,
        user_budget_gbp=brief.budget_gbp,
    )
    pool = load_enriched_vendor_pool()

    claimed: set[str] = set()
    recommendations: list[PlannerRecommendation] = []
    for need in needs:
        nid = str(need.get("id") or "")
        primary, alts, breakdown, empty_reason = _select_for_need(
            need=need,
            pool=pool,
            brief=brief,
            budget_band=allocated.get(nid),
            claimed_primaries=claimed,
        )
        if primary is not None:
            claimed.add(primary.user_id)
        recommendations.append(
            _recommendation_from_selection(
                need=need,
                primary=primary,
                alts=alts,
                brief=brief,
                empty_reason=empty_reason,
                breakdown=breakdown,
            ),
        )

    cost_by_need = {r.need_id: r.estimated_cost_gbp for r in recommendations}
    budget = build_budget_breakdown(
        needs=needs,
        cost_by_need=cost_by_need,
        allocated_by_need=allocated,
        user_budget_gbp=brief.budget_gbp,
        assumption_by_need={
            r.need_id: r.cost_assumption
            for r in recommendations
            if r.cost_assumption
        },
        guest_count=brief.guest_count,
    )
    confidence = compute_confidence(
        brief=brief,
        recommendations=recommendations,
        budget_over=budget.over_budget,
    )
    title = _title_for_brief(brief)
    summary = build_summary(
        brief,
        title=title,
        need_labels=[r.label for r in recommendations],
    )

    saved = planner_db.insert_plan(
        client_user_id=client_user_id,
        title=title,
        raw_prompt=text,
        brief=brief.model_dump(),
        confidence_score=confidence.score,
        confidence_reasons=list(confidence.reasons),
        summary=summary,
        budget_total_gbp=budget.total_estimated_gbp,
        budget_remaining_gbp=budget.remaining_budget_gbp,
        currency="GBP",
        items=_items_payload(recommendations),
    )
    plan_id = str(saved.get("id") or "")
    _RECENT_GENERATES[key] = (now + DEDUPE_WINDOW_SECONDS, plan_id)

    try:
        from app.features.analytics.events import record_marketplace_event

        record_marketplace_event(
            "celebration_plan_generated",
            actor_user_id=client_user_id,
            location=brief.location,
            category=brief.event_type,
            payload={
                "plan_id": plan_id,
                "confidence": confidence.score,
                "need_count": len(recommendations),
            },
        )
    except Exception:
        logger.exception("planner_generate: analytics failed")

    logger.info(
        "planner_generate: client=%s plan=%s needs=%s confidence=%s",
        client_user_id,
        plan_id,
        [r.need_id for r in recommendations],
        confidence.score,
    )
    return _response_from_parts(
        plan_id=plan_id,
        status=str(saved.get("status") or "active"),
        brief=brief,
        title=title,
        summary=summary,
        confidence=confidence,
        budget=budget,
        recommendations=recommendations,
        created_at=str(saved.get("created_at")) if saved.get("created_at") else None,
        updated_at=str(saved.get("updated_at")) if saved.get("updated_at") else None,
    )


def _hydrate_recommendations_from_items(
    items: list[dict[str, Any]],
    brief: CelebrationBrief,
) -> list[PlannerRecommendation]:
    out: list[PlannerRecommendation] = []
    for item in sorted(items, key=lambda x: int(x.get("sort_order") or 0)):
        primary_id = item.get("primary_vendor_user_id")
        alt_ids = item.get("alternative_vendor_user_ids") or []
        primary_row = get_enriched_vendor(str(primary_id)) if primary_id else None
        unavailable = bool(primary_id) and primary_row is None
        # If unapproved, try to still show card as unavailable without metrics
        primary_card = vendor_card_from_row(primary_row, unavailable=unavailable)
        if primary_id and primary_card is None:
            primary_card = PlannerVendorCard(
                user_id=str(primary_id),
                business_name="Vendor unavailable",
                unavailable=True,
                price_on_request=True,
            )
        alt_cards: list[PlannerVendorCard] = []
        for aid in alt_ids[:2]:
            arow = get_enriched_vendor(str(aid))
            card = vendor_card_from_row(arow, unavailable=arow is None)
            if card is None and aid:
                card = PlannerVendorCard(
                    user_id=str(aid),
                    business_name="Vendor unavailable",
                    unavailable=True,
                    price_on_request=True,
                )
            if card:
                alt_cards.append(card)
        empty_reason = None
        if primary_card is None:
            empty_reason = "No vendor saved for this need."
        elif unavailable:
            empty_reason = "This vendor is no longer listed — try Replace."
        stored_cost = (
            float(item["estimated_cost_gbp"])
            if item.get("estimated_cost_gbp") is not None
            else None
        )
        sb = item.get("score_breakdown") if isinstance(item.get("score_breakdown"), dict) else {}
        cost_assumption = (
            str(item.get("cost_assumption") or "").strip()
            or str(sb.get("cost_assumption") or "").strip()
            or None
        )
        if stored_cost is not None and not cost_assumption and primary_card is not None:
            cost_assumption = estimate_need_cost(
                service_key=str(item.get("service_key") or ""),
                guest_count=brief.guest_count,
                primary_min_list_price=primary_card.min_list_price_gbp,
                vendor_name=primary_card.business_name,
            ).assumption
        out.append(
            PlannerRecommendation(
                need_id=str(item.get("need_id") or ""),
                label=str(item.get("label") or ""),
                service_key=str(item.get("service_key") or ""),
                optional=bool(item.get("optional")),
                primary=primary_card,
                alternatives=alt_cards,
                estimated_cost_gbp=stored_cost,
                cost_assumption=cost_assumption,
                why_selected=str(item.get("why_selected") or ""),
                empty_reason=empty_reason,
                score_breakdown=item.get("score_breakdown")
                if isinstance(item.get("score_breakdown"), dict)
                else None,
            ),
        )
    return out


def list_plans(client_user_id: str) -> CelebrationPlanListResponse:
    rows = planner_db.list_plans_for_client(client_user_id)
    plans: list[CelebrationPlanListItem] = []
    for row in rows:
        brief_raw = row.get("brief") if isinstance(row.get("brief"), dict) else {}
        plans.append(
            CelebrationPlanListItem(
                plan_id=str(row.get("id") or ""),
                title=str(row.get("title") or "Celebration plan"),
                event_type=brief_raw.get("event_type"),
                location=brief_raw.get("location"),
                confidence_score=row.get("confidence_score"),
                status=str(row.get("status") or "active"),
                created_at=str(row["created_at"]) if row.get("created_at") else None,
                updated_at=str(row["updated_at"]) if row.get("updated_at") else None,
            ),
        )
    return CelebrationPlanListResponse(success=True, plans=plans)


def get_plan(client_user_id: str, plan_id: str) -> CelebrationPlanResponse:
    row = planner_db.get_plan_for_client(plan_id, client_user_id)
    if not row:
        raise NotFoundError("Plan not found.")

    brief_raw = row.get("brief") if isinstance(row.get("brief"), dict) else {}
    brief = CelebrationBrief.model_validate(brief_raw)
    items = row.get("items") if isinstance(row.get("items"), list) else []
    recommendations = _hydrate_recommendations_from_items(items, brief)

    needs = [
        {
            "id": r.need_id,
            "label": r.label,
            "service_key": r.service_key,
            "optional": r.optional,
        }
        for r in recommendations
    ]
    allocated = allocate_budget_bands(
        needs,
        event_type=brief.event_type,
        event_kind=brief.event_kind,
        user_budget_gbp=brief.budget_gbp,
    )
    budget = build_budget_breakdown(
        needs=needs,
        cost_by_need={r.need_id: r.estimated_cost_gbp for r in recommendations},
        allocated_by_need=allocated,
        user_budget_gbp=brief.budget_gbp,
        assumption_by_need={
            r.need_id: r.cost_assumption
            for r in recommendations
            if r.cost_assumption
        },
        guest_count=brief.guest_count,
    )
    confidence = ConfidenceBlock(
        score=int(row.get("confidence_score") or 0),
        reasons=list(row.get("confidence_reasons") or []),
    )
    # Recompute light confidence note if vendors went unavailable
    if any(r.primary and r.primary.unavailable for r in recommendations):
        confidence = compute_confidence(
            brief=brief,
            recommendations=recommendations,
            budget_over=budget.over_budget,
        )

    return _response_from_parts(
        plan_id=str(row.get("id") or plan_id),
        status=str(row.get("status") or "active"),
        brief=brief,
        title=str(row.get("title") or _title_for_brief(brief)),
        summary=str(row.get("summary") or ""),
        confidence=confidence,
        budget=budget,
        recommendations=recommendations,
        created_at=str(row["created_at"]) if row.get("created_at") else None,
        updated_at=str(row["updated_at"]) if row.get("updated_at") else None,
    )


def replace_plan_item(
    client_user_id: str,
    plan_id: str,
    need_id: str,
    *,
    exclude_vendor_user_id: str | None = None,
) -> CelebrationPlanResponse:
    row = planner_db.get_plan_for_client(plan_id, client_user_id)
    if not row:
        raise NotFoundError("Plan not found.")

    brief_raw = row.get("brief") if isinstance(row.get("brief"), dict) else {}
    brief = CelebrationBrief.model_validate(brief_raw)
    items = row.get("items") if isinstance(row.get("items"), list) else []
    target = next((i for i in items if i.get("need_id") == need_id), None)
    if not target:
        raise NotFoundError("That plan item was not found.")

    exclude: set[str] = set()
    if exclude_vendor_user_id:
        exclude.add(str(exclude_vendor_user_id))
    current_primary = target.get("primary_vendor_user_id")
    if current_primary:
        exclude.add(str(current_primary))

    # Other primaries stay claimed
    claimed = {
        str(i.get("primary_vendor_user_id"))
        for i in items
        if i.get("primary_vendor_user_id") and i.get("need_id") != need_id
    }

    need = {
        "id": need_id,
        "label": target.get("label") or need_id,
        "service_key": target.get("service_key") or "",
        "optional": bool(target.get("optional")),
        "keywords": [],
    }
    allocated = allocate_budget_bands(
        [
            {
                "id": i.get("need_id"),
                "service_key": i.get("service_key"),
            }
            for i in items
        ],
        event_type=brief.event_type,
        event_kind=brief.event_kind,
        user_budget_gbp=brief.budget_gbp,
    )
    pool = load_enriched_vendor_pool()
    primary, alts, breakdown, empty_reason = _select_for_need(
        need=need,
        pool=pool,
        brief=brief,
        budget_band=allocated.get(need_id),
        claimed_primaries=claimed,
        exclude_user_ids=exclude,
    )
    rec = _recommendation_from_selection(
        need=need,
        primary=primary,
        alts=alts,
        brief=brief,
        empty_reason=empty_reason,
        breakdown=breakdown,
    )
    if rec.primary is None:
        raise ValidationError(empty_reason or "No more alternatives for this category.")

    # Rebuild costs for budget patch
    updated_items = []
    for i in items:
        if i.get("need_id") == need_id:
            updated_items.append(
                {
                    **i,
                    "primary_vendor_user_id": rec.primary.user_id if rec.primary else None,
                    "alternative_vendor_user_ids": [a.user_id for a in rec.alternatives],
                    "estimated_cost_gbp": rec.estimated_cost_gbp,
                    "cost_assumption": rec.cost_assumption,
                    "why_selected": rec.why_selected,
                    "score_breakdown": _score_breakdown_with_assumption(
                        rec.score_breakdown,
                        rec.cost_assumption,
                    ),
                },
            )
        else:
            updated_items.append(i)

    needs_for_budget = [
        {"id": i.get("need_id"), "label": i.get("label"), "service_key": i.get("service_key")}
        for i in updated_items
    ]
    budget = build_budget_breakdown(
        needs=needs_for_budget,
        cost_by_need={
            str(i.get("need_id")): (
                float(i["estimated_cost_gbp"]) if i.get("estimated_cost_gbp") is not None else None
            )
            for i in updated_items
        },
        allocated_by_need=allocated,
        user_budget_gbp=brief.budget_gbp,
        assumption_by_need={
            str(i.get("need_id")): str(i.get("cost_assumption") or "")
            for i in updated_items
            if i.get("cost_assumption")
        },
        guest_count=brief.guest_count,
    )

    planner_db.update_plan_item(
        plan_id=plan_id,
        client_user_id=client_user_id,
        need_id=need_id,
        patch={
            "primary_vendor_user_id": rec.primary.user_id if rec.primary else None,
            "alternative_vendor_user_ids": [a.user_id for a in rec.alternatives],
            "estimated_cost_gbp": rec.estimated_cost_gbp,
            "why_selected": rec.why_selected,
            "score_breakdown": _score_breakdown_with_assumption(
                rec.score_breakdown,
                rec.cost_assumption,
            ),
        },
        plan_patch={
            "budget_total_gbp": budget.total_estimated_gbp,
            "budget_remaining_gbp": budget.remaining_budget_gbp,
        },
    )
    try:
        from app.features.analytics.events import record_marketplace_event

        record_marketplace_event(
            "celebration_plan_recommendation_replaced",
            actor_user_id=client_user_id,
            vendor_user_id=rec.primary.user_id if rec.primary else None,
            category=str(need.get("service_key") or None),
            payload={"plan_id": plan_id, "need_id": need_id},
        )
    except Exception:
        logger.exception("planner_replace: analytics failed")
    return get_plan(client_user_id, plan_id)


def archive_plan(client_user_id: str, plan_id: str) -> ArchivePlanResponse:
    row = planner_db.archive_plan(plan_id, client_user_id)
    if not row:
        raise NotFoundError("Plan not found.")
    return ArchivePlanResponse(
        success=True,
        plan_id=str(row.get("id") or plan_id),
        status=str(row.get("status") or "archived"),
    )
