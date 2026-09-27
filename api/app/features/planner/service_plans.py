"""Generating, reading and editing celebration plans.

`generate_plan` classifies the prompt with `marketplace.service_search.parse_query`
(a cross-slice `service` call, allowed - see `tests/guards/test_slices_call_services_only.py`)
so "photographers in Bristol" is redirected to Browse the same way a marketplace
search would read it, instead of the planner inventing its own classifier.
Every other language-model call here (brief extraction, "why this vendor") is our
own, through the same `LanguageModel` port, each with a deterministic template
fallback so the feature keeps working when the model is unavailable or refuses.

GET/list never recompute `why_selected` or `summary` - they echo the stored
columns - and the one exception (`cost_assumption`) is stored inside an item's
`score_breakdown` at creation and replace time, so a later GET can also just
echo it, only falling back to a fresh `estimate_need_cost` call when it truly is
missing (a plan written before that field existed).
"""

from __future__ import annotations

from datetime import date
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.ports import ChatMessage, LanguageModel
from app.features.marketplace import service_search
from app.features.planner import domain, repository
from app.features.planner.errors import (
    DescribeCelebration,
    InvalidPrompt,
    NoMoreAlternatives,
    PlanArchived,
    PlanItemNotFound,
    PlanNotFound,
    SimpleIntent,
)
from app.features.planner.rows import CelebrationPlanItemRow
from app.features.planner.schemas import (
    ArchivePlanResponse,
    CelebrationBrief,
    CelebrationSummary,
    Confidence,
    EnsureEventResponse,
    PlanDetailResponse,
    PlanListItem,
    PlanListResponse,
    PlannerVendorCard,
    PlanRecommendation,
    ReplaceItemResponse,
)
from app.features.vendors import service_listing
from app.features.vendors.schemas import ListedVendor
from app.features.vendors.service_catalogue import normalize_country_code

log = get_logger(__name__)

# The model asked for our own brief-extraction and "why this vendor" calls (the
# classification call reuses `marketplace.service_search`'s own model choice).
PLANNER_MODEL = "gpt-4o-mini"


class _BriefReply(BaseModel):
    """What we ask the model to read out of the prompt; any field it skips is filled in canned."""

    event_type: str | None = None
    location: str | None = None
    related_locations: list[str] = Field(default_factory=list)
    guest_count: int | None = None
    budget_gbp: float | None = None


class _WhyReply(BaseModel):
    """A one-sentence reason for recommending a vendor."""

    why: str | None = None


def _as_str_or_none(value: object) -> str | None:
    """Narrow a `merge_brief` field (typed `object`, since the dict mixes types) to `str | None`."""
    return value if isinstance(value, str) and value else None


def _as_int_or_none(value: object) -> int | None:
    """Narrow a `merge_brief` field to `int | None`."""
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _as_float_or_none(value: object) -> float | None:
    """Narrow a `merge_brief`/budget-breakdown field to `float | None`."""
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _as_str_list(value: object) -> list[str]:
    """Narrow a `merge_brief` field to `list[str]`."""
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def _brief_messages(prompt: str) -> list[ChatMessage]:
    """The chat prompt for the brief-extraction call."""
    return [
        {
            "role": "system",
            "content": (
                "Read a celebration-planning request and extract its event type, location, "
                "guest count and budget in GBP. Reply with only the fields you are confident about."
            ),
        },
        {"role": "user", "content": prompt},
    ]


def _why_messages(*, business_name: str, city: str | None, need_label: str) -> list[ChatMessage]:
    """The chat prompt for the "why this vendor" call."""
    return [
        {
            "role": "system",
            "content": "In one short sentence, say why this vendor suits the client's need.",
        },
        {
            "role": "user",
            "content": f"Vendor: {business_name} ({city or 'location unknown'}). Need: {need_label}.",
        },
    ]


def _vendor_card(listed: ListedVendor | None, *, fallback_user_id: str) -> PlannerVendorCard:
    """A `PlannerVendorCard` from a listing lookup, or an "unavailable" placeholder without one."""
    if listed is None:
        return PlannerVendorCard(
            user_id=fallback_user_id, business_name="Vendor unavailable", unavailable=True
        )
    payload = listed.payload or {}
    price = payload.get("min_list_price_gbp")
    return PlannerVendorCard(
        user_id=listed.user_id,
        business_name=str(payload.get("businessName") or "Vendor"),
        city=payload.get("baseCity"),
        min_list_price_gbp=price,
        unavailable=False,
        price_on_request=price is None,
    )


def _candidate(listed: ListedVendor) -> domain.VendorCandidate:
    """A `ListedVendor` reduced to what the selection tiering needs."""
    payload = listed.payload or {}
    services = payload.get("servicesOffered") or []
    return domain.VendorCandidate(
        user_id=listed.user_id,
        business_name=str(payload.get("businessName") or "Vendor"),
        city=payload.get("baseCity"),
        min_list_price_gbp=payload.get("min_list_price_gbp"),
        services=frozenset(str(service) for service in services),
        bio=str(payload.get("bio") or ""),
    )


async def _why_for_vendor(
    language_model: LanguageModel,
    *,
    business_name: str,
    city: str | None,
    location: str | None,
    need_label: str,
    min_list_price_gbp: float | None,
) -> str:
    """The model's one-sentence reason, or the deterministic template when it is unavailable."""
    try:
        reply = language_model.parse(
            model=PLANNER_MODEL,
            messages=_why_messages(business_name=business_name, city=city, need_label=need_label),
            reply_model=_WhyReply,
            purpose="planner_why_selected",
        )
        if reply.why and reply.why.strip():
            return reply.why.strip()
    except Exception as error:  # noqa: BLE001 - the model must never break plan generation
        log.warning("planner_why_selected: model call failed, using template: %s", error)
    return domain.template_why_selected(
        business_name=business_name, city=city, location=location, min_list_price_gbp=min_list_price_gbp
    )


async def generate_plan(
    session: AsyncSession, client_user_id: str, prompt: str, *, language_model: LanguageModel
) -> PlanDetailResponse:
    """Turn a client's prompt into a persisted, vendor-backed celebration plan."""
    stripped = prompt.strip()
    if not stripped:
        raise DescribeCelebration
    if domain.prompt_is_nonsense(prompt):
        raise InvalidPrompt

    country_code = normalize_country_code(None)
    parsed = await service_search.parse_query(
        prompt, country_code=country_code, language_model=language_model
    )
    if parsed.mode != "plan":
        raise SimpleIntent

    canned = domain.canned_brief(prompt)
    model_brief: dict[str, Any] = {}
    try:
        reply = language_model.parse(
            model=PLANNER_MODEL,
            messages=_brief_messages(prompt),
            reply_model=_BriefReply,
            purpose="planner_brief",
        )
        model_brief = reply.model_dump()
    except Exception as error:  # noqa: BLE001 - the canned reading always covers us
        log.warning("planner_brief: model call failed, using the canned reading: %s", error)
    merged = domain.merge_brief(model_brief, canned)

    guest_count = _as_int_or_none(merged.get("guest_count"))
    guest_count_used_default = guest_count is None
    if guest_count is None:
        guest_count = domain.DEFAULT_GUEST_COUNT
    budget_gbp = _as_float_or_none(merged.get("budget_gbp"))
    location = _as_str_or_none(merged.get("location"))
    related_locations = _as_str_list(merged.get("related_locations"))
    event_type = domain.normalize_event_type(_as_str_or_none(merged.get("event_type")))
    title = domain.build_title(event_type=event_type, location=location, guest_count=guest_count)

    needs = domain.needs_for_event(event_type)
    allocated = domain.allocate_budget_bands(needs, user_budget_gbp=budget_gbp)

    service_keys = [str(need["service_key"]) for need in needs]
    pool_listed = await service_listing.listed_vendors(
        session, country_code=country_code, service_types=service_keys, city_query=location
    )
    pool = [_candidate(listed) for listed in pool_listed]

    items: list[dict[str, Any]] = []
    empty_need_labels: list[str] = []
    has_low_review_vendor = False
    cost_by_need: dict[str, float | None] = {}
    assumption_by_need: dict[str, str] = {}
    for need in needs:
        need_id = str(need["need_id"])
        service_key = str(need["service_key"])
        keywords = domain.need_keywords(need_id)
        ranked = domain.rank_candidates(
            pool,
            service_key=service_key,
            location=location,
            related_locations=related_locations,
            budget_band_gbp=allocated.get(need_id),
            keywords=keywords,
        )
        primary = ranked[0] if ranked else None
        alternatives = ranked[1:3]
        why_selected: str | None = None
        cost = None
        if primary is not None:
            has_low_review_vendor = True
            cost = domain.estimate_need_cost(
                service_key=service_key,
                guest_count=guest_count,
                primary_min_list_price=primary.min_list_price_gbp,
                vendor_name=primary.business_name,
            )
            why_selected = await _why_for_vendor(
                language_model,
                business_name=primary.business_name,
                city=primary.city,
                location=location,
                need_label=str(need["label"]),
                min_list_price_gbp=primary.min_list_price_gbp,
            )
        else:
            empty_need_labels.append(str(need["label"]))
        cost_by_need[need_id] = cost.amount_gbp if cost else None
        if cost:
            assumption_by_need[need_id] = cost.assumption
        items.append(
            {
                "need_id": need_id,
                "label": need["label"],
                "service_key": service_key,
                "optional": need["optional"],
                "primary_vendor_user_id": primary.user_id if primary else None,
                "alternative_vendor_user_ids": [candidate.user_id for candidate in alternatives],
                "estimated_cost_gbp": cost.amount_gbp if cost else None,
                "why_selected": why_selected,
                "score_breakdown": {"cost_assumption": cost.assumption} if cost else None,
            }
        )

    breakdown = domain.build_budget_breakdown(
        needs=needs,
        cost_by_need=cost_by_need,
        assumption_by_need=assumption_by_need,
        allocated_by_need=allocated,
        user_budget_gbp=budget_gbp,
        guest_count_used_default=guest_count_used_default,
    )
    confidence_score, confidence_reasons = domain.compute_confidence(
        empty_need_labels=empty_need_labels,
        has_low_review_vendor=has_low_review_vendor,
        budget_over=bool(breakdown["over_budget"]),
        guest_count_used_default=guest_count_used_default,
        budget_stated=budget_gbp is not None,
    )
    need_labels = [str(need["label"]) for need in needs if cost_by_need.get(str(need["need_id"])) is not None]
    summary = domain.template_summary(
        title=title,
        event_type=event_type,
        location=location,
        guest_count=guest_count,
        need_labels=need_labels,
    )

    brief = CelebrationBrief(
        event_type=event_type,
        location=location,
        related_locations=related_locations,
        guest_count=guest_count,
        budget_gbp=budget_gbp,
        raw_prompt=prompt,
    )

    plan_row = await repository.insert_plan(
        session,
        client_user_id=client_user_id,
        title=title,
        raw_prompt=prompt,
        brief=brief.model_dump(),
        confidence_score=confidence_score,
        confidence_reasons=confidence_reasons,
        summary=summary,
        budget_total_gbp=_as_float_or_none(breakdown["total_estimated_gbp"]),
        budget_remaining_gbp=_as_float_or_none(breakdown["remaining_budget_gbp"]),
    )
    await repository.insert_plan_items(session, plan_row.id, items)
    return await get_plan_detail(session, client_user_id, plan_row.id)


async def list_plans(session: AsyncSession, client_user_id: str) -> PlanListResponse:
    """The client's own active plans, in the compact list-item shape."""
    plans = await repository.list_plans(session, client_user_id)
    items = [
        PlanListItem(
            plan_id=plan.id,
            title=plan.title,
            event_type=str(plan.brief.get("event_type") or "birthdays"),
            location=plan.brief.get("location"),
            confidence_score=plan.confidence_score,
            status=plan.status,
            created_at=plan.created_at or "",
            updated_at=plan.updated_at or "",
        )
        for plan in plans
    ]
    return PlanListResponse(plans=items)


async def _recommendation_for_item(session: AsyncSession, item: CelebrationPlanItemRow) -> PlanRecommendation:
    """Build a plan item's recommendation card, re-checking the primary vendor's listing."""
    primary_card: PlannerVendorCard | None = None
    if item.primary_vendor_user_id:
        listed = await service_listing.listed_vendor(session, item.primary_vendor_user_id)
        primary_card = _vendor_card(listed, fallback_user_id=item.primary_vendor_user_id)
    alternative_cards = []
    for vendor_id in item.alternative_vendor_user_ids:
        listed = await service_listing.listed_vendor(session, vendor_id)
        alternative_cards.append(_vendor_card(listed, fallback_user_id=vendor_id))
    return PlanRecommendation(
        need_id=item.need_id,
        label=item.label,
        service_key=item.service_key,
        optional=item.optional,
        primary=primary_card,
        alternatives=alternative_cards,
        estimated_cost_gbp=item.estimated_cost_gbp,
        why_selected=item.why_selected,
        empty_reason=None if primary_card else f"No approved vendors found for {item.label} yet.",
    )


def _needs_from_items(items: list[CelebrationPlanItemRow]) -> list[dict[str, Any]]:
    """The plan's stored items reduced to what `domain`'s budget functions need."""
    return [{"need_id": item.need_id, "label": item.label, "service_key": item.service_key} for item in items]


async def get_plan_detail(session: AsyncSession, client_user_id: str, plan_id: str) -> PlanDetailResponse:
    """The plan's full detail: stored brief/summary echoed verbatim, budget always recomputed."""
    plan = await repository.get_plan(session, client_user_id, plan_id)
    if plan is None:
        raise PlanNotFound
    items = await repository.get_plan_items(session, plan_id)
    recommendations = [await _recommendation_for_item(session, item) for item in items]

    any_unavailable = any(
        recommendation.primary is not None and recommendation.primary.unavailable
        for recommendation in recommendations
    )
    if any_unavailable:
        empty_labels = [
            recommendation.label for recommendation in recommendations if recommendation.primary is None
        ]
        confidence_score, confidence_reasons = domain.compute_confidence(
            empty_need_labels=empty_labels,
            has_low_review_vendor=True,
            budget_over=False,
            guest_count_used_default=False,
            budget_stated=plan.brief.get("budget_gbp") is not None,
        )
    else:
        confidence_score = plan.confidence_score or 0
        confidence_reasons = [str(reason) for reason in (plan.confidence_reasons or [])]

    needs = _needs_from_items(items)
    cost_by_need = {item.need_id: item.estimated_cost_gbp for item in items}
    allocated = domain.allocate_budget_bands(needs, user_budget_gbp=plan.brief.get("budget_gbp"))
    assumption_by_need: dict[str, str] = {}
    for item in items:
        stored_assumption = (
            (item.score_breakdown or {}).get("cost_assumption") if item.score_breakdown else None
        )
        if stored_assumption:
            assumption_by_need[item.need_id] = str(stored_assumption)
        else:
            primary_recommendation = next(
                (
                    recommendation
                    for recommendation in recommendations
                    if recommendation.need_id == item.need_id
                ),
                None,
            )
            price = (
                primary_recommendation.primary.min_list_price_gbp
                if primary_recommendation and primary_recommendation.primary
                else None
            )
            name = (
                primary_recommendation.primary.business_name
                if primary_recommendation and primary_recommendation.primary
                else None
            )
            assumption_by_need[item.need_id] = domain.estimate_need_cost(
                service_key=item.service_key,
                guest_count=plan.brief.get("guest_count"),
                primary_min_list_price=price,
                vendor_name=name,
            ).assumption
    budget = domain.build_budget_breakdown(
        needs=needs,
        cost_by_need=cost_by_need,
        assumption_by_need=assumption_by_need,
        allocated_by_need=allocated,
        user_budget_gbp=plan.brief.get("budget_gbp"),
        guest_count_used_default=False,
    )

    return PlanDetailResponse(
        plan_id=plan.id,
        status=plan.status,
        client_event_id=plan.client_event_id,
        celebration=CelebrationSummary(
            title=plan.title,
            event_type=str(plan.brief.get("event_type") or "birthdays"),
            location=plan.brief.get("location"),
            guest_count=int(plan.brief.get("guest_count") or domain.DEFAULT_GUEST_COUNT),
            budget_gbp=plan.brief.get("budget_gbp"),
            preferred_date=plan.brief.get("preferred_date"),
            summary=plan.summary,
        ),
        brief=CelebrationBrief.model_validate(plan.brief),
        confidence=Confidence(score=confidence_score, reasons=confidence_reasons),
        budget=budget,
        recommendations=recommendations,
        next_steps=domain.suggested_next_steps(
            [
                domain.NeedOutcome(
                    label=recommendation.label,
                    has_primary=recommendation.primary is not None,
                    optional=recommendation.optional,
                )
                for recommendation in recommendations
            ],
            budget_stated=plan.brief.get("budget_gbp") is not None,
        ),
        created_at=plan.created_at or "",
        updated_at=plan.updated_at or "",
    )


async def archive_plan(session: AsyncSession, client_user_id: str, plan_id: str) -> ArchivePlanResponse:
    """Flip a plan to archived; it stops appearing in the list but its detail stays readable."""
    plan = await repository.archive_plan(session, client_user_id, plan_id)
    if plan is None:
        raise PlanNotFound
    return ArchivePlanResponse(plan_id=plan.id, status=plan.status)


async def ensure_client_event_for_plan(
    session: AsyncSession, client_user_id: str, plan_id: str
) -> EnsureEventResponse:
    """Turn a plan into a real client event, reusing one already linked instead of duplicating it."""
    plan = await repository.get_plan(session, client_user_id, plan_id)
    if plan is None:
        raise PlanNotFound
    if plan.status == "archived":
        raise PlanArchived
    if plan.client_event_id:
        event = await repository.get_client_event(session, client_user_id, plan.client_event_id)
        if event is not None:
            return EnsureEventResponse(
                plan_id=plan.id,
                event_id=event.id,
                title=event.title,
                event_date=event.event_date,
                event_address=event.event_address,
                event_postcode=event.event_postcode,
            )
    location = plan.brief.get("location")
    event = await repository.insert_client_event(
        session,
        client_user_id=client_user_id,
        title=plan.title,
        event_date=date.today(),
        event_end_date=None,
        event_address=location,
        event_postcode=None,
    )
    await repository.link_plan_event(session, plan.id, event.id)
    return EnsureEventResponse(
        plan_id=plan.id,
        event_id=event.id,
        title=event.title,
        event_date=event.event_date,
        event_address=event.event_address,
        event_postcode=event.event_postcode,
    )


async def replace_plan_item(
    session: AsyncSession, client_user_id: str, plan_id: str, need_id: str, *, language_model: LanguageModel
) -> ReplaceItemResponse:
    """Swap a need's primary vendor for the next-best untried candidate."""
    plan = await repository.get_plan(session, client_user_id, plan_id)
    if plan is None:
        raise PlanNotFound
    if plan.status == "archived":
        raise PlanArchived
    item = await repository.get_plan_item_by_need(session, plan_id, need_id)
    if item is None:
        raise PlanItemNotFound

    country_code = normalize_country_code(None)
    location = plan.brief.get("location")
    pool_listed = await service_listing.listed_vendors(
        session, country_code=country_code, service_types=[item.service_key], city_query=location
    )
    pool = [_candidate(listed) for listed in pool_listed]
    already_shown = {item.primary_vendor_user_id, *item.alternative_vendor_user_ids} - {None}
    allocated = domain.allocate_budget_bands(
        [{"need_id": item.need_id, "service_key": item.service_key}],
        user_budget_gbp=plan.brief.get("budget_gbp"),
    )
    keywords = domain.need_keywords(item.need_id)
    ranked = domain.rank_candidates(
        pool,
        service_key=item.service_key,
        location=location,
        related_locations=plan.brief.get("related_locations") or [],
        budget_band_gbp=allocated.get(item.need_id),
        keywords=keywords,
    )
    remaining = [candidate for candidate in ranked if candidate.user_id not in already_shown]
    if not remaining:
        raise NoMoreAlternatives
    new_primary = remaining[0]
    new_alternatives = remaining[1:3]

    cost = domain.estimate_need_cost(
        service_key=item.service_key,
        guest_count=plan.brief.get("guest_count"),
        primary_min_list_price=new_primary.min_list_price_gbp,
        vendor_name=new_primary.business_name,
    )
    why_selected = await _why_for_vendor(
        language_model,
        business_name=new_primary.business_name,
        city=new_primary.city,
        location=location,
        need_label=item.label,
        min_list_price_gbp=new_primary.min_list_price_gbp,
    )
    updated = await repository.update_plan_item(
        session,
        item.id,
        primary_vendor_user_id=new_primary.user_id,
        alternative_vendor_user_ids=[candidate.user_id for candidate in new_alternatives],
        estimated_cost_gbp=cost.amount_gbp,
        why_selected=why_selected,
        score_breakdown={"cost_assumption": cost.assumption},
    )
    await repository.touch_plan(session, plan_id)
    recommendation = await _recommendation_for_item(session, updated)
    return ReplaceItemResponse(plan_id=plan.id, recommendation=recommendation)
