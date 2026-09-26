"""The vendor's daily Growth Brief: a Growth Score, suggested actions and plain-English narration.

The LLM narration step is best-effort: any failure (including the language model being
unavailable) is caught here and replaced with a fixed, deterministic summary, so this route
never surfaces a 503 the way `ask`/`draft-reply`/`review-packages` do (a baseline quirk, kept
on purpose — see `test_copilot_brief_with_a_profile_returns_fallback_narration_without_openai`
in `acceptance/test_ai_onboarding.py`).
"""

from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.logging import get_logger
from app.core.ports import ChatMessage, LanguageModel
from app.features.bookings.schemas import VendorBookingListItem
from app.features.bookings.service_queries import vendor_bookings
from app.features.copilot.domain import compute_growth_score
from app.features.copilot.schemas import CopilotAction, MarketDemandInsight, VendorCopilotBriefResponse
from app.features.reviews.service_vendor import list_own_reviews
from app.features.vendors.service_profile import get_profile_state

logger = get_logger(__name__)

# Same underlying model as the rest of the co-pilot's LLM calls.
COPILOT_MODEL = "gpt-4o-mini"


class _BriefNarration(BaseModel):
    """The model's structured reply for the daily brief's narration."""

    greeting: str = ""
    summary_markdown: str = Field(default="")


async def _pending_bookings(session: AsyncSession, vendor_user_id: str) -> list[VendorBookingListItem]:
    """Up to 5 of the vendor's pending enquiries, most recent first."""
    bookings = await vendor_bookings(
        session,
        vendor_user_id,
        group="all",
        status="pending",
        payment_status=None,
        exclude_payment_status=None,
    )
    return bookings[:5]


def _deterministic_actions(
    *,
    payouts_verified: bool,
    listing_visible: bool,
    pending: list[VendorBookingListItem],
    levers: list[dict[str, Any]],
) -> list[CopilotAction]:
    """The same fixed, non-LLM suggestions the baseline computes: payouts, then weak levers."""
    actions: list[CopilotAction] = []

    if not payouts_verified:
        actions.append(
            CopilotAction(
                action_type="open_payments",
                title="Set up payouts",
                rationale="Connect Stripe so you can accept bookings and get paid.",
                href="/vendor/payments",
            )
        )

    if pending:
        first = pending[0]
        actions.append(
            CopilotAction(
                action_type="open_booking",
                title=f"Reply to {first.event_name}",
                rationale="Pending enquiries hurt your response score. Reply within 2 hours when you can.",
                action_data={"booking_request_id": first.booking_request_id},
                href=f"/vendor/bookings/{first.booking_request_id}",
            )
        )

    weak_levers = sorted(
        (lever for lever in levers if lever.get("status") == "needs_work"),
        key=lambda lever: int(lever.get("score") or 0),
    )
    for lever in weak_levers[:2]:
        key = lever.get("key")
        if key == "listing":
            actions.append(
                CopilotAction(
                    action_type="edit_profile",
                    title="Improve your listing",
                    rationale=str(lever.get("tip") or "Update your profile to attract more clients."),
                    href="/vendor/profile",
                )
            )
        elif key == "response" and not pending:
            actions.append(
                CopilotAction(
                    action_type="open_messages",
                    title="Check messages",
                    rationale=str(lever.get("tip") or "Stay on top of client messages."),
                    href="/vendor/messages",
                )
            )
        elif key == "conversion":
            actions.append(
                CopilotAction(
                    action_type="open_analytics",
                    title="Review your funnel",
                    rationale=str(lever.get("tip") or "See where clients drop off."),
                    href="/vendor/analytics",
                )
            )
        elif key == "availability":
            actions.append(
                CopilotAction(
                    action_type="edit_profile",
                    title="Update availability",
                    rationale=str(lever.get("tip") or "Set when you are bookable."),
                    href="/vendor/profile?step=5",
                )
            )

    if not listing_visible and payouts_verified:
        actions.append(
            CopilotAction(
                action_type="edit_profile",
                title="Check listing status",
                rationale="Your profile may not be visible to clients yet. Review your listing settings.",
                href="/vendor/profile",
            )
        )

    seen: set[str] = set()
    deduped: list[CopilotAction] = []
    for action in actions:
        signature = f"{action.action_type}:{action.href}"
        if signature in seen:
            continue
        seen.add(signature)
        deduped.append(action)
    return deduped[:3]


def _fallback_narration(*, business_name: str, score: int, actions: list[CopilotAction]) -> _BriefNarration:
    """The fixed narration served whenever the LLM call is skipped or fails."""
    top_action = actions[0].title if actions else "Keep your listing up to date"
    summary = (
        f"**Growth Score: {score}/100**\n\n"
        "## Today's focus\n"
        f"- {top_action}\n\n"
        "## Keep momentum\n"
        "- Reply quickly to enquiries\n"
        "- Keep packages clear and portfolio photos fresh"
    )
    return _BriefNarration(greeting=f"Good to see you, {business_name}", summary_markdown=summary)


async def _narrate(
    *,
    language_model: LanguageModel,
    business_name: str,
    score: int,
    levers: list[dict[str, Any]],
    actions: list[CopilotAction],
) -> _BriefNarration:
    """Ask the language model for a warmer brief; any failure falls back to the fixed copy."""
    action_lines = "\n".join(f"- {action.title}: {action.rationale}" for action in actions) or (
        "- Keep your listing fresh"
    )
    lever_lines = "\n".join(
        f"- {lever['label']}: {lever['score']}/100 ({lever['status']})" for lever in levers
    )
    messages: list[ChatMessage] = [
        {
            "role": "system",
            "content": (
                "You are Abba, the Eventtz vendor growth guide. Write a warm, concise daily brief "
                "using ONLY the vendor facts given. Plain English, no jargon. summary_markdown must "
                "use Markdown structure: a bold opening line with the Growth Score, then "
                "## Today's focus and ## Keep momentum bullet sections."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Business: {business_name}\nGrowth Score: {score}/100\n\nLevers:\n{lever_lines}\n\n"
                f"Suggested actions:\n{action_lines}"
            ),
        },
    ]
    try:
        reply = await asyncio.to_thread(
            language_model.parse,
            model=COPILOT_MODEL,
            messages=messages,
            reply_model=_BriefNarration,
            purpose="vendor_copilot_brief",
        )
        if not reply.greeting.strip() or not reply.summary_markdown.strip():
            raise ValueError("empty narration")
        return _BriefNarration(
            greeting=reply.greeting.strip(),
            summary_markdown=reply.summary_markdown.strip(),
        )
    except Exception:
        # Any failure here — the model being unavailable, refusing, or replying oddly —
        # falls back to the deterministic copy: the brief never fails outright.
        logger.warning("vendor_copilot brief: narration failed, using fallback business=%s", business_name)
        return _fallback_narration(business_name=business_name, score=score, actions=actions)


async def build_daily_brief(
    session: AsyncSession, principal: Principal, *, language_model: LanguageModel
) -> VendorCopilotBriefResponse:
    """The vendor's daily brief: Growth Score, suggested actions, and a plain-English summary."""
    now = datetime.now(UTC)
    profile = await get_profile_state(session, principal)
    if profile.updated_at is None:
        return VendorCopilotBriefResponse(
            greeting="Welcome",
            summary_markdown="Complete your vendor profile to get personalised growth tips.",
            growth_score=0,
            suggested_actions=[
                CopilotAction(
                    action_type="edit_profile",
                    title="Complete your profile",
                    rationale="Finish onboarding so clients can find you.",
                    href="/vendor/profile",
                )
            ],
            demand_insights=[],
            generated_at=now,
            context_fingerprint="profile_missing",
            narration_cached=False,
        )

    reviews = await list_own_reviews(session, vendor_user_id=principal.id)
    analytics_overview = {
        "avg_customer_rating": reviews.average_rating,
        "review_count": reviews.review_count,
    }
    score_data = compute_growth_score(
        payload=profile.profile_form_data,
        listing_visible=profile.listing_visible,
        payouts_verified=profile.payouts_verified,
        analytics_overview=analytics_overview,
    )
    pending = await _pending_bookings(session, principal.id)
    actions = _deterministic_actions(
        payouts_verified=profile.payouts_verified,
        listing_visible=profile.listing_visible,
        pending=pending,
        levers=score_data["levers"],
    )
    business_name = str(profile.profile_form_data.get("businessName") or "Your business").strip()
    narration = await _narrate(
        language_model=language_model,
        business_name=business_name,
        score=score_data["score"],
        levers=score_data["levers"],
        actions=actions,
    )

    # Market-demand insights need cross-vendor marketplace aggregates (how many approved
    # vendors offer this service, how many in this city) that no slice exposes a service
    # function for yet; left empty rather than reading another slice's tables directly.
    # Matches the acceptance suite's frozen `demand_insights == []`. Hand-off: a future
    # `vendors.service_demand.market_demand_insights(...)` could fill this in.
    demand_insights: list[MarketDemandInsight] = []

    return VendorCopilotBriefResponse(
        greeting=narration.greeting,
        summary_markdown=narration.summary_markdown,
        growth_score=score_data["score"],
        suggested_actions=actions,
        demand_insights=demand_insights,
        generated_at=now,
        context_fingerprint=f"{profile.updated_at}:{score_data['score']}",
        narration_cached=False,
    )
