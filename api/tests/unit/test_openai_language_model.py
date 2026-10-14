"""The OpenAI adapter sends each feature's model at reasoning effort "none", and nothing it would reject.

A recorder stands in for the SDK client (injected through `client_factory`), so these
tests see the exact keyword arguments `chat.completions.parse` would receive.
"""

from __future__ import annotations

from collections.abc import Iterator
from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import BaseModel

from app.adapters.openai_language_model import OpenAILanguageModel, reasoning_effort_for
from app.core.settings import get_settings
from app.features.content.domain_contact import CLASSIFIER_MODEL
from app.features.content.domain_help import HELP_MODEL
from app.features.copilot.service_brief import COPILOT_MODEL
from app.features.marketplace.domain_query import SEARCH_MODEL
from app.features.planner.service_plans import PLANNER_MODEL
from app.features.vendors.service_ai import ONBOARDING_AI_MODEL

FEATURE_MODELS = {
    "help": HELP_MODEL,
    "contact": CLASSIFIER_MODEL,
    "copilot": COPILOT_MODEL,
    "search": SEARCH_MODEL,
    "planner": PLANNER_MODEL,
    "onboarding": ONBOARDING_AI_MODEL,
}


class _Reply(BaseModel):
    """A minimal structured reply."""

    answer: str


class _RecordingClient:
    """Looks like `OpenAI(...)` far enough for `chat.completions.parse`; keeps every call's kwargs."""

    def __init__(self) -> None:
        """Start with no calls, exposing `chat.completions.parse` like the SDK."""
        self.calls: list[dict[str, Any]] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(parse=self._parse))

    def _parse(self, **kwargs: Any) -> Any:
        """Record the kwargs and answer with a parsed `_Reply`."""
        self.calls.append(kwargs)
        message = SimpleNamespace(refusal=None, parsed=_Reply(answer="ok"))
        return SimpleNamespace(choices=[SimpleNamespace(message=message)])


@pytest.fixture
def openai_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[pytest.MonkeyPatch]:
    """A key is set and no model override, with settings reloaded before and after."""
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.delenv("OPENAI_CHAT_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_REASONING_EFFORT", raising=False)
    get_settings.cache_clear()
    yield monkeypatch
    get_settings.cache_clear()


def _send(model: str) -> dict[str, Any]:
    """Call the adapter once with `model` and return the kwargs the SDK received."""
    client = _RecordingClient()
    reply = OpenAILanguageModel(client_factory=lambda _api_key: client).parse(
        model=model, messages=[{"role": "user", "content": "hi"}], reply_model=_Reply, purpose="test"
    )
    assert reply == _Reply(answer="ok")
    assert len(client.calls) == 1
    return client.calls[0]


@pytest.mark.parametrize("feature", sorted(FEATURE_MODELS))
def test_each_feature_model_is_sent_at_effort_none(openai_env: pytest.MonkeyPatch, feature: str) -> None:
    """Every feature's model goes out as-is, with reasoning_effort "none" and no temperature/max_tokens."""
    sent = _send(FEATURE_MODELS[feature])
    assert sent["model"] == FEATURE_MODELS[feature]
    assert sent["reasoning_effort"] == "none"
    assert sent["response_format"] is _Reply
    assert "temperature" not in sent
    assert "max_tokens" not in sent


def test_gpt6_models_get_reasoning_effort() -> None:
    """The gate covers gpt-6 (the bug last time was a gpt-5-only prefix check)."""
    assert reasoning_effort_for(HELP_MODEL, "none") == "none"
    assert reasoning_effort_for("gpt-6-luna", "none") == "none"
    assert reasoning_effort_for("gpt-5-mini", "low") == "low"


def test_non_reasoning_models_get_no_reasoning_effort(openai_env: pytest.MonkeyPatch) -> None:
    """A chat model outside the reasoning families would reject the parameter, so it is left out."""
    assert reasoning_effort_for("legacy-chat-model", "none") is None
    assert "reasoning_effort" not in _send("legacy-chat-model")


def test_env_override_switches_the_model(openai_env: pytest.MonkeyPatch) -> None:
    """OPENAI_CHAT_MODEL replaces the feature's model, and the gate follows the replacement."""
    openai_env.setenv("OPENAI_CHAT_MODEL", "gpt-5-mini")
    openai_env.setenv("OPENAI_REASONING_EFFORT", "minimal")
    get_settings.cache_clear()
    sent = _send(HELP_MODEL)
    assert sent["model"] == "gpt-5-mini"
    assert sent["reasoning_effort"] == "minimal"
