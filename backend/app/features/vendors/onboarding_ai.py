"""AI helpers for vendor onboarding: bio writing and portfolio image checks."""

from __future__ import annotations

import base64
import json
from typing import Any

from fastapi import HTTPException

from app.core.constants import OPENAI_BIO_MODEL, OPENAI_VISION_MODEL
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


def _humanize_payload_for_bio(payload: dict[str, Any]) -> dict[str, Any]:
    """Replace raw enum keys with plain-English labels before sending to the model."""
    out = dict(payload)
    service_labels = {
        "catering": "Catering",
        "photography": "Photography",
        "videography": "Videography",
        "dj": "DJ",
        "entertainment": "Entertainment",
        "decor": "Decor & styling",
        "venue": "Venue",
        "rentals": "Rentals",
        "beauty": "Hair & makeup",
        "transport": "Transport",
        "cakes": "Cakes & desserts",
        "other": "Other services",
    }
    event_labels = {
        "all": "All event types",
        "weddings": "Weddings",
        "birthdays": "Birthdays",
        "corporate": "Corporate events",
        "religious": "Religious ceremonies",
        "naming_ceremonies": "Naming ceremonies",
        "funerals": "Funerals & memorials",
        "community": "Community events",
    }
    raw_services = out.get("servicesOffered")
    if isinstance(raw_services, list):
        out["servicesOffered"] = [
            service_labels.get(str(s).strip(), str(s).replace("_", " "))
            for s in raw_services
            if str(s).strip()
        ]
    raw_events = out.get("eventTypes")
    if isinstance(raw_events, list):
        if "all" in [str(e).strip() for e in raw_events]:
            out["eventTypes"] = ["All event types"]
        else:
            out["eventTypes"] = [
                event_labels.get(str(e).strip(), str(e).replace("_", " "))
                for e in raw_events
                if str(e).strip()
            ]
    return out


def _sanitize_payload_for_bio(payload: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for k, v in payload.items():
        if k in _BIO_SAFE_KEYS:
            out[k] = v
    return _humanize_payload_for_bio(out)


def generate_vendor_public_bio(*, payload: dict[str, Any]) -> str:
    client = require_openai_client(log_context="vendor_onboarding_ai")
    safe = _sanitize_payload_for_bio(payload)
    model = OPENAI_BIO_MODEL
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
        "You write public-facing vendor bios for Eventtz, a UK events marketplace used heavily "
        "by Nigerian and wider African diaspora clients planning weddings, owambe, naming "
        "ceremonies, birthdays, and community celebrations.\n\n"
        "Voice: personal, warm, and direct — like a trusted vendor speaking to a client on "
        "WhatsApp, not a corporate About page. UK English spelling. Confident but humble.\n\n"
        "Structure:\n"
        "- EXACTLY ONE paragraph, 40-60 words (3-5 sentences).\n"
        "- Vary sentence length and rhythm: mix a short punchy line with a longer detail line.\n"
        "- Prefer first person plural (\"we\") or inclusive \"I\" when a first name is given; "
        "never open with \"[Name] is the proud owner of…\" or \"[Name] is a dedicated…\".\n"
        "- End with a soft invitation to enquire (e.g. message us, tell us your date, let's "
        "plan it together) — one short clause, not pushy.\n\n"
        "Content:\n"
        "- Lead with what they do and who it's for, then city/area, then one concrete detail "
        "(setup included, packages, travel radius, halal, etc.) from the JSON.\n"
        "- Name cultural events naturally when eventTypes include them (wedding, naming "
        "ceremony, etc.) — many clients search for vendors who \"get\" these occasions.\n"
        "- Be specific about services; avoid empty praise.\n\n"
        "Never use: proud owner, dedicated professional, commitment to exceptional service, "
        "seamless experience, bringing your vision to life, specialises in (prefer \"we hire "
        "out\", \"we cater for\", \"we cover\"), markdown, headings, bullet lists, camelCase, "
        "or raw JSON field names."
    )
    user_text = (
        "Structured onboarding data for this vendor (JSON). Write their public bio.\n\n"
        f"{blob}"
    )
    try:
        resp = client.responses.create(
            model=model,
            instructions=instructions,
            input=user_text,
            temperature=0.78,
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
        raise HTTPException(status_code=502, detail="We couldn't write a bio this time. Please try again.")
    logger.info(
        "vendor_onboarding_ai generate-bio: ok model=%s output_chars=%s",
        model,
        len(text),
    )
    return text


def analyze_portfolio_image(*, image_bytes: bytes, content_type: str) -> tuple[bool, int, str]:
    """Returns (ok, score 1-5, short summary). ok=false means the image is not good enough for the marketplace."""
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Please choose an image to upload.")
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported.")
    client = require_openai_client(log_context="vendor_onboarding_ai")
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
        model=OPENAI_VISION_MODEL,
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
