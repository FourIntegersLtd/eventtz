"""The content slice reproduces the baseline byte for byte on captured inputs.

Goldens were captured from the baseline `backend/` by `acceptance/capture/content_goldens.py`
and `content_prompt_goldens.py`. A failure here means behaviour drifted from the baseline:
fix the code, or re-capture if the baseline itself changed on purpose.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.core.ports import LanguageModelFailed
from app.features.content.domain_blog import sanitize_blog_html, slugify
from app.features.content.domain_help import (
    HELP_MODEL,
    AssistantReply,
    ConversationTurn,
    assistant_messages,
    finish_reply,
    retrieve_articles,
)
from app.features.content.models import HelpArticleText
from app.features.content.service_contact import classify
from tests.support.fakes import FakeLanguageModel

GOLDEN_ROOT = Path(__file__).parent / "content"


def load_golden(name: str) -> list[dict[str, Any]]:
    """The recorded cases in `tests/golden/content/<name>.json`."""
    cases: list[dict[str, Any]] = json.loads((GOLDEN_ROOT / f"{name}.json").read_text(encoding="utf-8"))
    return cases


@pytest.mark.parametrize("case", load_golden("sanitize_blog_html"), ids=lambda case: repr(case["input"])[:60])
def test_sanitiser_matches_baseline(case: dict[str, Any]) -> None:
    assert sanitize_blog_html(case["input"]) == case["output"]


@pytest.mark.parametrize("case", load_golden("slugify"), ids=lambda case: repr(case["input"])[:60])
def test_slugify_matches_baseline(case: dict[str, Any]) -> None:
    assert slugify(case["input"]) == case["output"]


@pytest.mark.parametrize("case", load_golden("help_assistant"), ids=lambda case: case["name"])
def test_help_assistant_prompt_and_reply_match_baseline(case: dict[str, Any]) -> None:
    pool = [HelpArticleText.model_validate(article) for article in case["pool"]]
    history = [ConversationTurn.model_validate(turn) for turn in case["history"]]
    messages = assistant_messages(
        question=case["question"],
        audience=case["audience"],
        history=history,
        articles=retrieve_articles(case["question"], pool),
    )
    assert case["model"] == HELP_MODEL
    assert messages == case["messages"]
    finished = finish_reply(AssistantReply.model_validate(case["reply"]), {article.slug for article in pool})
    assert finished.model_dump() == case["response"]


@pytest.mark.parametrize("case", load_golden("contact_classifier"), ids=lambda case: case["portal"])
def test_contact_classifier_prompt_and_subject_match_baseline(case: dict[str, Any]) -> None:
    # `reply` is the subject key the model was made to return; none means the call failed.
    language_model = (
        FakeLanguageModel(reply={"subject": case["reply"], "rationale": ""})
        if case["reply"] is not None
        else FakeLanguageModel(error=LanguageModelFailed())
    )
    subject = classify(language_model, portal=case["portal"], message=case["message"])
    assert subject == case["subject"]
    (call,) = language_model.calls
    assert call.model == case["model"]
    assert call.messages == case["messages"]
