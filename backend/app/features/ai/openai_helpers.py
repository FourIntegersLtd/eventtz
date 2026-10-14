"""Shared helpers for calling OpenAI and pulling JSON from replies."""

from __future__ import annotations

import json
import re
from typing import Any, TypeVar

from fastapi import HTTPException
from openai import OpenAI
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.logging import get_logger
from app.features.ai import messages as ai_messages

logger = get_logger(__name__)

TModel = TypeVar("TModel", bound=BaseModel)

# Model families that take a reasoning effort. Without one they think before answering at the
# provider's default effort; older chat models (gpt-4o, gpt-4.1) reject the parameter.
REASONING_MODEL_PREFIXES = ("gpt-5", "gpt-6", "o1", "o3", "o4")


def resolve_model(default: str) -> str:
    """``OPENAI_CHAT_MODEL`` when set (switch the model without a deploy), else ``default``."""
    return (get_settings().openai_chat_model or "").strip() or default


def _reasoning_effort(model: str) -> str | None:
    if not model.startswith(REASONING_MODEL_PREFIXES):
        return None
    return get_settings().openai_reasoning_effort


def reasoning_kwargs_chat(model: str) -> dict[str, Any]:
    """Extra kwargs for ``chat.completions`` calls: ``reasoning_effort`` for reasoning models only."""
    effort = _reasoning_effort(model)
    return {} if effort is None else {"reasoning_effort": effort}


def reasoning_kwargs_responses(model: str) -> dict[str, Any]:
    """Extra kwargs for ``responses.create``, which spells it ``reasoning={"effort": ...}``."""
    effort = _reasoning_effort(model)
    return {} if effort is None else {"reasoning": {"effort": effort}}


def is_openai_configured() -> bool:
    return bool((get_settings().openai_api_key or "").strip())


def try_openai_client() -> OpenAI | None:
    key = (get_settings().openai_api_key or "").strip()
    if not key:
        return None
    return OpenAI(api_key=key)


def require_openai_client(*, log_context: str = "openai") -> OpenAI:
    client = try_openai_client()
    if client is not None:
        logger.debug("%s: OpenAI client initialised (key present, not logged)", log_context)
        return client
    logger.warning(
        "%s: cannot create OpenAI client - OPENAI_API_KEY is missing or blank. "
        "Check backend .env and restart uvicorn.",
        log_context,
    )
    raise HTTPException(
        status_code=503,
        detail=ai_messages.OPENAI_UNAVAILABLE,
    )


def extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("no json object")
    return json.loads(m.group())


def parse_completion(
    *,
    client: OpenAI,
    model: str,
    messages: list[dict[str, str]],
    response_format: type[TModel],
    log_context: str = "openai_parse",
) -> TModel:
    """
    Structured output via OpenAI chat.completions.parse (Pydantic schema).
    Prefer this over extract_json_object for new features.
    """
    model = resolve_model(model)
    extra = reasoning_kwargs_chat(model)
    try:
        try:
            completion = client.chat.completions.parse(
                model=model,
                messages=messages,
                response_format=response_format,
                **extra,
            )
        except AttributeError:
            completion = client.beta.chat.completions.parse(
                model=model,
                messages=messages,
                response_format=response_format,
                **extra,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("%s: chat.completions.parse failed", log_context)
        raise HTTPException(
            status_code=503,
            detail=ai_messages.AI_PARSE_UNAVAILABLE,
        ) from e

    message = completion.choices[0].message
    if getattr(message, "refusal", None):
        logger.warning("%s: model refused: %s", log_context, message.refusal)
        raise HTTPException(
            status_code=400,
            detail=ai_messages.AI_REFUSAL,
        )
    parsed = message.parsed
    if parsed is None:
        logger.warning("%s: empty parsed response", log_context)
        raise HTTPException(
            status_code=503,
            detail=ai_messages.AI_EMPTY_RESPONSE,
        )
    return parsed
