"""Chat-history turns are documented under the key the web app sends, and still accept the baseline's."""

from __future__ import annotations

import pytest

from app.features.content.schemas import HelpAskMessage
from app.features.copilot.schemas import CopilotAskMessage
from app.openapi import build_document

MESSAGE_MODELS = [HelpAskMessage, CopilotAskMessage]


@pytest.mark.parametrize("model", MESSAGE_MODELS)
def test_history_turn_accepts_message_role_and_the_baseline_role(model: type) -> None:
    assert model.model_validate({"message_role": "user", "content": "hi"}).message_role == "user"
    assert model.model_validate({"role": "assistant", "content": "hi"}).message_role == "assistant"


@pytest.mark.parametrize("model", MESSAGE_MODELS)
def test_openapi_documents_message_role(model: type) -> None:
    schema = build_document()["components"]["schemas"][model.__name__]
    assert sorted(schema["properties"]) == ["content", "message_role"]
    assert sorted(schema["required"]) == ["content", "message_role"]
