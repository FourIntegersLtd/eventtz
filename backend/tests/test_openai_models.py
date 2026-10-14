"""OpenAI calls go out on the configured models at reasoning effort "none", without temperature or max_tokens."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from pydantic import BaseModel

from app.core import constants
from app.core.config import get_settings
from app.features.ai.openai_helpers import parse_completion, reasoning_kwargs_chat
from app.features.vendors import onboarding_ai

ALL_MODELS = [
    constants.OPENAI_BIO_MODEL,
    constants.OPENAI_VISION_MODEL,
    constants.OPENAI_SEARCH_MODEL,
    constants.OPENAI_HELP_MODEL,
    constants.OPENAI_PLANNER_MODEL,
    constants.OPENAI_COPILOT_MODEL,
    constants.OPENAI_CONTACT_MODEL,
]


class _Reply(BaseModel):
    answer: str


@pytest.fixture(autouse=True)
def _clean_openai_env(monkeypatch):
    monkeypatch.delenv("OPENAI_CHAT_MODEL", raising=False)
    monkeypatch.delenv("OPENAI_REASONING_EFFORT", raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _parse_kwargs(model: str) -> dict:
    client = MagicMock()
    client.chat.completions.parse.return_value.choices[0].message.refusal = None
    client.chat.completions.parse.return_value.choices[0].message.parsed = _Reply(answer="ok")
    parse_completion(client=client, model=model, messages=[{"role": "user", "content": "hi"}], response_format=_Reply)
    return client.chat.completions.parse.call_args.kwargs


@pytest.mark.parametrize("model", ALL_MODELS)
def test_parse_completion_sends_effort_none(model):
    sent = _parse_kwargs(model)
    assert sent["model"] == model
    assert sent["reasoning_effort"] == "none"
    assert "temperature" not in sent
    assert "max_tokens" not in sent


def test_gpt6_luna_gets_reasoning_effort_none():
    assert reasoning_kwargs_chat("gpt-6-luna") == {"reasoning_effort": "none"}
    assert reasoning_kwargs_chat("legacy-chat-model") == {}


def test_env_override_switches_model(monkeypatch):
    monkeypatch.setenv("OPENAI_CHAT_MODEL", "gpt-5-mini")
    get_settings.cache_clear()
    sent = _parse_kwargs(constants.OPENAI_HELP_MODEL)
    assert sent["model"] == "gpt-5-mini"
    assert sent["reasoning_effort"] == "none"


def _responses_client(output_text: str) -> MagicMock:
    client = MagicMock()
    client.responses.create.return_value.output_text = output_text
    return client


def test_bio_responses_call_has_reasoning_and_no_temperature():
    client = _responses_client("A warm bio.")
    with patch.object(onboarding_ai, "require_openai_client", return_value=client):
        onboarding_ai.generate_vendor_public_bio(payload={"business_name": "Test Catering"})
    sent = client.responses.create.call_args.kwargs
    assert sent["model"] == constants.OPENAI_BIO_MODEL
    assert sent["reasoning"] == {"effort": "none"}
    assert "temperature" not in sent
    assert "max_tokens" not in sent


def test_vision_responses_call_has_reasoning_and_no_temperature():
    client = _responses_client('{"ok": true, "score": 4, "summary": "Sharp."}')
    with patch.object(onboarding_ai, "require_openai_client", return_value=client):
        onboarding_ai.analyze_portfolio_image(image_bytes=b"\x89PNG", content_type="image/png")
    sent = client.responses.create.call_args.kwargs
    assert sent["model"] == constants.OPENAI_VISION_MODEL
    assert sent["reasoning"] == {"effort": "none"}
    assert "temperature" not in sent
