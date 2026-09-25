"""Capture the exact language-model prompts the baseline builds for the help assistant and contact classifier.

Run with `make capture SCRIPT=capture/content_prompt_goldens.py`. No model is
called: the baseline's OpenAI helpers and its article query are swapped for
recorders that return canned replies, so the golden holds what the baseline
*would send* and what it *returns* for each canned reply. Output:

- `content/help_assistant.json`: per case, the article pool, question, history,
  canned reply, the messages sent, the model name, and the response returned.
- `content/contact_classifier.json`: per case, the portal, message, canned reply
  (or `null` when the call fails), the messages sent, and the subject returned.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import app.features.contact.classification as classification  # type: ignore[import-not-found]
import app.features.help.assistant as assistant  # type: ignore[import-not-found]
from app.contracts.help import HelpAskMessage  # type: ignore[import-not-found]

# A help pool with overlapping words so the keyword ranking has ties, misses and title hits.
ARTICLE_POOL: list[dict[str, Any]] = [
    {
        "slug": "refunds-explained",
        "title": "How refunds work",
        "summary": "When money comes back to you.",
        "body_md": "Refunds go back to the card you paid with. " * 3,
        "audience": "client",
        "related_slugs": ["cancel-a-booking"],
    },
    {
        "slug": "cancel-a-booking",
        "title": "Cancel a booking",
        "summary": "Cancelling before and after payment.",
        "body_md": "You can cancel from the booking page. Refunds depend on timing.",
        "audience": "client",
        "related_slugs": [],
    },
    {
        "slug": "service-fees",
        "title": "Service fees",
        "summary": "What the Eventtz fee pays for.",
        "body_md": "Our fee covers secure payments and support.",
        "audience": "both",
        "related_slugs": ["refunds-explained"],
    },
    {
        "slug": "long-article",
        "title": "A very long article",
        "summary": "Tests the prompt body cut-off.",
        "body_md": "word " * 500,
        "audience": "client",
        "related_slugs": [],
    },
    {
        "slug": "account-settings",
        "title": "Account settings",
        "summary": "Change your password and name.",
        "body_md": "Open Settings from the menu.",
        "audience": "client",
        "related_slugs": [],
    },
    {
        "slug": "chat-with-vendors",
        "title": "Chat with vendors",
        "summary": "Messaging before you book.",
        "body_md": "Send a message from the vendor profile.",
        "audience": "client",
        "related_slugs": [],
    },
    {
        "slug": "empty-article",
        "title": "",
        "summary": "",
        "body_md": "",
        "audience": "client",
        "related_slugs": [],
    },
]

# Conversation turns, including ones the assistant must drop, relabel or cut.
LONG_HISTORY: list[dict[str, str]] = [
    {"role": "user", "content": "first question, will be dropped (older than 8 turns)"},
    {"role": "assistant", "content": "first answer, also dropped"},
    {"role": "user", "content": "  padded question  "},
    {"role": "assistant", "content": "an answer"},
    {"role": "system", "content": "a system turn is sent as a user turn"},
    {"role": "user", "content": "   "},
    {"role": "assistant", "content": "x" * 1600},
    {"role": "user", "content": "follow up"},
    {"role": "assistant", "content": "another answer"},
    {"role": "user", "content": "last history turn"},
]

HELP_CASES: list[dict[str, Any]] = [
    {
        "name": "client_refund_question_escalates_with_unknown_reason",
        "audience": "client",
        "question": "  How do refunds work after I cancel?  ",
        "history": LONG_HISTORY,
        "pool": ARTICLE_POOL,
        "reply": {
            "answer_markdown": "  Refunds go back to your card.  ",
            "related_article_slugs": ["refunds-explained", "not-in-pool", "cancel-a-booking"],
            "escalate_to_human": True,
            "escalate_reason": "billing",
        },
    },
    {
        "name": "admin_question_without_tokens_uses_first_articles",
        "audience": "admin",
        "question": "? !",
        "history": [],
        "pool": ARTICLE_POOL,
        "reply": {
            "answer_markdown": "   ",
            "related_article_slugs": [],
            "escalate_to_human": False,
            "escalate_reason": "payments",
        },
    },
    {
        "name": "no_keyword_match_falls_back_to_four_articles",
        "audience": "vendor",
        "question": "zebra quantum",
        "history": [{"role": "assistant", "content": "hello"}],
        "pool": ARTICLE_POOL,
        "reply": {
            "answer_markdown": "I am not sure.",
            "related_article_slugs": ["service-fees"] * 8,
            "escalate_to_human": True,
            "escalate_reason": None,
        },
    },
    {
        "name": "long_article_is_cut_and_title_hits_rank_first",
        "audience": "client",
        "question": "very long article word fees",
        "history": [],
        "pool": ARTICLE_POOL,
        "reply": {
            "answer_markdown": "Here you go.",
            "related_article_slugs": ["long-article", "service-fees", "account-settings"],
            "escalate_to_human": True,
            "escalate_reason": "dispute",
        },
    },
    {
        "name": "empty_pool_sends_no_articles",
        "audience": "client",
        "question": "anything",
        "history": [],
        "pool": [],
        "reply": {
            "answer_markdown": "Nothing to go on.",
            "related_article_slugs": ["refunds-explained"],
            "escalate_to_human": False,
            "escalate_reason": None,
        },
    },
]

CLASSIFIER_CASES: list[dict[str, Any]] = [
    {"portal": "client", "message": "  My payout never arrived.  ", "reply": "payments"},
    {"portal": "vendor", "message": "The calendar page crashes.", "reply": "feedback_bug"},
    {"portal": "client", "message": "y" * 4100, "reply": "general"},
    {"portal": "vendor", "message": "The call fails.", "reply": None},
]


def capture_help_case(case: dict[str, Any]) -> dict[str, Any]:
    """Run the baseline assistant for one case and record its prompt and response."""
    recorded: dict[str, Any] = {}

    def canned_pool(*, audience: str) -> list[dict[str, Any]]:
        """Stand-in for the database read: a fresh copy of the case's pool."""
        recorded["pool_audience"] = audience
        return json.loads(json.dumps(case["pool"]))

    def record_parse(**call: Any) -> Any:
        """Stand-in for OpenAI: remember the call and return the canned reply."""
        recorded["model"] = call["model"]
        recorded["messages"] = call["messages"]
        return call["response_format"].model_validate(case["reply"])

    assistant.queries.list_all_published_for_audience = canned_pool
    assistant.require_openai_client = lambda **_: object()
    assistant.parse_completion = record_parse
    history = [HelpAskMessage.model_validate(turn) for turn in case["history"]]
    response = assistant.ask_help_assistant(
        question=case["question"], audience=case["audience"], history=history
    )
    return {**case, **recorded, "response": response.model_dump()}


def capture_classifier_case(case: dict[str, Any]) -> dict[str, Any]:
    """Run the baseline classifier for one case and record its prompt and subject."""
    recorded: dict[str, Any] = {}

    def record_parse(**call: Any) -> Any:
        """Stand-in for OpenAI: remember the call, then reply or fail as the case says."""
        recorded["model"] = call["model"]
        recorded["messages"] = call["messages"]
        if case["reply"] is None:
            raise RuntimeError("simulated model failure")
        return call["response_format"].model_validate({"subject": case["reply"], "rationale": "canned"})

    classification.try_openai_client = lambda: object()
    classification.parse_completion = record_parse
    subject = classification.classify_contact_message(portal=case["portal"], message=case["message"])
    return {**case, **recorded, "subject": subject}


def write(path: Path, captured: list[dict[str, Any]]) -> None:
    """Write one golden file as stable, readable JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(captured, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    golden_root = Path(sys.argv[1]) / "content"
    write(golden_root / "help_assistant.json", [capture_help_case(case) for case in HELP_CASES])
    write(
        golden_root / "contact_classifier.json",
        [capture_classifier_case(case) for case in CLASSIFIER_CASES],
    )
