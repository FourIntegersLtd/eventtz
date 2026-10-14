"""`LanguageModel` backed by OpenAI structured outputs (`chat.completions.parse`)."""

from __future__ import annotations

from collections.abc import Callable
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

# Model families that take `reasoning_effort`. Without it they think before answering at the
# provider's default effort; older chat models (gpt-4o, gpt-4.1) reject the parameter.
REASONING_MODEL_PREFIXES = ("gpt-5", "gpt-6", "o1", "o3", "o4")


def _openai_client(api_key: str) -> OpenAI:
    """The real SDK client for `api_key`."""
    return OpenAI(api_key=api_key)


def reasoning_effort_for(model: str, effort: str) -> str | None:
    """The `reasoning_effort` to send for `model`, or `None` when it is not a reasoning model."""
    return effort if model.startswith(REASONING_MODEL_PREFIXES) else None


def _with_image(message: ChatMessage, image_data_url: str) -> dict[str, Any]:
    """`message`, but with its text alongside an image content-part (OpenAI vision input shape)."""
    return {
        "role": message["role"],
        "content": [
            {"type": "text", "text": message["content"]},
            {"type": "image_url", "image_url": {"url": image_data_url}},
        ],
    }


class OpenAILanguageModel:
    """Calls OpenAI with the key from settings; with no key every call raises `LanguageModelUnavailable`.

    `OPENAI_CHAT_MODEL`, when set, replaces the model each feature asks for, so the model can be
    switched without a deploy. `client_factory` builds the SDK client from the key; tests pass a
    recorder in its place.
    """

    def __init__(self, client_factory: Callable[[str], OpenAI] = _openai_client) -> None:
        """Keep the factory that turns an API key into an OpenAI client."""
        self._client_factory = client_factory

    def parse(
        self,
        *,
        model: str,
        messages: list[ChatMessage],
        reply_model: type[ReplyModel],
        purpose: str,
        image_data_url: str | None = None,
    ) -> ReplyModel:
        """Send `messages` and parse the reply into `reply_model` (see `LanguageModel.parse`)."""
        settings = get_settings()
        api_key = settings.openai_api_key.strip()
        if not api_key:
            log.warning("%s: OPENAI_API_KEY is not set; AI features are off", purpose)
            raise LanguageModelUnavailable()
        prompt: Any = messages  # the SDK's message union type is stricter than our TypedDict
        if image_data_url is not None:
            # Attach the image to the last message as vision input (chat.completions
            # accepts a content-parts list in place of a plain string).
            prompt = [*messages[:-1], _with_image(messages[-1], image_data_url)] if messages else messages
        model = settings.openai_chat_model.strip() or model
        options: dict[str, Any] = {}
        effort = reasoning_effort_for(model, settings.openai_reasoning_effort)
        if effort is not None:
            options["reasoning_effort"] = effort
        try:
            completion = self._client_factory(api_key).chat.completions.parse(
                model=model, messages=prompt, response_format=reply_model, **options
            )
        except Exception as exc:
            log.exception("%s: chat.completions.parse failed (model=%s)", purpose, model)
            raise LanguageModelFailed() from exc
        reply = completion.choices[0].message
        if reply.refusal:
            log.warning("%s: model refused: %s", purpose, reply.refusal)
            raise LanguageModelRefused()
        if reply.parsed is None:
            log.warning("%s: empty parsed response", purpose)
            raise LanguageModelEmptyReply()
        return reply.parsed
