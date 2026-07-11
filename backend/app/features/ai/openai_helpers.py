"""Shared OpenAI Responses API helpers (JSON extraction, client factory)."""

from __future__ import annotations

import json
import re
from typing import Any

from fastapi import HTTPException
from openai import OpenAI

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)


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
        detail="AI features are not configured. Set OPENAI_API_KEY on the server.",
    )


def extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("no json object")
    return json.loads(m.group())
