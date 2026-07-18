"""Help assistant: grounded answers via OpenAI structured parse."""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.contracts.help import HelpAskMessage, HelpAskResponse
from app.core.constants import OPENAI_HELP_MODEL
from app.core.logging import get_logger
from app.features.ai.openai_helpers import parse_completion, require_openai_client
from app.features.help import queries
from app.features.help.retrieve import format_articles_for_prompt, retrieve_articles

logger = get_logger(__name__)

_SYSTEM_PORTAL = """You are the Eventtz Help assistant for a UK African-events marketplace.
Answer ONLY using the provided help articles. Use plain English and everyday words.
Avoid jargon (no escrow, Stripe Connect, API, KPI, GMV, checkout session, and similar terms).
Be concise, friendly, and practical. Use markdown (short paragraphs, bullets).
Do not invent refund, payment, or dispute policies.
If the user asks about money movement, refunds, disputes, account suspension, or something
not covered by the articles, set escalate_to_human=true and explain they should use Contact
or Disputes in the portal. related_article_slugs must be slugs from the provided articles only.
escalate_reason should be one of: payments, dispute, account, unknown, or null when not escalating.
"""

_SYSTEM_ADMIN = """You are the Eventtz admin console Help assistant.
Answer ONLY using the provided admin help articles. Use plain English.
Call out Support admin vs Super admin gates clearly in everyday words.
Avoid jargon. Do not invent permissions or money workflows. If something is not covered,
set escalate_to_human=true and tell them to ask a super admin or check the Activity log.
related_article_slugs must be slugs from the provided articles only.
escalate_reason: payments, dispute, account, unknown, or null.
"""


class HelpAssistantReply(BaseModel):
    answer_markdown: str
    related_article_slugs: list[str] = Field(default_factory=list)
    escalate_to_human: bool = False
    escalate_reason: str | None = None


def ask_help(
    *,
    question: str,
    audience: str,
    history: list[HelpAskMessage] | None = None,
) -> HelpAskResponse:
    pool = queries.list_all_published_for_audience(audience=audience)
    retrieved = retrieve_articles(question=question, articles=pool, limit=6)
    corpus = format_articles_for_prompt(retrieved)
    system = _SYSTEM_ADMIN if audience == "admin" else _SYSTEM_PORTAL
    prior = list(history or [])[-8:]

    logger.info(
        "help_assistant: ask audience=%s articles=%s retrieved=%s history=%s q_len=%s",
        audience,
        len(pool),
        len(retrieved),
        len(prior),
        len(question.strip()),
    )

    messages: list[dict[str, str]] = [
        {"role": "system", "content": system},
        {
            "role": "system",
            "content": f"Audience portal: {audience}\n\nHelp articles:\n{corpus}",
        },
    ]
    for msg in prior:
        role = msg.role if msg.role in ("user", "assistant") else "user"
        content = (msg.content or "").strip()
        if content:
            messages.append({"role": role, "content": content[:1500]})
    messages.append({"role": "user", "content": question.strip()[:2000]})

    client = require_openai_client(log_context="help_assistant")
    parsed = parse_completion(
        client=client,
        model=OPENAI_HELP_MODEL,
        messages=messages,
        response_format=HelpAssistantReply,
        log_context="help_assistant",
    )

    allowed = {str(a.get("slug") or "") for a in pool}
    related = [s for s in parsed.related_article_slugs if s in allowed][:6]
    reason = parsed.escalate_reason
    if reason and reason not in ("payments", "dispute", "account", "unknown"):
        reason = "unknown"

    logger.info(
        "help_assistant: reply escalate=%s related=%s answer_len=%s",
        bool(parsed.escalate_to_human),
        len(related),
        len((parsed.answer_markdown or "").strip()),
    )

    return HelpAskResponse(
        answer_markdown=parsed.answer_markdown.strip() or "Sorry, I could not form an answer.",
        related_article_slugs=related,
        escalate_to_human=bool(parsed.escalate_to_human),
        escalate_reason=reason if parsed.escalate_to_human else None,
    )
