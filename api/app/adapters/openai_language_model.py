"""`LanguageModel` backed by OpenAI structured outputs (`chat.completions.parse`)."""

from __future__ import annotations

from typing import Any

from openai import OpenAI

from app.core.logging import get_logger
from app.core.ports import (
    ChatMessage,
    LanguageModelEmptyReply,
    LanguageModelFailed,
    LanguageModelRefused,
    LanguageModelUnavailable,
    ReplyModel,
)
from app.core.settings import get_settings

log = get_logger(__name__)


class OpenAILanguageModel:
    """Calls OpenAI with the key from settings; with no key every call raises `LanguageModelUnavailable`."""

    def parse(
        self, *, model: str, messages: list[ChatMessage], reply_model: type[ReplyModel], purpose: str
    ) -> ReplyModel:
        """Send `messages` and parse the reply into `reply_model` (see `LanguageModel.parse`)."""
        api_key = get_settings().openai_api_key.strip()
        if not api_key:
            log.warning("%s: OPENAI_API_KEY is not set; AI features are off", purpose)
            raise LanguageModelUnavailable()
        prompt: Any = messages  # the SDK's message union type is stricter than our TypedDict
        try:
            completion = OpenAI(api_key=api_key).chat.completions.parse(
                model=model, messages=prompt, response_format=reply_model
            )
        except Exception as exc:
            log.exception("%s: chat.completions.parse failed", purpose)
            raise LanguageModelFailed() from exc
        reply = completion.choices[0].message
        if reply.refusal:
            log.warning("%s: model refused: %s", purpose, reply.refusal)
            raise LanguageModelRefused()
        if reply.parsed is None:
            log.warning("%s: empty parsed response", purpose)
            raise LanguageModelEmptyReply()
        return reply.parsed
