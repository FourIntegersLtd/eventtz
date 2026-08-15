"""Vendor Growth Co-pilot chat assistant."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.contracts.vendor_copilot import (
    CopilotAction,
    CopilotActionKind,
    CopilotAskMessage,
    CopilotAskResponse,
)
from app.core.constants import OPENAI_COPILOT_MODEL
from app.core.logging import get_logger
from app.features.ai.openai_helpers import parse_completion, require_openai_client
from app.features.bookings.queries import get_booking_request_for_vendor
from app.features.help import queries
from app.features.help.help_article_keyword_search import format_articles_for_prompt, retrieve_articles
from app.features.vendor_copilot.context import build_vendor_context, format_vendor_copilot_prompt_context
from app.features.vendor_copilot.demand import get_market_demand_insights

logger = get_logger(__name__)

_SYSTEM = """You are Abba, the Eventtz vendor growth guide.
Help vendors get more clients and convert enquiries into bookings.

Ground every answer in vendor_data and help articles. Use plain English.
Avoid jargon (no escrow, Stripe Connect, API, KPI, GMV).

You can advise on: listing quality, packages, pricing psychology, response speed,
analytics interpretation, availability, and marketplace best practices.

answer_markdown MUST be well-structured Markdown (not a wall of text):
- Open with one bold summary line (**Quick snapshot:** …).
- Use ## section headings when you cover more than one topic (e.g. ## What's working, ## Focus next).
- Prefer bullet lists (- item) for tips, strengths, and next steps.
- Use numbered lists (1. item) only for ordered steps.
- Keep any paragraph to 1–2 short sentences; break long advice into bullets.
- Bold key numbers from vendor_data (**9 profile views**, **48/100**).
- Never output one long paragraph block.

If the user asks about refunds, disputes, account suspension, or payout problems,
set escalate_to_human=true and tell them to use Contact or Disputes in the portal.
escalate_reason: payments, dispute, account, unknown, or null.

suggested_actions: up to 3 actionable cards with kind one of:
edit_profile, open_booking, open_payments, open_analytics, open_messages, apply_package_patch.
Include href paths like /vendor/profile, /vendor/bookings/{id}, /vendor/payments, /vendor/analytics.
For open_booking, set payload.booking_request_id when a specific booking is referenced.
Never invent booking ids or metrics not in vendor_data.
"""


class _CopilotActionPayloadLlm(BaseModel):
    """Strict payload shape for OpenAI structured output (no free-form dict)."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    booking_request_id: str | None = Field(default=None, validation_alias="booking_id")
    package_id: str | None = None


class _CopilotActionLlm(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: CopilotActionKind
    title: str
    rationale: str
    payload: _CopilotActionPayloadLlm = Field(default_factory=_CopilotActionPayloadLlm)
    href: str | None = None


class CopilotAssistantReply(BaseModel):
    model_config = ConfigDict(extra="forbid")

    answer_markdown: str = Field(
        description=(
            "Markdown reply: bold opening line, ## headings, - bullet lists. "
            "No walls of text."
        ),
    )
    suggested_actions: list[_CopilotActionLlm] = Field(default_factory=list, max_length=3)
    escalate_to_human: bool = False
    escalate_reason: str | None = None


def _to_copilot_action(action: _CopilotActionLlm) -> CopilotAction:
    payload = action.payload.model_dump(exclude_none=True, by_alias=False)
    return CopilotAction(
        action_type=action.kind,
        title=action.title,
        rationale=action.rationale,
        action_data=payload,
        href=action.href,
    )


def ask_copilot(
    *,
    vendor_user_id: str,
    question: str,
    history: list[CopilotAskMessage] | None = None,
    booking_request_id: str | None = None,
) -> CopilotAskResponse:
    ctx = build_vendor_context(vendor_user_id)
    facts = format_vendor_copilot_prompt_context(ctx)

    booking_context = ""
    if booking_request_id:
        row = get_booking_request_for_vendor(vendor_user_id, booking_request_id)
        if row:
            booking_context = (
                f"\n\nActive booking context:\n"
                f"- id: {row.get('id')}\n"
                f"- event: {row.get('event_name')}\n"
                f"- date: {row.get('event_date')}\n"
                f"- status: {row.get('status')}\n"
                f"- notes: {(row.get('notes') or '')[:500]}"
            )

    demand = get_market_demand_insights(
        base_city=str(ctx.get("base_city") or ""),
        services=list(ctx.get("services") or []),
        country_code=str(ctx.get("country_code") or "GB"),
    )
    demand_text = "\n".join(f"- {d['headline']}: {d['detail']}" for d in demand) or "No demand data."

    pool = queries.list_all_published_for_audience(audience="vendor")
    retrieved = retrieve_articles(question=question, articles=pool, limit=6)
    corpus = format_articles_for_prompt(retrieved)

    prior = list(history or [])[-8:]
    messages: list[dict[str, str]] = [
        {"role": "system", "content": _SYSTEM},
        {
            "role": "system",
            "content": (
                f"vendor_data:\n{facts}{booking_context}\n\n"
                f"Market demand signals:\n{demand_text}\n\n"
                f"Help articles:\n{corpus}"
            ),
        },
    ]
    for msg in prior:
        role = msg.message_role if msg.message_role in ("user", "assistant") else "user"
        content = (msg.content or "").strip()
        if content:
            messages.append({"role": role, "content": content[:1500]})
    messages.append({"role": "user", "content": question.strip()[:2000]})

    client = require_openai_client(log_context="vendor_copilot_ask")
    parsed = parse_completion(
        client=client,
        model=OPENAI_COPILOT_MODEL,
        messages=messages,
        response_format=CopilotAssistantReply,
        log_context="vendor_copilot_ask",
    )
    return CopilotAskResponse(
        answer_markdown=parsed.answer_markdown,
        suggested_actions=[_to_copilot_action(a) for a in parsed.suggested_actions[:3]],
        escalate_to_human=parsed.escalate_to_human,
        escalate_reason=parsed.escalate_reason,
    )
