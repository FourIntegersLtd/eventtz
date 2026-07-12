"""OpenAI (Responses API) helpers for vendor onboarding: bio + image QA."""

from __future__ import annotations

import base64
import json
from typing import Any

from fastapi import HTTPException

from app.core.config import get_settings
from app.core.logging import get_logger
from app.features.ai.openai_helpers import extract_json_object, require_openai_client

logger = get_logger(__name__)

_BIO_SAFE_KEYS = frozenset(
    {
        "firstName",
        "lastName",
        "businessName",
        "servicesOffered",
        "eventTypes",
        "baseCity",
        "deliveryModes",
        "travelRadius",
        "travelDeliveryPolicy",
        "travelDeliveryPolicyCustomText",
        "hourlyRate",
        "dailyRate",
        "useDefaultTravelHourly",
        "useDefaultTravelDaily",
        "packages",
        "allowQuoteRequests",
        "offerDiscounts",
        "discountPercentage",
        "discountLabel",
        "bulkDiscountThreshold",
        "bulkDiscountPercent",
        "offPeakDiscountPercent",
        "availableWeekdays",
        "blockedDates",
        "maxBookingsPerDay",
        "socialLinks",
        "portfolioFileNames",
        "isHalal",
        "allergenInfo",
    },
)


def _sanitize_payload_for_bio(payload: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in payload.items():
        if k in _BIO_SAFE_KEYS:
            out[k] = v
    return out


def generate_vendor_public_bio(*, payload: dict[str, Any]) -> str:
    client = require_openai_client(log_context="vendor_onboarding_ai")
    settings = get_settings()
    safe = _sanitize_payload_for_bio(payload)
    model = settings.openai_bio_model.strip() or "gpt-4o-mini"
    blob = json.dumps(safe, ensure_ascii=False, indent=2)
    logger.info(
        "vendor_onboarding_ai generate-bio: start model=%s incoming_payload_keys=%s "
        "sanitized_keys=%s json_chars=%s",
        model,
        sorted(payload.keys()),
        sorted(safe.keys()),
        len(blob),
    )
    instructions = (
        "You write public-facing vendor bios for Eventtz, a UK events marketplace. "
        "Tone: warm, professional, confident, inclusive. No markdown, no headings, no bullet lists. "
        "Write EXACTLY ONE paragraph of 3-4 lines (about 40-60 words total). Do not exceed 60 words. "
        "UK English spelling."
    )
    user_text = (
        "Here is structured onboarding data about this vendor (JSON). "
        "Write a short public bio (single paragraph, 3-4 lines) that helps clients understand "
        "who they are, what they offer, where they work, and how they work.\n\n"
        f"{blob}"
    )
    try:
        resp = client.responses.create(
            model=model,
            instructions=instructions,
            input=user_text,
            temperature=0.7,
            max_output_tokens=220,
        )
    except Exception as e:
        logger.exception(
            "vendor_onboarding_ai generate-bio: OpenAI responses.create failed model=%s",
            model,
        )
        raise HTTPException(
            status_code=502,
            detail="AI bio generation failed. Try again in a moment.",
        ) from e
    text = (resp.output_text or "").strip()
    if not text:
        logger.warning(
            "vendor_onboarding_ai generate-bio: empty output_text from model=%s (response id may be absent)",
            model,
        )
        raise HTTPException(status_code=502, detail="AI returned an empty bio. Try again.")
    logger.info(
        "vendor_onboarding_ai generate-bio: ok model=%s output_chars=%s",
        model,
        len(text),
    )
    return text


def analyze_portfolio_image(*, image_bytes: bytes, content_type: str) -> tuple[bool, int, str]:
    """Returns (ok, score 1-5, short summary). ok=false means poor quality for marketplace."""
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Empty image.")
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported.")
    client = require_openai_client(log_context="vendor_onboarding_ai")
    settings = get_settings()
    b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    data_url = f"data:{content_type};base64,{b64}"
    prompt = (
        "You review photos for a professional events marketplace portfolio. "
        "Assess: sharpness/focus, exposure, noise, composition, and whether it looks "
        "professional enough to show clients. "
        "Respond with a single JSON object ONLY (no markdown): "
        '{"ok": true or false, "score": 1-5, "summary": "one short sentence"}. '
        "Set ok to false if the image is very blurry, extremely dark or blown out, "
        "tiny resolution, mostly empty, or clearly unsuitable as a portfolio showcase."
    )
    input_msg: list[dict[str, Any]] = [
        {
            "role": "user",
            "type": "message",
            "content": [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": data_url, "detail": "low"},
            ],
        }
    ]
    resp = client.responses.create(
        model=settings.openai_vision_model.strip() or "gpt-4o-mini",
        input=input_msg,
        temperature=0.2,
        max_output_tokens=300,
    )
    raw = (resp.output_text or "").strip()
    if not raw:
        raise HTTPException(status_code=502, detail="Could not analyse this image. Try again.")
    try:
        parsed = extract_json_object(raw)
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("portfolio image QA parse failed: %s", raw[:200])
        raise HTTPException(
            status_code=502,
            detail="Could not analyse this image. Try again.",
        ) from e
    ok = bool(parsed.get("ok"))
    score = int(parsed.get("score", 3))
    if score < 1:
        score = 1
    if score > 5:
        score = 5
    summary = str(parsed.get("summary") or "").strip() or "No summary returned."
    return ok, score, summary
