"""Ask the vendor Growth Co-pilot a question, grounded in the vendor's own profile facts.

The whole chat call goes through the `LanguageModel` port, so with no OpenAI key configured
this always raises `LanguageModelUnavailable` (503) — see
`acceptance/test_ai_onboarding.py::test_copilot_ask_without_openai_key_is_503`.
"""

from __future__ import annotations

import asyncio
import json

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import Principal
from app.core.ports import ChatMessage, LanguageModel
from app.features.bookings.errors import BookingNotFound
from app.features.bookings.service_queries import vendor_booking_detail
from app.features.copilot.domain import compute_growth_score
from app.features.copilot.errors import QuestionRequired
from app.features.copilot.schemas import (
    CopilotAction,
    CopilotActionKind,
    CopilotAskMessage,
    CopilotAskResponse,
)
from app.features.copilot.service_brief import COPILOT_MODEL
from app.features.reviews.service_vendor import list_own_reviews
from app.features.vendors.service_profile import get_profile_state

# How many prior chat turns are replayed back to the model.
_MAX_HISTORY_TURNS = 8

_SYSTEM_PROMPT = """You are Abba, the Eventtz vendor growth guide.
Help vendors get more clients and convert enquiries into bookings.

Ground every answer in the vendor facts given. Use plain English, no jargon.

answer_markdown MUST be well-structured Markdown: a bold opening line, ## headings for more
than one topic, bullet lists for tips. Never one long paragraph.

If the question is about refunds, disputes, account suspension, or payout problems,
set escalate_to_human=true and tell them to use Contact or Disputes in the portal.

suggested_actions: up to 3 cards with kind one of edit_profile, open_booking, open_payments,
open_analytics, open_messages, apply_package_patch. Never invent booking ids or metrics."""


class _AskActionPayload(BaseModel):
    """Strict payload shape for the model's structured reply (no free-form dict)."""

    model_config = ConfigDict(extra="forbid")

    booking_request_id: str | None = None
    package_id: str | None = None


class _AskAction(BaseModel):
    """One suggested action, as the model returns it."""

    model_config = ConfigDict(extra="forbid")

    kind: CopilotActionKind
    title: str
    rationale: str
    payload: _AskActionPayload = Field(default_factory=_AskActionPayload)
    href: str | None = None


class _AskReply(BaseModel):
    """The model's structured reply to a co-pilot question."""

    model_config = ConfigDict(extra="forbid")

    answer_markdown: str = ""
    suggested_actions: list[_AskAction] = Field(default_factory=list, max_length=3)
    escalate_to_human: bool = False
    escalate_reason: str | None = None


def _vendor_facts(*, business_name: str, score: int, levers: list[dict[str, object]]) -> str:
    """A compact JSON block of facts the model may ground its answer in — no secrets."""
    return json.dumps(
        {"business_name": business_name, "growth_score": score, "growth_levers": levers},
        ensure_ascii=False,
    )


async def _booking_context(session: AsyncSession, vendor_user_id: str, booking_request_id: str) -> str:
    """A short block describing one booking, or nothing when the vendor does not own it."""
    try:
        booking = await vendor_booking_detail(session, vendor_user_id, booking_request_id)
    except BookingNotFound:
        return ""
    return (
        f"\n\nActive booking context:\n- id: {booking.booking_request_id}\n"
        f"- event: {booking.event_name}\n- date: {booking.event_date}\n"
        f"- status: {booking.booking_status}"
    )


async def ask_copilot(
    session: AsyncSession,
    principal: Principal,
    *,
    question: str,
    history: list[CopilotAskMessage],
    booking_request_id: str | None,
    language_model: LanguageModel,
) -> CopilotAskResponse:
    """Answer a vendor's question, grounded in their own Growth Score and (optionally) a booking."""
    asked = question.strip()
    if not asked:
        raise QuestionRequired()

    profile = await get_profile_state(session, principal)
    reviews = await list_own_reviews(session, vendor_user_id=principal.id)
    score_data = compute_growth_score(
        payload=profile.profile_form_data,
        listing_visible=profile.listing_visible,
        payouts_verified=profile.payouts_verified,
        analytics_overview={
            "avg_customer_rating": reviews.average_rating,
            "review_count": reviews.review_count,
        },
    )
    business_name = str(profile.profile_form_data.get("businessName") or "Your business").strip()
    facts = _vendor_facts(business_name=business_name, score=score_data["score"], levers=score_data["levers"])

    booking_context = ""
    if booking_request_id:
        booking_context = await _booking_context(session, principal.id, booking_request_id)

    messages: list[ChatMessage] = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "system", "content": f"vendor_data:\n{facts}{booking_context}"},
    ]
    for turn in history[-_MAX_HISTORY_TURNS:]:
        content = turn.content.strip()
        if not content:
            continue
        if turn.message_role == "assistant":
            messages.append({"role": "assistant", "content": content[:1500]})
        else:
            messages.append({"role": "user", "content": content[:1500]})
    messages.append({"role": "user", "content": asked[:2000]})

    reply = await asyncio.to_thread(
        language_model.parse,
        model=COPILOT_MODEL,
        messages=messages,
        reply_model=_AskReply,
        purpose="vendor_copilot_ask",
    )
    return CopilotAskResponse(
        answer_markdown=reply.answer_markdown,
        suggested_actions=[
            CopilotAction(
                action_type=action.kind,
                title=action.title,
                rationale=action.rationale,
                action_data=action.payload.model_dump(exclude_none=True),
                href=action.href,
            )
            for action in reply.suggested_actions[:3]
        ],
        escalate_to_human=reply.escalate_to_human,
        escalate_reason=reply.escalate_reason,
    )
