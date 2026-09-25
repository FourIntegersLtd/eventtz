"""Pure Help Center rules: who sees which articles, keyword retrieval, and the assistant's prompt.

The prompt text and retrieval maths are pinned to the baseline by
`tests/golden/content/help_assistant.json`; change them only by re-capturing.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from typing import Literal

from pydantic import BaseModel, Field

from app.core.ports import ChatMessage
from app.features.content.errors import AudienceMismatch
from app.features.content.models import HelpArticleText

Audience = Literal["client", "vendor", "admin"]
_AUDIENCES: tuple[Audience, ...] = ("client", "vendor", "admin")

# The model used for help answers.
HELP_MODEL = "gpt-4o-mini"
# How many articles go into the prompt, and how many to fall back to when nothing matches.
RETRIEVAL_LIMIT = 6
FALLBACK_ARTICLE_COUNT = 4
# Only this much of an article body is searched, and this much is sent to the model.
SEARCHED_BODY_LENGTH = 2000
PROMPT_BODY_LENGTH = 1800
# Only the latest turns of a conversation are sent, each cut to a maximum length.
HISTORY_TURNS_SENT = 8
HISTORY_TURN_LENGTH = 1500
QUESTION_LENGTH = 2000
# The assistant may link at most this many articles.
RELATED_ARTICLE_LIMIT = 6
ESCALATE_REASONS = ("payments", "dispute", "account", "unknown")
EMPTY_ANSWER = "Sorry, I could not form an answer."

PORTAL_SYSTEM_PROMPT = """You are the Eventtz Help assistant for a UK African-events marketplace.
Answer ONLY using the provided help articles. Use plain English and everyday words.
Avoid jargon (no escrow, Stripe Connect, API, KPI, GMV, checkout session, and similar terms).
Be concise, friendly, and practical. Use markdown (short paragraphs, bullets).
Do not invent refund, payment, or dispute policies.
If the user asks about money movement, refunds, disputes, account suspension, or something
not covered by the articles, set escalate_to_human=true and explain they should use Contact
or Disputes in the portal. related_article_slugs must be slugs from the provided articles only.
escalate_reason should be one of: payments, dispute, account, unknown, or null when not escalating.
"""

ADMIN_SYSTEM_PROMPT = """You are the Eventtz admin console Help assistant.
Answer ONLY using the provided admin help articles. Use plain English.
Call out Support admin vs Super admin gates clearly in everyday words.
Avoid jargon. Do not invent permissions or money workflows. If something is not covered,
set escalate_to_human=true and tell them to ask a super admin or check the Activity log.
related_article_slugs must be slugs from the provided articles only.
escalate_reason: payments, dispute, account, unknown, or null.
"""


class AssistantReply(BaseModel):
    """The structured answer the model must return."""

    answer_markdown: str
    related_article_slugs: list[str] = Field(default_factory=list)
    escalate_to_human: bool = False
    escalate_reason: str | None = None


class ConversationTurn(BaseModel):
    """One earlier turn of the help chat, as the web app sends it."""

    role: str
    content: str


def resolve_audience(user_type: str, requested: str | None) -> Audience:
    """Which portal's articles the caller reads.

    Staff default to admin articles and may preview client or vendor ones (an
    unknown value falls back to admin). Clients and vendors only get their own,
    and asking for another portal's is refused with `AudienceMismatch`.
    """
    if user_type == "admin":
        return requested if requested in _AUDIENCES else "admin"  # type: ignore[return-value]
    if requested and requested != user_type:
        raise AudienceMismatch()
    return user_type  # type: ignore[return-value]


def audience_values(audience: Audience) -> list[str]:
    """The `audience` column values an audience may read. Admin docs never mix in `both`."""
    return ["admin"] if audience == "admin" else [audience, "both"]


def _tokens(text: str) -> set[str]:
    """Lower-case words and numbers of two or more characters."""
    return {token for token in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(token) >= 2}


def retrieve_articles(
    question: str, articles: Sequence[HelpArticleText], limit: int = RETRIEVAL_LIMIT
) -> list[HelpArticleText]:
    """The articles most relevant to `question`, best first, by shared words (title words count 3×).

    No usable words in the question → the first `limit` articles. Words but no
    match → the first few articles, so the model still has something to ground on.
    """
    question_tokens = _tokens(question)
    if not articles:
        return []
    if not question_tokens:
        return list(articles[:limit])
    scored: list[tuple[float, HelpArticleText]] = []
    for article in articles:
        searchable = " ".join(
            [
                article.title,
                article.summary,
                article.body_md[:SEARCHED_BODY_LENGTH],
                " ".join(article.related_slugs),
            ]
        )
        article_tokens = _tokens(searchable)
        if not article_tokens:
            continue
        title_hits = len(question_tokens & _tokens(article.title))
        score = len(question_tokens & article_tokens) + title_hits * 2.0
        if score > 0:
            scored.append((score, article))
    # A stable sort, so equally scored articles keep their original order.
    scored.sort(key=lambda scored_article: scored_article[0], reverse=True)
    if not scored:
        return list(articles[: min(limit, FALLBACK_ARTICLE_COUNT)])
    return [article for _, article in scored[:limit]]


def format_articles_for_prompt(articles: Sequence[HelpArticleText]) -> str:
    """The articles as the plain-text corpus block of the prompt."""
    sections: list[str] = []
    for article in articles:
        body = article.body_md
        if len(body) > PROMPT_BODY_LENGTH:
            body = body[:PROMPT_BODY_LENGTH] + "…"
        sections.append(
            f"### slug: {article.slug}\ntitle: {article.title}\nsummary: {article.summary}\n{body}\n"
        )
    return "\n".join(sections) if sections else "(no articles)"


def assistant_messages(
    *,
    question: str,
    audience: Audience,
    history: Sequence[ConversationTurn],
    articles: Sequence[HelpArticleText],
) -> list[ChatMessage]:
    """The full prompt: instructions, the retrieved articles, recent history, then the question."""
    system_prompt = ADMIN_SYSTEM_PROMPT if audience == "admin" else PORTAL_SYSTEM_PROMPT
    corpus = format_articles_for_prompt(articles)
    messages: list[ChatMessage] = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": f"Audience portal: {audience}\n\nHelp articles:\n{corpus}"},
    ]
    for turn in list(history)[-HISTORY_TURNS_SENT:]:
        content = (turn.content or "").strip()
        if content:
            role: Literal["user", "assistant"] = "assistant" if turn.role == "assistant" else "user"
            messages.append({"role": role, "content": content[:HISTORY_TURN_LENGTH]})
    messages.append({"role": "user", "content": question.strip()[:QUESTION_LENGTH]})
    return messages


def finish_reply(reply: AssistantReply, allowed_slugs: set[str]) -> AssistantReply:
    """Clean the model's reply: keep only real article slugs, normalise the escalation reason."""
    related = [slug for slug in reply.related_article_slugs if slug in allowed_slugs][:RELATED_ARTICLE_LIMIT]
    reason = reply.escalate_reason
    if reason and reason not in ESCALATE_REASONS:
        reason = "unknown"
    return AssistantReply(
        answer_markdown=reply.answer_markdown.strip() or EMPTY_ANSWER,
        related_article_slugs=related,
        escalate_to_human=bool(reply.escalate_to_human),
        escalate_reason=reason if reply.escalate_to_human else None,
    )
