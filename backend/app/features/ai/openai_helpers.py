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

logger = get_logger(__name__)

TModel = TypeVar("TModel", bound=BaseModel)


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
        "%s: cannot create OpenAI client — OPENAI_API_KEY is missing or blank. "
        "Check backend .env and restart uvicorn.",
        log_context,
    )
    raise HTTPException(
        status_code=503,
        detail="This AI feature isn't available right now. Please try again later.",
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
    try:
        try:
            completion = client.chat.completions.parse(
                model=model,
                messages=messages,
                response_format=response_format,
            )
        except AttributeError:
            completion = client.beta.chat.completions.parse(
                model=model,
                messages=messages,
                response_format=response_format,
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("%s: chat.completions.parse failed", log_context)
        raise HTTPException(
            status_code=503,
            detail="The help assistant is unavailable right now. Please try again later.",
        ) from e

    message = completion.choices[0].message
    if getattr(message, "refusal", None):
        logger.warning("%s: model refused: %s", log_context, message.refusal)
        raise HTTPException(
            status_code=400,
            detail="I couldn't answer that. Try rephrasing, or contact support.",
        )
    parsed = message.parsed
    if parsed is None:
        logger.warning("%s: empty parsed response", log_context)
        raise HTTPException(
            status_code=503,
            detail="The help assistant returned an empty answer. Please try again.",
        )
    return parsed
