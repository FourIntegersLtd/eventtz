"""Keyword retrieval over help articles for the assistant prompt."""

from __future__ import annotations

import re
from typing import Any


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-z0-9]+", (text or "").lower()) if len(t) >= 2}


def retrieve_articles(
    *,
    question: str,
    articles: list[dict[str, Any]],
    limit: int = 6,
) -> list[dict[str, Any]]:
    q_tokens = _tokens(question)
    if not articles:
        return []
    if not q_tokens:
        return articles[:limit]

    scored: list[tuple[float, dict[str, Any]]] = []
    for art in articles:
        blob = " ".join(
            [
                str(art.get("title") or ""),
                str(art.get("summary") or ""),
                str(art.get("body_md") or "")[:2000],
                " ".join(art.get("related_slugs") or []),
            ],
        )
        a_tokens = _tokens(blob)
        if not a_tokens:
            continue
        overlap = q_tokens & a_tokens
        # Title hits weigh more
        title_tokens = _tokens(str(art.get("title") or ""))
        title_hits = len(q_tokens & title_tokens)
        score = len(overlap) + title_hits * 2.0
        if score > 0:
            scored.append((score, art))

    scored.sort(key=lambda x: x[0], reverse=True)
    if not scored:
        # Fall back to a few general articles so the model still has grounding.
        return articles[: min(limit, 4)]
    return [a for _, a in scored[:limit]]


def format_articles_for_prompt(articles: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for art in articles:
        body = str(art.get("body_md") or "")
        if len(body) > 1800:
            body = body[:1800] + "…"
        parts.append(
            f"### slug: {art.get('slug')}\n"
            f"title: {art.get('title')}\n"
            f"summary: {art.get('summary')}\n"
            f"{body}\n",
        )
    return "\n".join(parts) if parts else "(no articles)"
