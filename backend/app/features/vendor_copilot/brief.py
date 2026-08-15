"""Daily growth brief and suggested actions for vendors."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.contracts.vendor_copilot import (
    CopilotAction,
    MarketDemandInsight,
    VendorCopilotBriefResponse,
)
from app.core.constants import OPENAI_COPILOT_MODEL
from app.core.logging import get_logger
from app.features.ai.openai_helpers import parse_completion, require_openai_client
from app.features.help import queries
from app.features.help.help_article_keyword_search import format_articles_for_prompt, retrieve_articles
from app.features.vendor_copilot.brief_cache import (
    BriefNarrationCacheEntry,
    compute_brief_fingerprint,
    get_or_compute_brief_narration,
)
from app.features.vendor_copilot.context import build_vendor_context, format_vendor_copilot_prompt_context
from app.features.vendor_copilot.demand import get_market_demand_insights

logger = get_logger(__name__)


def _deterministic_actions(ctx: dict[str, Any]) -> list[CopilotAction]:
    actions: list[CopilotAction] = []

    if not ctx.get("payouts_verified"):
        actions.append(
            CopilotAction(
                kind="open_payments",
                title="Set up payouts",
                rationale="Connect Stripe so you can accept bookings and get paid.",
                href="/vendor/payments",
            )
        )

    pending = ctx.get("pending_bookings") or []
    if pending:
        first = pending[0]
        bid = str(first.get("id") or "")
        name = str(first.get("event_name") or "Booking enquiry")
        actions.append(
            CopilotAction(
                kind="open_booking",
                title=f"Reply to {name}",
                rationale="Pending enquiries hurt your response score. Reply within 2 hours when you can.",
                payload={"booking_request_id": bid},
                href=f"/vendor/bookings/{bid}" if bid else "/vendor/bookings",
            )
        )

    levers = ctx.get("growth_levers") or []
    weak = sorted(
        [lev for lev in levers if isinstance(lev, dict) and lev.get("status") == "needs_work"],
        key=lambda x: int(x.get("score") or 0),
    )
    for lev in weak[:2]:
        key = str(lev.get("key") or "")
        if key == "listing":
            actions.append(
                CopilotAction(
                    kind="edit_profile",
                    title="Improve your listing",
                    rationale=str(lev.get("tip") or "Update your profile to attract more clients."),
                    href="/vendor/profile",
                )
            )
        elif key == "response" and not pending:
            actions.append(
                CopilotAction(
                    kind="open_messages",
                    title="Check messages",
                    rationale=str(lev.get("tip") or "Stay on top of client messages."),
                    href="/vendor/messages",
                )
            )
        elif key == "conversion":
            actions.append(
                CopilotAction(
                    kind="open_analytics",
                    title="Review your funnel",
                    rationale=str(lev.get("tip") or "See where clients drop off."),
                    href="/vendor/analytics",
                )
            )
        elif key == "availability":
            actions.append(
                CopilotAction(
                    kind="edit_profile",
                    title="Update availability",
                    rationale=str(lev.get("tip") or "Set when you are bookable."),
                    href="/vendor/profile?step=5",
                )
            )

    if not ctx.get("listing_visible") and ctx.get("payouts_verified"):
        actions.append(
            CopilotAction(
                kind="edit_profile",
                title="Check listing status",
                rationale="Your profile may not be visible to clients yet. Review your listing settings.",
                href="/vendor/profile",
            )
        )

    seen: set[str] = set()
    deduped: list[CopilotAction] = []
    for a in actions:
        sig = f"{a.action_type}:{a.href}"
        if sig in seen:
            continue
        seen.add(sig)
        deduped.append(a)
    return deduped[:3]


class BriefNarration(BaseModel):
    greeting: str
    summary_markdown: str = Field(
        description=(
            "Markdown brief with ## headings and - bullet lists; bold key metrics. No paragraph walls."
        ),
    )


def _fallback_narration(ctx: dict[str, Any], actions: list[CopilotAction]) -> BriefNarrationCacheEntry:
    name = str(ctx.get("business_name") or "there")
    score = int(ctx.get("growth_score") or 0)
    top_action = actions[0].title if actions else "Keep your listing up to date"
    summary = (
        f"**Growth Score: {score}/100**\n\n"
        f"## Today's focus\n"
        f"- {top_action}\n\n"
        "## Keep momentum\n"
        "- Reply quickly to enquiries\n"
        "- Keep packages clear and portfolio photos fresh"
    )
    return BriefNarrationCacheEntry(
        greeting=f"Good to see you, {name}",
        summary_markdown=summary,
    )


def _generate_narration_llm(
    ctx: dict[str, Any],
    actions: list[CopilotAction],
) -> BriefNarrationCacheEntry:
    facts = format_vendor_copilot_prompt_context(ctx)
    action_lines = "\n".join(f"- {a.title}: {a.rationale}" for a in actions) or "- Keep your listing fresh"

    pool = queries.list_all_published_for_audience(audience="vendor")
    retrieved = retrieve_articles(question="grow bookings listing packages analytics", articles=pool, limit=4)
    help_corpus = format_articles_for_prompt(retrieved)

    system = (
        "You are Abba, the Eventtz vendor growth guide.\n"
        "Write a warm, concise daily brief using ONLY the vendor facts provided.\n"
        "Use plain English. Avoid jargon (no KPI, GMV, API, Stripe Connect).\n"
        "Never invent numbers — only use facts from vendor_data.\n"
        "summary_markdown MUST use Markdown structure (not long paragraphs):\n"
        "- Bold opening line with Growth Score (**Growth Score: 62/100**).\n"
        "- ## Today's focus with one bullet for the top suggested action.\n"
        "- ## What's working — bullet list of strengths (max 3 bullets).\n"
        "- ## Focus next — bullet list of 2–3 improvement tips from weak levers.\n"
        "- Bold key metrics inline. Short bullets only; no paragraph walls.\n"
        "greeting: one friendly line using the business name.\n"
        "Do not promise specific booking counts."
    )

    messages = [
        {"role": "system", "content": system},
        {"role": "system", "content": f"Vendor facts:\n{facts}\n\nSuggested actions:\n{action_lines}"},
        {
            "role": "system",
            "content": f"Relevant help articles (for tone only, do not copy verbatim):\n{help_corpus}",
        },
        {"role": "user", "content": "Write today's growth brief for this vendor."},
    ]

    try:
        client = require_openai_client(log_context="vendor_copilot_brief")
        parsed = parse_completion(
            client=client,
            model=OPENAI_COPILOT_MODEL,
            messages=messages,
            response_format=BriefNarration,
            log_context="vendor_copilot_brief",
        )
        return BriefNarrationCacheEntry(
            greeting=parsed.greeting.strip(),
            summary_markdown=parsed.summary_markdown.strip(),
        )
    except Exception:
        logger.exception("vendor_copilot brief: LLM failed, using fallback")
        return _fallback_narration(ctx, actions)


def _load_demand(ctx: dict[str, Any]) -> list[MarketDemandInsight]:
    demand_raw = get_market_demand_insights(
        base_city=str(ctx.get("base_city") or ""),
        services=list(ctx.get("services") or []),
        country_code=str(ctx.get("country_code") or "GB"),
    )
    return [MarketDemandInsight(**d) for d in demand_raw]


def build_daily_brief(vendor_user_id: str) -> VendorCopilotBriefResponse:
    now = datetime.now(UTC)
    ctx = build_vendor_context(vendor_user_id)
    if not ctx.get("found"):
        return VendorCopilotBriefResponse(
            greeting="Welcome",
            summary_markdown="Complete your vendor profile to get personalised growth tips.",
            growth_score=0,
            suggested_actions=[
                CopilotAction(
                    kind="edit_profile",
                    title="Complete your profile",
                    rationale="Finish onboarding so clients can find you.",
                    href="/vendor/profile",
                )
            ],
            generated_at=now,
            context_fingerprint="profile_missing",
            narration_cached=False,
        )

    fingerprint = compute_brief_fingerprint(ctx)
    actions = _deterministic_actions(ctx)
    demand = _load_demand(ctx)
    score = int(ctx.get("growth_score") or 0)

    narration, was_cached = get_or_compute_brief_narration(
        vendor_user_id,
        fingerprint,
        lambda: _generate_narration_llm(ctx, actions),
    )

    return VendorCopilotBriefResponse(
        greeting=narration.greeting,
        summary_markdown=narration.summary_markdown,
        growth_score=score,
        suggested_actions=actions,
        demand_insights=demand,
        generated_at=now,
        context_fingerprint=fingerprint,
        narration_cached=was_cached,
    )
