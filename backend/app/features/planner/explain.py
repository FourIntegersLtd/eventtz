"""Grounded explanations from FactCards — LLM one-liner or template fallback."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.contracts.planner import CelebrationBrief
from app.core.constants import OPENAI_PLANNER_MODEL
from app.core.logging import get_logger
from app.features.ai.openai_helpers import parse_completion, try_openai_client
from app.features.vendors.public_metrics import format_usual_reply_seconds
from app.features.vendors.ranking.explain_facts import FactCard, build_fact_card

logger = get_logger(__name__)


class _LlmWhy(BaseModel):
    why: str = Field(default="", max_length=220)


class _LlmSummary(BaseModel):
    summary: str = Field(default="", max_length=400)


def template_why_selected(
    fact: FactCard,
    *,
    need_label: str,
    location: str | None,
) -> str:
    """One sentence from real facts only — never invent stats."""
    bits: list[str] = []
    name = fact.business_name or "This vendor"
    if fact.review_average is not None and fact.review_count > 0:
        bits.append(
            f"rated {fact.review_average:.1f}/5 from {fact.review_count} "
            f"{'review' if fact.review_count == 1 else 'reviews'}",
        )
    if fact.completed_bookings > 0:
        bits.append(
            f"{fact.completed_bookings} completed "
            f"{'booking' if fact.completed_bookings == 1 else 'bookings'} on Eventtz",
        )
    reply = format_usual_reply_seconds(fact.avg_response_seconds)
    if reply:
        bits.append(f"usually replies {reply.replace('within ', '')}")
    city = fact.base_city
    if city and location and (
        city.lower() in location.lower() or location.lower() in city.lower()
    ):
        bits.append(f"based in {city}")
    elif city:
        bits.append(f"serving from {city}")
    if fact.price_on_request:
        bits.append("list price on request")
    elif fact.min_list_price_gbp is not None:
        bits.append(f"from about £{fact.min_list_price_gbp:,.0f}")

    if not bits:
        return f"{name} is a solid match for {need_label.lower()} on Eventtz."
    return f"{name} — {'; '.join(bits)}."


def llm_why_selected(
    fact: FactCard,
    *,
    need_label: str,
    event_type: str | None,
) -> str | None:
    client = try_openai_client()
    if client is None:
        return None
    facts = fact.as_dict()
    # Strip nulls so the model cannot invent replacements
    facts = {k: v for k, v in facts.items() if v is not None and v != "" and v != []}
    system = (
        "Write one short sentence explaining why this vendor fits the need. "
        "Use ONLY the provided facts. Never invent ratings, bookings, or prices. "
        "No markdown. Max 40 words."
    )
    user = (
        f"Need: {need_label}\n"
        f"Event type: {event_type or 'celebration'}\n"
        f"Facts: {facts}"
    )
    try:
        parsed = parse_completion(
            client=client,
            model=OPENAI_PLANNER_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format=_LlmWhy,
            log_context="planner_why",
        )
        why = (parsed.why or "").strip()
        return why[:220] if why else None
    except Exception as e:
        logger.warning("planner explain why failed: %s", e)
        return None


def why_for_vendor(
    row: dict[str, Any],
    *,
    need_label: str,
    brief: CelebrationBrief,
) -> str:
    fact = build_fact_card(row)
    llm = llm_why_selected(fact, need_label=need_label, event_type=brief.event_type)
    if llm:
        return llm
    return template_why_selected(fact, need_label=need_label, location=brief.location)


def template_summary(brief: CelebrationBrief, *, title: str, need_labels: list[str]) -> str:
    parts: list[str] = []
    et = (brief.event_type or "celebration").replace("_", " ")
    loc = brief.location or "your area"
    guests = brief.guest_count
    guest_bit = f" for about {guests} guests" if guests else ""
    parts.append(f"{title}: a {et} plan in {loc}{guest_bit}.")
    if need_labels:
        parts.append("Covering " + ", ".join(need_labels[:5]) + ".")
    if brief.preferred_date_invalid:
        parts.append("The date you mentioned looks past — treat availability as open for now.")
    if brief.currency_assumed_gbp:
        parts.append("Budget figures are shown in GBP.")
    if brief.unsupported_categories_mentioned:
        unsupported = ", ".join(brief.unsupported_categories_mentioned)
        parts.append(
            f"We do not list {unsupported} as dedicated categories yet — "
            "focus on the services below.",
        )
    if brief.event_kind == "funeral":
        parts.append("Recommendations keep a respectful, practical tone for a memorial gathering.")
    return " ".join(parts)[:400]


def build_summary(
    brief: CelebrationBrief,
    *,
    title: str,
    need_labels: list[str],
) -> str:
    client = try_openai_client()
    if client is not None:
        system = (
            "Write a short warm paragraph (2–3 sentences) summarising an event plan. "
            "Do not invent vendor names or statistics. No markdown."
        )
        user = (
            f"Title: {title}\n"
            f"Event: {brief.event_type} ({brief.event_kind})\n"
            f"Location: {brief.location}\n"
            f"Guests: {brief.guest_count}\n"
            f"Budget GBP: {brief.budget_gbp}\n"
            f"Needs: {need_labels}\n"
            f"Unsupported mentioned: {brief.unsupported_categories_mentioned}\n"
            f"Past date flag: {brief.preferred_date_invalid}"
        )
        try:
            parsed = parse_completion(
                client=client,
                model=OPENAI_PLANNER_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                response_format=_LlmSummary,
                log_context="planner_summary",
            )
            text = (parsed.summary or "").strip()
            if text:
                return text[:400]
        except Exception as e:
            logger.warning("planner summary LLM failed: %s", e)
    return template_summary(brief, title=title, need_labels=need_labels)
